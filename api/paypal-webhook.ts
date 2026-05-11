import { admin, applyPlan, getPayPalAccessToken, paypalBaseUrl, parsePayPalCustomId, planFromPayPalPlanId } from './_paypal';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function verifyWebhook(req: any, rawBody: string) {
  const webhookId = process.env['PAYPAL_WEBHOOK_ID'] || '';
  if (!webhookId) throw new Error('PayPal webhook id is not configured');

  const accessToken = await getPayPalAccessToken();
  const verification = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody)
  };

  const response = await fetch(`${paypalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(verification)
  });
  const data = await response.json();
  if (!response.ok || data.verification_status !== 'SUCCESS') throw new Error('Invalid PayPal webhook signature');
  return verification.webhook_event;
}

async function fetchSubscription(subscriptionId: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${paypalBaseUrl()}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to fetch PayPal subscription');
  return data;
}

function normalizeStatus(eventType: string, paypalStatus?: string) {
  const s = String(paypalStatus || '').toUpperCase();
  if (eventType.includes('CANCELLED')) return 'cancelled';
  if (eventType.includes('SUSPENDED')) return 'past_due';
  if (eventType.includes('EXPIRED')) return 'expired';
  if (eventType.includes('ACTIVATED') || s === 'ACTIVE') return 'active';
  return 'pending';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sb = admin();
    if (!sb) return res.status(500).json({ error: 'Supabase service role is not configured' });

    const rawBody = await readRawBody(req);
    const event = await verifyWebhook(req, rawBody);
    const eventType = String(event.event_type || '');
    const resource = event.resource || {};
    const subscriptionId = String(resource.id || resource.billing_agreement_id || '');
    if (!subscriptionId) return res.status(200).json({ ok: true, ignored: 'missing_subscription_id' });

    const details = await fetchSubscription(subscriptionId);
    const planId = String(details.plan_id || resource.plan_id || '');
    const parsed = parsePayPalCustomId(details.custom_id || resource.custom_id);
    const plan = parsed.plan || planFromPayPalPlanId(planId);
    const userId = parsed.userId;

    await sb.from('qv_provider_events').insert({
      event_id: event.id,
      event_type: eventType,
      provider: 'paypal',
      user_id: userId || null,
      provider_subscription_id: subscriptionId,
      provider_plan_id: planId || null,
      plan: plan || null,
      raw: event
    });

    if (!userId || !plan) return res.status(200).json({ ok: true, ignored: 'unmapped_subscription' });

    const status = normalizeStatus(eventType, details.status);
    const nextBillingTime = details.billing_info?.next_billing_time || null;

    if (status === 'active' || status === 'pending' || status === 'past_due') {
      await applyPlan(sb, {
        userId,
        plan,
        status,
        provider: 'paypal_subscription',
        providerReference: subscriptionId,
        currentPeriodEnd: nextBillingTime
      });
    } else {
      const { data: currentSub } = await sb.from('qv_subscriptions').select('provider,provider_reference').eq('user_id', userId).maybeSingle();
      if (currentSub?.provider === 'paypal_subscription' && currentSub?.provider_reference === subscriptionId) {
        await applyPlan(sb, {
          userId,
          plan: 'Free',
          status,
          provider: 'paypal_subscription',
          providerReference: subscriptionId,
          currentPeriodEnd: null
        });
      }
    }

    await sb.from('qv_payments').upsert({
      user_id: userId,
      provider: 'paypal',
      status,
      plan,
      external_subscription_id: subscriptionId,
      external_plan_id: planId || null,
      metadata: { event_type: eventType, paypal_status: details.status },
      updated_at: new Date().toISOString()
    }, { onConflict: 'external_subscription_id' });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'PayPal webhook failed' });
  }
}
