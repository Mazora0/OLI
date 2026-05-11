import { createClient } from '@supabase/supabase-js';

export type PaidPlan = 'Standard' | 'Premium';
export type SubscriptionStatus = 'active' | 'pending' | 'past_due' | 'cancelled' | 'expired';

const env = (key: string) => process.env[key] || '';
const pp = (suffix: string) => env(`PAYPAL_${suffix}`);

export function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function paypalBaseUrl() {
  const mode = (pp('MODE') || pp('ENVIRONMENT') || (process.env.QLO_APP_ENV === 'production' ? 'live' : 'sandbox')).toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export function publicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || process.env.QLO_PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');
}

export function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === 'Standard' || plan === 'Premium';
}

export function paypalPlanId(plan: PaidPlan) {
  return pp(`${plan.toUpperCase()}_PLAN_ID`);
}

export function planFromPayPalPlanId(planId: string): PaidPlan | null {
  if (planId && planId === pp('STANDARD_PLAN_ID')) return 'Standard';
  if (planId && planId === pp('PREMIUM_PLAN_ID')) return 'Premium';
  return null;
}

export function parsePayPalCustomId(customId?: string | null): { userId?: string; plan?: PaidPlan } {
  if (!customId) return {};
  const parts = customId.split(':');
  if (parts.length >= 3 && parts[0] === 'qlo') {
    const plan = parts[2] as PaidPlan;
    return { userId: parts[1], plan: isPaidPlan(plan) ? plan : undefined };
  }
  return {};
}

export async function getPayPalAccessToken() {
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

export async function createPayPalSubscription(input: { accessToken: string; planId: string; userId: string; plan: PaidPlan }) {
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

export function planLimits(plan: PaidPlan | 'Free') {
  if (plan === 'Premium') return { flash: 2000, pro: 100 };
  if (plan === 'Standard') return { flash: 500, pro: 20 };
  return { flash: 30, pro: 4 };
}

export async function applyPlan(sb: any, input: { userId: string; plan: PaidPlan | 'Free'; status: SubscriptionStatus; provider: string; providerReference?: string; country?: string; currentPeriodEnd?: string | null }) {
  const limits = planLimits(input.plan);
  const country = input.country || 'EG';
  const currency = country === 'EG' ? 'EGP' : 'USD';

  await sb.from('qv_profiles').update({ plan: input.plan, updated_at: new Date().toISOString() }).eq('id', input.userId);

  await sb.from('qv_subscriptions').upsert({
    user_id: input.userId,
    plan: input.plan,
    status: input.status,
    billing_cycle: 'monthly',
    provider: input.provider,
    provider_reference: input.providerReference || null,
    country,
    currency,
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
