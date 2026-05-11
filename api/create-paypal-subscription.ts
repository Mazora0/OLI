import { createClient } from '@supabase/supabase-js';

// Utility to initialise the Supabase service role client. Only the service role
// key can perform inserts/updates on the payments tables without a user
// session. Avoid persisting a session by disabling auth persistence.
function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Retrieve the PayPal plan ID from the environment based on the selected
// subscription tier. Plans are defined at the PayPal dashboard and exposed
// via environment variables. If country‑specific overrides are required
// in the future, duplicate the logic used in `create-checkout-session.ts` for
// Stripe price resolution.
function paypalPlanId(plan: string) {
  const p = plan.toUpperCase();
  return process.env[`PAYPAL_${p}_PLAN_ID`] || '';
}

// Fetch an OAuth access token from PayPal. The client ID and secret must be
// provided via environment variables. PayPal issues a short‑lived token
// suitable for subsequent API calls.
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured');
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error_description || 'Failed to obtain PayPal access token');
  }
  return data.access_token as string;
}

// Create a PayPal subscription for the given plan. Returns the approval URL
// that the client should redirect the user to in order to complete the
// subscription. The function expects a valid PayPal access token and a
// pre‑defined plan ID. Metadata such as user ID and plan name is stored
// using the `custom_id` field.
async function createPayPalSubscription({
  accessToken,
  planId,
  userId,
  plan,
  baseUrl,
}: {
  accessToken: string;
  planId: string;
  userId: string;
  plan: string;
  baseUrl: string;
}) {
  const body = {
    plan_id: planId,
    custom_id: `${userId}-${plan.toLowerCase()}`,
    application_context: {
      brand_name: 'Qalvero',
      locale: 'en-US',
      user_action: 'SUBSCRIBE_NOW',
      return_url: `${baseUrl}/dashboard?checkout=paypal-success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
    },
  };
  const res = await fetch('https://api-m.paypal.com/v1/billing/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Failed to create PayPal subscription');
  }
  const approvalUrl = (data.links || []).find((l: any) => l.rel === 'approve')?.href;
  if (!approvalUrl) {
    throw new Error('Approval URL missing from PayPal response');
  }
  return { id: data.id as string, approvalUrl };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { plan = 'Standard' } = req.body || {};
    if (!['Standard', 'Premium', 'Max'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const sb = admin();
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!sb || !token) {
      return res.status(401).json({ error: 'Login required before checkout' });
    }
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData.user?.email || !userData.user?.id) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    // Retrieve the user country from profile or metadata. Though PayPal plans are
    // not country‑specific in this sample, the value is stored for recordkeeping.
    const { data: profile } = await sb.from('qv_profiles').select('country').eq('id', userData.user.id).maybeSingle();
    const country = String(profile?.country || userData.user.user_metadata?.country || 'EG').toUpperCase();
    const planId = paypalPlanId(plan);
    if (!planId) {
      return res.status(500).json({ error: `PayPal plan id is missing for ${plan}. Add PAYPAL_${plan.toUpperCase()}_PLAN_ID.` });
    }
    const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
    // Fetch the OAuth access token and create the subscription via PayPal API.
    const accessToken = await getPayPalAccessToken();
    const { id: subscriptionId, approvalUrl } = await createPayPalSubscription({
      accessToken,
      planId,
      userId: userData.user.id,
      plan,
      baseUrl: base,
    });
    // Record the pending payment in Supabase for later reconciliation in the
    // webhook handler once the user completes the PayPal approval. The status
    // remains `checkout_created` until PayPal webhook marks it active.
    await sb.from('qv_payments').insert({
      user_id: userData.user.id,
      provider: 'paypal',
      status: 'checkout_created',
      plan,
      country,
      subscription_id: subscriptionId,
    });
    return res.status(200).json({ url: approvalUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Could not create PayPal subscription' });
  }
}