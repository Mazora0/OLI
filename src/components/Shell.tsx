import { Link, NavLink } from 'react-router-dom';
import { Bot, BrainCircuit, Building2, CreditCard, LayoutDashboard, Menu, Settings, Shield, Sparkles, Wrench, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './Logo';
import { useApp } from '../context/AppContext';
import { labels, type Lang } from '../lib/i18n';
import { countries, type Country } from '../lib/pricing';

const langs = [
  ['en', 'English 🇺🇸'], ['ar', 'عربي 🇪🇬'], ['fr', 'Français 🇫🇷'], ['es', 'Español 🇪🇸'], ['de', 'Deutsch 🇩🇪'], ['tr', 'Türkçe 🇹🇷'], ['ja', '日本語 🇯🇵']
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { lang, setLang, theme, setTheme, country, setCountry, profile, signOut } = useApp();
  const t = labels[lang];
  const nav = [
    ['/', t.chat, Bot],
    ['/tools', t.tools, Wrench],
    ['/company', 'Company', Building2],
    ['/dashboard', t.dashboard, LayoutDashboard],
    ['/pricing', t.pricing, CreditCard],
    ['/settings', t.settings, Settings],
    ['/legal', 'Legal', Shield]
  ] as const;

  const side = (
    <aside className="flex h-full flex-col gap-4 p-4">
      <Link to="/" onClick={() => setOpen(false)}><Logo /></Link>
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[.04] p-3 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-black text-white"><BrainCircuit size={16} /> QLO 1.2 Router</div>
        <p className="mt-2 leading-5">QLO routing: one Gemini key, Groq/DeepSeek, Cloudflare Workers AI, compact memory, and clear Flash/Pro limits.</p>
      </div>
      <nav className="grid gap-2">
        {nav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-white text-black shadow-soft' : 'hover:bg-white/10'}`}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 rounded-3xl border border-white/10 bg-white/5 p-3">
        <select className="field py-2 text-sm" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{langs.map((l) => <option key={l[0]} value={l[0]}>{l[1]}</option>)}</select>
        <select className="field py-2 text-sm" value={country} onChange={(e) => setCountry(e.target.value as Country)}>{countries.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select>
        <button className="btn btn-soft" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'} mode</button>
        {profile ? <button className="btn btn-soft" onClick={signOut}>Logout</button> : <Link className="btn btn-primary text-center" to="/login">Login</Link>}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bubble">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[#080b12]/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo compact />
        <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black"><Sparkles size={13} /> QLO</div>
        <button onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-[86%] max-w-xs bg-[#0b1020]" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-4 top-4" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
            {side}
          </div>
        </div>
      )}
      <div className="mx-auto grid max-w-[1500px] md:grid-cols-[300px_1fr]">
        <div className="sticky top-0 hidden h-screen md:block">{side}</div>
        <main className="min-w-0 px-3 py-4 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
