import { createClient } from '@supabase/supabase-js';

type PaidPlan = 'Standard' | 'Premium';

const env = (key: string) => process.env[key] || '';
const pp = (suffix: string) => env(`PAYPAL_${suffix}`);

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === 'Standard' || plan === 'Premium';
}

function paypalBaseUrl() {
  const mode = (pp('MODE') || pp('ENVIRONMENT') || (process.env.QLO_APP_ENV === 'production' ? 'live' : 'sandbox')).toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function publicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.QLO_PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function paypalPlanId(plan: PaidPlan) {
  return pp(`${plan.toUpperCase()}_PLAN_ID`);
}

async function getPayPalAccessToken() {
  const clientId = pp('CLIENT_ID');
  const clientSecret = pp('CLIENT_' + 'SECRET');
  if (!clientId || !clientSecret) throw new Error('PayPal API credentials are not configured');
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.message || 'Failed to get PayPal access token');
  return String(data.access_token || '');
}

async function createPayPalSubscription(input: { accessToken: string; planId: string; userId: string; plan: PaidPlan }) {
  const base = publicSiteUrl();
  const response = await fetch(`${paypalBaseUrl()}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: `qlo:${input.userId}:${input.plan}`,
      application_context: {
        brand_name: 'Qalvero AI',
        locale: 'en-US',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${base}/dashboard?checkout=paypal-success`,
        cancel_url: `${base}/pricing?checkout=paypal-cancelled`
      }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message || data?.details?.[0]?.description || 'Failed to create PayPal subscription');
  const approvalUrl = (data.links || []).find((link: any) => link.rel === 'approve')?.href;
  if (!approvalUrl) throw new Error('PayPal approval URL is missing');
  return { subscriptionId: String(data.id), approvalUrl };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { plan = 'Standard' } = req.body || {};
    if (!isPaidPlan(plan)) return res.status(400).json({ error: 'Invalid plan' });

    const sb = admin();
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!sb || !token) return res.status(401).json({ error: 'Login required before PayPal checkout' });

    const { data: userData, error } = await sb.auth.getUser(token);
    if (error || !userData.user?.id || !userData.user?.email) return res.status(401).json({ error: 'Invalid session' });

    const { data: profile } = await sb.from('qv_profiles').select('country').eq('id', userData.user.id).maybeSingle();
    const country = String(profile?.country || userData.user.user_metadata?.country || 'EG').toUpperCase();

    const planId = paypalPlanId(plan);
    if (!planId) return res.status(500).json({ error: `PayPal plan id is missing for ${plan}. Add the matching PayPal plan ID in Vercel.` });

    const accessToken = await getPayPalAccessToken();
    const created = await createPayPalSubscription({ accessToken, planId, userId: userData.user.id, plan });

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
