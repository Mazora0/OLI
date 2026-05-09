import { useState } from 'react';
import { Check, CreditCard, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { price, limits } from '../lib/pricing';
import { getAccessToken } from '../lib/supabase';

const planNames = ['Free', 'Standard', 'Premium'] as const;

const text = {
  ar: {
    badge: 'تسعير حسب الدولة',
    title: 'خطط تبدأ مجاني وتكبر معاك.',
    subtitle: 'مصر لها سعر محلي أقل. Stripe يفعّل الخطة تلقائيًا، و PayPal invoice موجود كحل يدوي احتياطي.',
    daily: 'رسالة AI يوميًا',
    current: 'الخطة الحالية',
    stripe: 'اشترك بـ Stripe',
    paypal: 'طلب فاتورة PayPal',
    email: 'إيميل العميل',
    loginFirst: 'سجّل دخول الأول، بعدها اختار خطة مدفوعة.',
    stripeMissing: 'Stripe Checkout مش متفعل لسه.',
    saved: 'تم حفظ طلب الفاتورة',
    payments: 'الدفع',
    paymentsText: 'Stripe Checkout يفعّل Standard/Premium تلقائيًا عند ضبط الـ webhook. PayPal invoice يفضل يدويًا كخطة احتياطية.',
    note: 'ملاحظة إنتاج: لازم تضيف Stripe keys و webhook secret في Vercel عشان التفعيل التلقائي يشتغل.'
  },
  en: {
    badge: 'Regional SaaS Pricing',
    title: 'Plans that scale from free to serious.',
    subtitle: 'Egypt gets lower local pricing. Stripe Checkout activates plans automatically, and PayPal invoice is available as a manual backup.',
    daily: 'AI messages / day',
    current: 'Current starter plan',
    stripe: 'Subscribe with Stripe',
    paypal: 'Request PayPal invoice',
    email: 'Customer email',
    loginFirst: 'Login first, then choose a paid plan.',
    stripeMissing: 'Stripe checkout is not configured yet.',
    saved: 'Invoice request saved',
    payments: 'Payments',
    paymentsText: 'Stripe Checkout activates Standard/Premium automatically through the webhook. PayPal invoice stays manual as a backup.',
    note: 'Production note: add Stripe keys and webhook secret in Vercel for automatic plan activation.'
  }
} as const;

export default function Pricing() {
  const { country, profile, lang } = useApp();
  const c = lang === 'ar' ? text.ar : text.en;
  const [email, setEmail] = useState(profile?.email || '');
  const [msg, setMsg] = useState('');

  async function request(plan: 'Standard' | 'Premium') {
    setMsg('');
    const token = await getAccessToken();
    if (!token) { setMsg(c.loginFirst); return; }
    const r = await fetch('/api/request-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email: email || profile?.email, plan }) });
    const data = await r.json();
    setMsg(data.error || `${c.saved}: ${data.invoice?.currency || ''} ${data.invoice?.amount || ''} · ${plan}.`);
  }

  async function checkout(plan: 'Standard' | 'Premium') {
    setMsg('');
    const token = await getAccessToken();
    if (!token) { setMsg(c.loginFirst); return; }
    const r = await fetch('/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan }) });
    const data = await r.json();
    if (data.url) window.location.href = data.url;
    else setMsg(data.error || c.stripeMissing);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Sparkles size={14} /> {c.badge}</div>
        <h1 className="mt-4 text-4xl font-black md:text-6xl">{c.title}</h1>
        <p className="mt-3 max-w-2xl soft-text">{c.subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {planNames.map((p) => (
          <div key={p} className={`glass rounded-[2rem] p-6 ${p === 'Premium' ? 'ring-2 ring-cyan-300/60' : ''}`}>
            <h2 className="text-2xl font-black">{p}</h2>
            <p className="mt-3 text-4xl font-black">{p === 'Free' ? '$0' : price(country, p.toLowerCase() as any)}</p>
            <p className="mt-2 text-sm soft-text">{limits[p].messages} {c.daily}</p>
            <ul className="mt-6 space-y-3">{[...limits[p].models, ...limits[p].tools].map((x) => <li key={x} className="flex gap-2 text-sm"><Check className="shrink-0 text-[var(--accent-1)]" size={18} />{x}</li>)}</ul>
            {p === 'Free'
              ? <button className="btn btn-soft mt-7 w-full">{c.current}</button>
              : <div className="mt-7 grid gap-2"><button className="btn btn-primary w-full" onClick={() => checkout(p)}><CreditCard size={16} /> {c.stripe}</button><button className="btn btn-soft w-full" onClick={() => request(p)}>{c.paypal}</button></div>}
          </div>
        ))}
      </div>

      <div className="glass mt-6 rounded-[2rem] p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-3"><Mail className="text-[var(--accent-1)]" /><div><b>{c.payments}</b><p className="mt-1 text-sm soft-text">{c.paymentsText}</p></div></div>
          <input className="field md:w-72" placeholder={c.email} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {msg && <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">{msg}</p>}
      </div>

      <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
        <div className="flex items-start gap-3"><ShieldCheck className="text-[var(--accent-1)]" /><p className="text-sm leading-6 soft-text"><b className="strong-muted">{c.note}</b></p></div>
      </div>
    </div>
  );
}
