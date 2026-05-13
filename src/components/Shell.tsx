import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { CreditCard, Globe2, Home, LayoutDashboard, LogIn, LogOut, Menu, MoonStar, Palette, Settings, Shield, Sparkles, SunMedium, Wand2, X, ArrowLeft, Activity } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useApp, type AccentColor, type ThemeMode } from '../context/AppContext';
import { labels, type Lang } from '../lib/i18n';
import { getAvatar } from '../lib/avatars';

const langs = [
  ['en', 'English'], ['ar', 'العربية'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['tr', 'Türkçe'], ['ja', '日本語']
] as const;

const accents: { id: AccentColor; label: Record<Lang, string> }[] = [
  { id: 'orange', label: { en: 'Orange', ar: 'برتقالي', fr: 'Orange', es: 'Naranja', de: 'Orange', tr: 'Turuncu', ja: 'オレンジ' } },
  { id: 'violet', label: { en: 'Violet', ar: 'بنفسجي', fr: 'Violet', es: 'Violeta', de: 'Violett', tr: 'Mor', ja: 'バイオレット' } },
  { id: 'blue', label: { en: 'Blue', ar: 'أزرق', fr: 'Bleu', es: 'Azul', de: 'Blau', tr: 'Mavi', ja: 'ブルー' } },
  { id: 'emerald', label: { en: 'Emerald', ar: 'زمردي', fr: 'Émeraude', es: 'Esmeralda', de: 'Smaragd', tr: 'Zümrüt', ja: 'エメラルド' } }
];

const themeText: Record<ThemeMode, Record<Lang, string>> = {
  system: { en: 'System', ar: 'النظام', fr: 'Système', es: 'Sistema', de: 'System', tr: 'Sistem', ja: 'システム' },
  dark: { en: 'Dark', ar: 'داكن', fr: 'Sombre', es: 'Oscuro', de: 'Dunkel', tr: 'Koyu', ja: 'ダーク' },
  light: { en: 'Light', ar: 'فاتح', fr: 'Clair', es: 'Claro', de: 'Hell', tr: 'Açık', ja: 'ライト' }
};

function UserAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { profile } = useApp();
  const isGuest = !profile;
  const avatar = getAvatar(profile?.avatar_id);
  const sizeClass = size === 'lg' ? 'h-24 w-24 text-4xl' : size === 'sm' ? 'h-12 w-12 text-xl' : 'h-14 w-14 text-2xl';
  return (
    <div className={`avatar-ring ${sizeClass} overflow-hidden`}>
      <div className={`avatar-core grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${isGuest ? 'from-slate-800 to-slate-950' : avatar.gradient}`}>
        {isGuest ? 'Q' : avatar.emoji}
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, setLang, theme, setTheme, accent, setAccent, country, profile, signOut } = useApp();
  const t = labels[lang];
  const isAuthRoute = ['/login', '/signup', '/forgot-password'].includes(location.pathname);
  const isGuest = !profile;
  const displayName = profile?.full_name || profile?.email || (lang === 'ar' ? 'ضيف' : 'Guest');
  const subtitle = profile?.email || (lang === 'ar' ? 'غير مسجل الدخول' : 'Not signed in');

  const nav = useMemo(() => {
    const base = [
      ['/', t.home, Home],
      ['/dashboard', t.dashboard, LayoutDashboard],
      ['/tools', t.tools, Wand2],
      ['/pricing', t.pricing, CreditCard],
      ['/settings', t.settings, Settings]
    ] as const;
    if (profile?.plan === 'Max') return [...base, ['/admin', lang === 'ar' ? 'الإدارة' : 'Admin', Activity]] as const;
    return base;
  }, [t, profile?.plan, lang]);

  const drawer = (
    <aside className="drawer-surface h-full w-full max-w-md overflow-y-auto px-4 py-5">
      <div className="mb-6 flex items-center justify-between">
        <button className="rounded-full border border-white/10 bg-white/5 p-3" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        <div className="text-xl font-black">Qalvero AI</div>
      </div>

      <div className="panel rounded-[2rem] p-5 text-center">
        <div className="flex justify-center"><UserAvatar size="lg" /></div>
        <div className="mt-3 text-3xl font-black">{displayName}</div>
        <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        {isGuest ? (
          <Link to="/login" onClick={() => setOpen(false)} className="btn btn-primary mt-5 w-full"><LogIn size={17} /> {t.login}</Link>
        ) : (
          <button className="btn btn-soft mt-5 w-full" onClick={signOut}><LogOut size={17} /> {t.logout}</button>
        )}
      </div>

      <div className="mt-6 text-sm font-bold text-slate-400">{t.home}</div>
      <div className="mt-3">
        {nav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `row-card setting-row ${isActive ? 'border-white/20 bg-white/10' : ''}`}>
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-white/5"><Icon size={18} /></div><div className="font-bold">{label}</div></div>
            <div className="text-slate-400">›</div>
          </NavLink>
        ))}
      </div>

      <div className="mt-6 text-sm font-bold text-slate-400">{t.settings}</div>
      <div className="mt-3 space-y-3">
        <div className="row-card setting-row"><div className="flex items-center gap-3"><Globe2 size={18} /><div className="meta"><div className="title">{t.language}</div></div></div><select className="chip max-w-[180px] py-2" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{langs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div className="row-card setting-row"><div className="flex items-center gap-3"><MoonStar size={18} /><div className="meta"><div className="title">{t.theme}</div><div className="desc">{themeText[theme][lang]}</div></div></div><select className="chip max-w-[180px] py-2" value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>{(['system', 'dark', 'light'] as ThemeMode[]).map((item) => <option key={item} value={item}>{themeText[item][lang]}</option>)}</select></div>
        <div className="row-card setting-row"><div className="flex items-center gap-3"><Palette size={18} /><div className="meta"><div className="title">{t.accent}</div><div className="desc">{accents.find((a) => a.id === accent)?.label[lang]}</div></div></div><select className="chip max-w-[180px] py-2" value={accent} onChange={(e) => setAccent(e.target.value as AccentColor)}>{accents.map((item) => <option key={item.id} value={item.id}>{item.label[lang]}</option>)}</select></div>
        <div className="row-card setting-row"><div className="flex items-center gap-3"><SunMedium size={18} /><div className="meta"><div className="title">{t.country}</div><div className="desc">{profile ? (lang === 'ar' ? 'مربوطة بالحساب' : 'Linked to account') : (lang === 'ar' ? 'سجّل دخول لتغييرها' : 'Login to change')}</div></div></div>{profile ? <span className="qlo-fixed-country-badge">{country}</span> : <span className="soft-text text-sm">{country}</span>}</div>
      </div>


      <div className="mt-6 text-sm font-bold text-slate-400">{lang === 'ar' ? 'الشركة والقوانين' : 'Company & legal'}</div>
      <div className="mt-3 space-y-3">
        <Link to="/settings#company" onClick={() => setOpen(false)} className="row-card setting-row"><div className="flex items-center gap-3"><Sparkles size={18} /><div className="font-bold">{lang === 'ar' ? 'عن Qalvero AI' : 'About Qalvero AI'}</div></div><span className="soft-text">›</span></Link>
        <Link to="/legal" onClick={() => setOpen(false)} className="row-card setting-row"><div className="flex items-center gap-3"><Shield size={18} /><div className="font-bold">{t.legal}</div></div><span className="soft-text">›</span></Link>
      </div>
    </aside>
  );

  if (isAuthRoute) return <div className="bubble">{children}</div>;

  return (
    <div className="bubble">
      <header className="sticky top-0 z-40 px-5 pt-5 md:px-8 md:pt-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          {location.pathname === '/settings' ? (
            <>
              <button
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5"
              >
                <ArrowLeft size={28} />
              </button>
              <div className="text-center">
                <div className="mt-1 text-2xl font-black tracking-tight">{t.settings}</div>
              </div>
              {/* Spacer to keep layout aligned */}
              <div className="h-12 w-12"></div>
            </>
          ) : (
            <>
              <Link to={isGuest ? '/login' : '/settings'} aria-label="Account"><UserAvatar size="sm" /></Link>
              <Link to="/" className="text-center">
                <img src="/favicon.svg" alt="Qalvero AI" className="mx-auto h-12 w-12 object-contain drop-shadow-[0_0_18px_var(--accent-glow)]" />
                <div className="mt-1 text-2xl font-black tracking-tight">Qalvero AI</div>
              </Link>
              <button onClick={() => setOpen(true)} aria-label="Open navigation" className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5"><Menu size={28} /></button>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-8">{children}</div>

      {open && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}><div className="ms-auto h-full w-[92%] max-w-md" onClick={(e) => e.stopPropagation()}>{drawer}</div></div>}
    </div>
  );
}
