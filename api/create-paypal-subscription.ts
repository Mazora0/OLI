import { createClient } from '@supabase/supabase-js';

type PaidPlan = 'Standard' | 'Premium' | 'Max';
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

function publicSiteUrl() {
  return (env('PUBLIC_SITE_URL') || env('QLO_PUBLIC_BASE_URL') || 'http://localhost:5173').replace(/\/$/, '');
}

async function accessToken() {
  const id = pp('CLIENT_ID');
  const sec = pp('CLIENT_' + 'SECRET');
  if (!id || !sec) throw new Error('PayPal configuration is incomplete');
  const encoded = Buffer.from(id + ':' + sec).toString('base64');
  const r = await fetch(paypalBaseUrl() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + encoded, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error_description || data?.message || 'PayPal token request failed');
  return String(data.access_token || '');
}

async function createSub(input: { token: string; planId: string; userId: string; plan: PaidPlan }) {
  const base = publicSiteUrl();
  const r = await fetch(paypalBaseUrl() + '/v1/billing/subscriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + input.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: `qlo:${input.userId}:${input.plan}`,
      application_context: {
        brand_name: 'Qalvero AI',
        locale: 'en-US',
        user_action: 'SUBSCRIBE_NOW',
        return_url: base + '/dashboard?checkout=paypal-success',
        cancel_url: base + '/pricing?checkout=paypal-cancelled'
      }
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message || data?.details?.[0]?.description || 'PayPal subscription request failed');
  const approvalUrl = (data.links || []).find((link: any) => link.rel === 'approve')?.href;
  if (!approvalUrl) throw new Error('PayPal approval URL is missing');
  return { subscriptionId: String(data.id), approvalUrl };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const plan = (req.body?.plan || 'Standard') as PaidPlan;
    if (!isPaidPlan(plan)) return res.status(400).json({ error: 'Invalid plan' });
    const sb = admin();
    const sessionToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!sb || !sessionToken) return res.status(401).json({ error: 'Login required before PayPal checkout' });

    const { data: userData, error } = await sb.auth.getUser(sessionToken);
    if (error || !userData.user?.id || !userData.user?.email) return res.status(401).json({ error: 'Invalid session' });

    const { data: profile } = await sb.from('qv_profiles').select('country').eq('id', userData.user.id).maybeSingle();
    const country = String(profile?.country || userData.user.user_metadata?.country || 'EG').toUpperCase();
    const planId = pp(plan.toUpperCase() + '_PLAN_ID');
    if (!planId) return res.status(500).json({ error: 'PayPal plan id is missing for ' + plan });

    const token = await accessToken();
    const created = await createSub({ token, planId, userId: userData.user.id, plan });

    await sb.from('qv_payments').insert({
      user_id: userData.user.id,
      provider: 'paypal',
      status: 'checkout_created',
      plan,
      country,
      external_subscription_id: created.subscriptionId,
      external_plan_id: planId,
      metadata: { source: 'subscription_checkout' }
    });

    await sb.from('qv_provider_events').insert({
      user_id: userData.user.id,
      provider: 'paypal',
      event_type: 'subscription.checkout_created',
      provider_subscription_id: created.subscriptionId,
      provider_plan_id: planId,
      plan,
      raw: { country }
    });

    return res.status(200).json({ url: created.approvalUrl, subscription_id: created.subscriptionId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Could not create PayPal subscription' });
  }
}
