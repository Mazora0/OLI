import { admin, createPayPalSubscription, getPayPalAccessToken, isPaidPlan, paypalPlanId } from './_paypal';

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
      paypal_subscription_id: created.subscriptionId,
      metadata: { plan_id: planId, source: 'paypal_subscription_checkout' }
    });

    await sb.from('qv_paypal_events').insert({
      user_id: userData.user.id,
      event_type: 'subscription.checkout_created',
      paypal_subscription_id: created.subscriptionId,
      plan,
      raw: { plan_id: planId, country }
    });

    return res.status(200).json({ url: created.approvalUrl, subscription_id: created.subscriptionId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Could not create PayPal subscription' });
  }
}
