import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any });
};
function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
const priceEnv = (plan: string, country: string) => {
  const p = plan.toUpperCase();
  const c = country.toUpperCase();
  return process.env[`STRIPE_${p}_PRICE_ID_${c}`] || process.env[`STRIPE_${p}_PRICE_ID`] || '';
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { plan = 'Standard' } = req.body || {};
    if (!['Standard', 'Premium'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    const sb = admin();
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!sb || !token) return res.status(401).json({ error: 'Login required before checkout' });
    const { data: userData, error } = await sb.auth.getUser(token);
    if (error || !userData.user?.email) return res.status(401).json({ error: 'Invalid session' });
    const { data: profile } = await sb.from('qv_profiles').select('country').eq('id', userData.user.id).maybeSingle();
    const country = String(profile?.country || userData.user.user_metadata?.country || 'EG').toUpperCase();
    const priceId = priceEnv(plan, country);
    if (!priceId) return res.status(500).json({ error: `Stripe price id is missing for ${plan}. Add STRIPE_${plan.toUpperCase()}_PRICE_ID or STRIPE_${plan.toUpperCase()}_PRICE_ID_${String(country).toUpperCase()}` });
    const st = stripe();
    if (!st) return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured' });
    const base = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
    const session = await st.checkout.sessions.create({
      mode: 'subscription',
      customer_email: userData.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      metadata: { user_id: userData.user.id, plan, country },
      subscription_data: { metadata: { user_id: userData.user.id, plan, country } }
    });
    await sb.from('qv_payments').insert({ user_id: userData.user.id, provider: 'stripe', status: 'checkout_created', plan, country, checkout_session_id: session.id });
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Could not create checkout session' });
  }
}
