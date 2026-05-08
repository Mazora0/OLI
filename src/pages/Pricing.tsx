import { useState } from 'react';
import { Check, CreditCard, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { price, limits } from '../lib/pricing';
import { getAccessToken } from '../lib/supabase';

const planNames = ['Free', 'Standard', 'Premium'] as const;

export default function Pricing() {
  const { country, profile } = useApp();
  const [email, setEmail] = useState(profile?.email || '');
  const [msg, setMsg] = useState('');
  async function request(plan: 'Standard' | 'Premium') {
    setMsg('');
    const token = await getAccessToken();
    const r = await fetch('/api/request-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ email: email || profile?.email, plan, country }) });
    const data = await r.json();
    setMsg(data.error || `Invoice request saved: ${data.invoice?.currency || ''} ${data.invoice?.amount || ''} for ${plan}.`);
  }
  async function checkout(plan: 'Standard' | 'Premium') {
    setMsg('');
    const token = await getAccessToken();
    if (!token) { setMsg('Login first, then choose a paid plan.'); return; }
    const r = await fetch('/api/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan, country }) });
    const data = await r.json();
    if (data.url) window.location.href = data.url;
    else setMsg(data.error || 'Stripe checkout is not configured yet.');
  }
  return <div className="mx-auto max-w-6xl"><div className="mb-8"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Sparkles size={14} /> Regional SaaS Pricing</div><h1 className="mt-4 text-4xl font-black md:text-6xl">Plans that scale from <span className="grad">free</span> to serious.</h1><p className="mt-3 max-w-2xl text-slate-400">Egypt gets lower local pricing. Stripe Checkout can activate plans automatically, and PayPal invoice is available as a manual backup.</p></div><div className="grid gap-4 md:grid-cols-3">{planNames.map((p) => <div key={p} className={`glass rounded-[2rem] p-6 ${p === 'Premium' ? 'ring-2 ring-cyan-300/60' : ''}`}><h2 className="text-2xl font-black">{p}</h2><p className="mt-3 text-4xl font-black">{p === 'Free' ? '$0' : price(country, p.toLowerCase() as any)}</p><p className="mt-2 text-sm text-slate-400">{limits[p].messages} AI messages / day</p><ul className="mt-6 space-y-3">{[...limits[p].models, ...limits[p].tools].map((x) => <li key={x} className="flex gap-2 text-sm"><Check className="text-cyan-300" size={18} />{x}</li>)}</ul>{p === 'Free' ? <button className="btn btn-soft mt-7 w-full">Current starter plan</button> : <div className="mt-7 grid gap-2"><button className="btn btn-primary w-full" onClick={() => checkout(p)}><CreditCard size={16} /> Subscribe with Stripe</button><button className="btn btn-soft w-full" onClick={() => request(p)}>Request PayPal invoice</button></div>}</div>)}</div><div className="glass mt-6 rounded-[2rem] p-5"><div className="grid gap-3 md:grid-cols-[1fr_auto]"><div className="flex items-start gap-3"><Mail className="text-cyan-300" /><div><b>Payments</b><p className="mt-1 text-sm text-slate-400">Stripe Checkout activates the user plan automatically through the webhook. PayPal invoice stays as a manual backup if card checkout is not available.</p></div></div><input className="field md:w-72" placeholder="Customer email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>{msg && <p className="mt-4 rounded-2xl bg-white/10 p-3 text-sm">{msg}</p>}</div><div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><ShieldCheck className="text-cyan-300" /><p className="text-sm leading-6 text-slate-400"><b className="text-white">Production note:</b> Stripe subscriptions activate Standard/Premium automatically when the webhook is configured. PayPal invoices remain manual, because payment providers apparently compete over who can invent the most dashboards.</p></div></div></div>;
}
