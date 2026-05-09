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
function readRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function activatePlan(userId: string, plan: string, customerId?: string, subscriptionId?: string) {
  const sb = admin();
  if (!sb || !userId || !['Standard', 'Premium'].includes(plan)) return;
  const now = new Date().toISOString();
  await sb.from('qv_profiles').update({ plan, updated_at: now }).eq('id', userId);
  await sb.from('qv_subscriptions').upsert({
    user_id: userId,
    plan,
    status: 'active',
    provider: 'stripe',
    provider_reference: subscriptionId || customerId || null,
    updated_at: now
  }, { onConflict: 'user_id' });
  await sb.from('qv_payments').insert({ user_id: userId, provider: 'stripe', status: 'paid_or_active', plan, stripe_customer_id: customerId || null, stripe_subscription_id: subscriptionId || null });
}
async function markSubscription(userId: string, plan: string, status: string, subscriptionId?: string) {
  const sb = admin();
  if (!sb || !userId) return;
  const normalized = status === 'active' || status === 'trialing' ? 'active' : status === 'past_due' ? 'past_due' : status === 'canceled' ? 'cancelled' : 'expired';
  await sb.from('qv_subscriptions').upsert({ user_id: userId, plan: ['Standard','Premium'].includes(plan) ? plan : 'Free', status: normalized, provider: 'stripe', provider_reference: subscriptionId || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (normalized !== 'active') await sb.from('qv_profiles').update({ plan: 'Free', updated_at: new Date().toISOString() }).eq('id', userId);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const st = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!st || !secret) return res.status(500).send('Stripe webhook is not configured');
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = st.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = String(session.metadata?.user_id || '');
      const plan = String(session.metadata?.plan || 'Standard');
      await activatePlan(userId, plan, String(session.customer || ''), String(session.subscription || ''));
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const userId = String(sub.metadata?.user_id || '');
      const plan = String(sub.metadata?.plan || 'Standard');
      await markSubscription(userId, plan, sub.status, sub.id);
    }
    return res.status(200).json({ received: true });
  } catch (err: any) {
    return res.status(500).send(err.message || 'Webhook handler failed');
  }
}
