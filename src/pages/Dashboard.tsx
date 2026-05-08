import { Link } from 'react-router-dom';
import { BarChart3, BrainCircuit, CreditCard, Database, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { limits, price } from '../lib/pricing';

export default function Dashboard() {
  const { profile, country } = useApp();
  const plan = (profile?.plan || 'Free') as keyof typeof limits;
  const current = limits[plan];
  const cards = [
    ['QLO Flash pool', 'Groq + one Gemini Flash key + Cloudflare Workers AI fallback.', Zap],
    ['Smart model routing', 'QLO chooses Flash, Pro, Reason, Code, Study, or Creative by task.', BrainCircuit],
    ['Compact memory', 'Stores only essential user basics to reduce storage costs.', Database],
    ['Account security', 'Supabase Auth, RLS policies, and server-side API keys.', ShieldCheck]
  ] as const;
  return <section className="mx-auto max-w-6xl"><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Sparkles size={14} /> Qalvero Control Center</div><h1 className="text-4xl font-black md:text-6xl">Welcome to <span className="grad">Qalvero</span></h1><p className="mt-3 text-slate-400">{profile?.email || 'Demo account'} · Current plan: <b className="text-white">{plan}</b></p></div><Link to="/pricing" className="btn btn-primary"><CreditCard size={18} /> Upgrade plan</Link></div><div className="grid gap-4 md:grid-cols-3"><div className="card rounded-[2rem] p-5"><p className="text-sm text-slate-400">Daily AI messages</p><h2 className="mt-2 text-2xl font-black leading-tight">{current.messages}</h2><p className="mt-2 text-sm text-slate-400">Configured server-side through Supabase usage tracking.</p></div><div className="card rounded-[2rem] p-5"><p className="text-sm text-slate-400">Billing region</p><h2 className="mt-2 text-4xl font-black">{country}</h2><p className="mt-2 text-sm text-slate-400">Standard: {price(country, 'standard')} · Premium: {price(country, 'premium')}</p></div><div className="card rounded-[2rem] p-5"><p className="text-sm text-slate-400">QLO models</p><h2 className="mt-2 text-4xl font-black">{current.models.length}</h2><p className="mt-2 text-sm text-slate-400">{current.models.join(', ')}</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2">{cards.map(([title, text, Icon]) => <div key={title} className="card rounded-[2rem] p-5"><Icon className="mb-4 text-cyan-300" /><h3 className="text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div><div className="mt-5 rounded-[2rem] border border-cyan-300/20 bg-cyan-300/10 p-5"><div className="flex items-start gap-3"><BarChart3 className="mt-1 text-cyan-200" /><div><h3 className="font-black">Next production step</h3><p className="mt-1 text-sm text-slate-300">Add Vercel environment variables, run the Supabase SQL file, and deploy. Then QLO routing, memory, auth, and usage limits will activate.</p></div></div></div></section>;
}
