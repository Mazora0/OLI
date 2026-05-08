import { createClient } from '@supabase/supabase-js';

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (body: any) => void; setHeader?: (key: string, value: string) => void };

function json(res: Res, code: number, body: any) {
  res.setHeader?.('Content-Type', 'application/json');
  return res.status(code).json(body);
}
function getBearer(headers: Req['headers']) {
  const raw = headers.authorization || headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length);
}
function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}
export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const admin = getAdminClient();
    if (!admin) return json(res, 500, { error: 'Supabase service key is not configured.' });
    const token = getBearer(req.headers);
    if (!token) return json(res, 401, { error: 'Please log in first.' });
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json(res, 401, { error: 'Invalid session.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { plan, country, currency, amount, email } = body;
    if (!['Standard', 'Premium'].includes(plan)) return json(res, 400, { error: 'Invalid plan.' });
    const { error } = await admin.from('qv_payment_requests').insert({
      user_id: userData.user.id,
      email: email || userData.user.email,
      plan,
      country,
      currency,
      amount_text: amount,
      provider: 'paypal_invoice',
      status: 'pending',
    });
    if (error) return json(res, 500, { error: error.message });
    return json(res, 200, { ok: true, message: 'Upgrade request saved. Send the PayPal invoice manually from your PayPal dashboard.' });
  } catch (e: any) {
    return json(res, 500, { error: e.message || 'Server error' });
  }
}
