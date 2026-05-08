import { createClient } from '@supabase/supabase-js';

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const prices: Record<string, Record<string, { currency: string; standard: number; premium: number }>> = {
  EG: { monthly: { currency: 'EGP', standard: 29, premium: 49 } },
  US: { monthly: { currency: 'USD', standard: 3, premium: 4.99 } },
  SA: { monthly: { currency: 'SAR', standard: 11, premium: 19 } },
  AE: { monthly: { currency: 'AED', standard: 11, premium: 19 } },
  GB: { monthly: { currency: 'GBP', standard: 2.5, premium: 4.49 } },
  EU: { monthly: { currency: 'EUR', standard: 2.99, premium: 4.99 } },
  TR: { monthly: { currency: 'TRY', standard: 99, premium: 169 } },
  JP: { monthly: { currency: 'JPY', standard: 450, premium: 750 } },
  OTHER: { monthly: { currency: 'USD', standard: 3, premium: 4.99 } }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, plan = 'Standard', country = 'EG', note = '' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  const p = prices[country]?.monthly || prices.OTHER.monthly;
  const amount = plan === 'Premium' ? p.premium : p.standard;
  const sb = admin();
  if (sb) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const { data } = token ? await sb.auth.getUser(token) : { data: { user: null } } as any;
    await sb.from('qv_invoice_requests').insert({ user_id: data.user?.id || null, email, plan, country, currency: p.currency, amount, note: String(note).slice(0, 500), status: 'pending' });
  }
  return res.status(200).json({ ok: true, message: 'Invoice request saved. Send the PayPal invoice from your PayPal Business dashboard.', invoice: { email, plan, country, currency: p.currency, amount, business_email: process.env.PAYPAL_BUSINESS_EMAIL || 'support@qalvero.com' } });
}
