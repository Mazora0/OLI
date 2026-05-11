import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

type PaidPlan = 'Standard' | 'Premium' | 'Max';
type SubscriptionStatus = 'active' | 'pending' | 'past_due' | 'cancelled' | 'expired';

const env = (key: string) => process.env[key] || '';
const pp = (suffix: string) => env('PAYPAL_' + suffix);

function admin() {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === 'Standard' || plan === 'Premium' || plan === 'Max';
}

function paypalBaseUrl() {
  const mode = (pp('MODE') || pp('ENVIRONMENT') || (env('QLO_APP_ENV') === 'production' ? 'live' : 'sandbox')).toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function planFromProviderPlanId(planId: string): PaidPlan | null {
  if (planId && planId === pp('STANDARD_PLAN_ID')) return 'Standard';
  if (planId && planId === pp('PREMIUM_PLAN_ID')) return 'Premium';
  if (planId && planId === pp('MAX_PLAN_ID')) return 'Max';
  return null;
}

function parseCustomId(customId?: string | null): { userId?: string; plan?: PaidPlan } {
  if (!customId) return {};
  const parts = customId.split(':');
  if (parts.length >= 3 && parts[0] === 'qlo') {
    const plan = parts[2] as PaidPlan;
    return { userId: parts[1], plan: isPaidPlan(plan) ? plan : undefined };
  }
  return {};
}

function planLimits(plan: PaidPlan | 'Free') {
  if (plan === 'Max') return { flash: 5000, pro: 200 };
  if (plan === 'Premium') return { flash: 2000, pro: 100 };
  if (plan === 'Standard') return { flash: 500, pro: 10 };
  return { flash: 30, pro: 4 };
}

async function applyPlan(sb: any, input: {
  userId: string;
  plan: PaidPlan | 'Free';
  status: SubscriptionStatus;
  provider: string;
  providerReference?: string;
  providerPlanId?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const limits = planLimits(input.plan);

  await sb.from('qv_profiles')
    .update({ plan: input.plan, updated_at: new Date().toISOString() })
    .eq('id', input.userId);

  await sb.from('qv_subscriptions').upsert({
    user_id: input.userId,
    plan: input.plan,
    status: input.status,
    billing_cycle: 'monthly',
    provider: input.provider,
    provider_reference: input.providerReference || null,
    provider_subscription_id: input.providerReference || null,
    provider_plan_id: input.providerPlanId || null,
    current_period_end: input.currentPeriodEnd || null,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  await sb.from('qv_ai_usage').upsert({
    user_id: input.userId,
    messages_limit: limits.flash,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });

  await sb.from('qv_model_usage').upsert([
    { user_id: input.userId, tier: 'flash', messages_limit: limits.flash, updated_at: new Date().toISOString() },
    { user_id: input.userId, tier: 'pro', messages_limit: limits.pro, updated_at: new Date().toISOString() }
  ], { onConflict: 'user_id,tier' });
}

async function readRawBody(req: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function getAccessToken() {
  const clientId = pp('CLIENT_ID');
  const clientSecret = pp('CLIENT_' + 'SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal configuration is incomplete');

  const credentials = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const response = await fetch(paypalBaseUrl() + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + credentials,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.message || 'Failed to get PayPal access token');
  return String(data.access_token || '');
}

async function verifyWebhook(req: any, rawBody: string) {
  const webhookId = env('PAYPAL_WEBHOOK_ID');
  if (!webhookId) throw new Error('PayPal webhook id is not configured');

  const accessToken = await getAccessToken();
  const webhookEvent = JSON.parse(rawBody);
  const verification = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: webhookEvent
  };

  const response = await fetch(paypalBaseUrl() + '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(verification)
  });

  const data = await response.json();
  if (!response.ok || data.verification_status !== 'SUCCESS') throw new Error('Invalid PayPal webhook signature');
  return webhookEvent;
}

async function fetchSubscription(subscriptionId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(paypalBaseUrl() + '/v1/billing/subscriptions/' + subscriptionId, {
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || 'Failed to fetch PayPal subscription');
  return data;
}

function normalizeStatus(eventType: string, providerStatus?: string): SubscriptionStatus {
  const s = String(providerStatus || '').toUpperCase();
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
    const parsed = parseCustomId(details.custom_id || resource.custom_id);
    const plan = parsed.plan || planFromProviderPlanId(planId);
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
        providerPlanId: planId || null,
        currentPeriodEnd: nextBillingTime
      });
    } else {
      const { data: currentSub } = await sb.from('qv_subscriptions')
        .select('provider,provider_reference')
        .eq('user_id', userId)
        .maybeSingle();

      if (currentSub?.provider === 'paypal_subscription' && currentSub?.provider_reference === subscriptionId) {
        await applyPlan(sb, {
          userId,
          plan: 'Free',
          status,
          provider: 'paypal_subscription',
          providerReference: subscriptionId,
          providerPlanId: planId || null,
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
