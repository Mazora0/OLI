import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, Brain, Globe2, LogIn, LogOut, Mail, Palette, Save, Sparkles, SunMoon, UserRound, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp, type AccentColor, type ThemeMode } from '../context/AppContext';
import { hasSupabase, supabase, getAccessToken } from '../lib/supabase';
import { countries, currencyOf, type Country } from '../lib/pricing';
import { labels, type Lang } from '../lib/i18n';
import { avatarOptions, getAvatar } from '../lib/avatars';

type Memory = { display_name?: string; goals?: string; study_level?: string; interests?: string; location?: string; tone?: string; projects?: string[]; notes?: string[]; updated_at?: string };

const langs = [['en', 'English'], ['ar', 'العربية'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['tr', 'Türkçe'], ['ja', '日本語']] as const;
const themeText: Record<ThemeMode, Record<Lang, string>> = {
  system: { en: 'System (default)', ar: 'النظام (افتراضي)', fr: 'Système', es: 'Sistema', de: 'System', tr: 'Sistem', ja: 'システム' },
  dark: { en: 'Dark', ar: 'داكن', fr: 'Sombre', es: 'Oscuro', de: 'Dunkel', tr: 'Koyu', ja: 'ダーク' },
  light: { en: 'Light', ar: 'فاتح', fr: 'Clair', es: 'Claro', de: 'Hell', tr: 'Açık', ja: 'ライト' }
};
const accents: { id: AccentColor; label: Record<Lang, string> }[] = [
  { id: 'orange', label: { en: 'Orange', ar: 'برتقالي', fr: 'Orange', es: 'Naranja', de: 'Orange', tr: 'Turuncu', ja: 'オレンジ' } },
  { id: 'violet', label: { en: 'Violet', ar: 'بنفسجي', fr: 'Violet', es: 'Violeta', de: 'Violett', tr: 'Mor', ja: 'バイオレット' } },
  { id: 'blue', label: { en: 'Blue', ar: 'أزرق', fr: 'Bleu', es: 'Azul', de: 'Blau', tr: 'Mavi', ja: 'ブルー' } },
  { id: 'emerald', label: { en: 'Emerald', ar: 'زمردي', fr: 'Émeraude', es: 'Esmeralda', de: 'Smaragd', tr: 'Zümrüt', ja: 'エメラルド' } }
];

const pageCopy = {
  ar: {
    profileTitle: 'حساب Qalvero AI', personalization: 'تخصيص', memory: 'ذاكرة QLO', account: 'الحساب', workspace: 'مساحة العمل', notificationsDesc: 'إشعارات التطبيق',
    memoryDesc: 'الذاكرة بتتحدث تلقائيًا من الشات لما تقول اسمك، دراستك، هدفك، بلدك، أو اهتماماتك. تقدر تعدلها يدويًا هنا.', saveMemory: 'حفظ ذاكرة QLO', saveAll: 'حفظ الإعدادات', email: 'البريد الإلكتروني', billingCountry: 'بلد الفوترة', loginToChangeCountry: 'سجّل دخول عشان تغيّر البلد. البلد هنا مربوطة بالحساب مش بالجهاز.', plan: 'الخطة', compactMemory: 'ذاكرة مختصرة', preferredName: 'الاسم المفضل', goals: 'هدفك الأساسي', level: 'المرحلة / الدور', interests: 'الاهتمامات', location: 'المكان / البلد', autoNotes: 'ملاحظات محفوظة من الشات', noNotes: 'لسه مفيش ملاحظات محفوظة تلقائيًا.', tone: 'أسلوب الرد', tonePlaceholder: 'اختر أسلوب الرد', toneOptions: ['مباشر وقصير', 'شرح مفصل', 'احترافي', 'عامية مصرية'], saved: 'تم حفظ الإعدادات.', logout: 'تسجيل الخروج', login: 'تسجيل الدخول', guest: 'ضيف', notSigned: 'غير مسجل الدخول', avatar: 'الصورة الكرتونية', loginForAvatar: 'سجّل دخول عشان تختار صورة الحساب.'
  },
  en: {
    profileTitle: 'Qalvero AI account', personalization: 'Personalization', memory: 'QLO memory', account: 'Account', workspace: 'Workspace', notificationsDesc: 'App notifications',
    memoryDesc: 'Memory updates automatically from chat when you mention your name, study level, goals, location, or interests. You can edit it manually here.', saveMemory: 'Save QLO memory', saveAll: 'Save settings', email: 'Email', billingCountry: 'Billing country', loginToChangeCountry: 'Login to change the country. Billing country is linked to the account, not this device.', plan: 'Plan', compactMemory: 'Compact memory', preferredName: 'Preferred name', goals: 'Main goal', level: 'Study level / role', interests: 'Interests', location: 'Location / country', autoNotes: 'Notes saved from chat', noNotes: 'No auto-saved notes yet.', tone: 'Reply style', tonePlaceholder: 'Choose reply style', toneOptions: ['Direct and short', 'Detailed teacher', 'Professional', 'Casual'], saved: 'Settings saved.', logout: 'Logout', login: 'Login', guest: 'Guest', notSigned: 'Not signed in', avatar: 'Cartoon avatar', loginForAvatar: 'Login to choose your account avatar.'
  }
} as const;

function Row({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return <div className="row-card setting-row"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-white/5">{icon}</div><div className="meta"><div className="title">{title}</div>{desc && <div className="desc">{desc}</div>}</div></div>{action}</div>;
}

export default function SettingsPage() {
  const { lang, setLang, theme, setTheme, accent, setAccent, country, setCountry, profile, refreshProfile, signOut } = useApp();
  const t = labels[lang];
  const copy = lang === 'ar' ? pageCopy.ar : pageCopy.en;
  const [memory, setMemory] = useState<Memory>({});
  const [msg, setMsg] = useState('');
  const [notifications, setNotifications] = useState(localStorage.getItem('qv_notifications') !== 'off');
  const avatar = getAvatar(profile?.avatar_id);
  const displayName = profile?.full_name || profile?.email || copy.guest;
  const displayEmail = profile?.email || copy.notSigned;

  useEffect(() => { loadMemory(); }, []);

  async function loadMemory() {
    const token = await getAccessToken();
    if (!token) return;
    const r = await fetch('/api/memory', { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (data.memory) setMemory(data.memory);
  }

  async function saveMemory() {
    setMsg('');
    const token = await getAccessToken();
    if (!token) return setMsg(lang === 'ar' ? 'سجّل دخول الأول عشان تحفظ الذاكرة.' : 'Login first to save memory.');
    const r = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ memory }) });
    const data = await r.json();
    setMsg(data.error || copy.saved);
  }

  async function saveProfile() {
    localStorage.setItem('qv_notifications', notifications ? 'on' : 'off');
    if (!profile?.id) return setMsg(copy.loginToChangeCountry);
    if (hasSupabase && supabase) {
      await supabase.from('qv_profiles').update({ country, currency: currencyOf(country) }).eq('id', profile.id);
      await refreshProfile();
    }
    setMsg(copy.saved);
  }

  async function chooseAvatar(id: string) {
    if (!profile?.id || !supabase) return setMsg(copy.loginForAvatar);
    await supabase.from('qv_profiles').update({ avatar_id: id }).eq('id', profile.id);
    await refreshProfile();
    setMsg(copy.saved);
  }

  const langLabel = useMemo(() => langs.find(([id]) => id === lang)?.[1] || 'English', [lang]);
  const accentLabel = useMemo(() => accents.find((a) => a.id === accent)?.label[lang], [accent, lang]);

  return (
    <section className="mx-auto max-w-4xl pb-10">
      <div className="panel rounded-[2.2rem] p-6 text-center md:p-8">
        <div className={`mx-auto avatar-ring h-[104px] w-[104px] overflow-hidden`}><div className={`avatar-core grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${profile ? avatar.gradient : 'from-slate-800 to-slate-950'} text-5xl`}>{profile ? avatar.emoji : 'Q'}</div></div>
        <div className="mt-4 text-3xl font-black">{displayName}</div>
        <div className="mt-2 text-sm text-slate-400">{displayEmail}</div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold"><Sparkles size={15} className="text-[var(--accent-1)]" />{copy.profileTitle}</div>
        {!profile && <Link to="/login" className="btn btn-primary mx-auto mt-5 w-full max-w-xs"><LogIn size={17}/>{copy.login}</Link>}
      </div>

      <div className="mt-8 text-lg font-black strong-muted">{copy.personalization}</div>
      <div className="mt-3 space-y-3">
        <Row icon={<Globe2 size={18} />} title={t.language} desc={langLabel} action={<select className="chip max-w-[190px] py-2" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>{langs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>} />
        <Row icon={<SunMoon size={18} />} title={t.theme} desc={themeText[theme][lang]} action={<select className="chip max-w-[190px] py-2" value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>{(['system', 'dark', 'light'] as ThemeMode[]).map((item) => <option key={item} value={item}>{themeText[item][lang]}</option>)}</select>} />
        <Row icon={<Palette size={18} />} title={t.accent} desc={accentLabel} action={<select className="chip max-w-[190px] py-2" value={accent} onChange={(e) => setAccent(e.target.value as AccentColor)}>{accents.map((item) => <option key={item.id} value={item.id}>{item.label[lang]}</option>)}</select>} />
      </div>

      <div className="mt-8 text-lg font-black strong-muted">{copy.avatar}</div>
      <div className="panel mt-3 rounded-[2rem] p-4">
        {profile ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{avatarOptions.map((item) => <button key={item.id} onClick={() => chooseAvatar(item.id)} className={`rounded-[1.4rem] border p-3 text-center ${profile.avatar_id === item.id ? 'border-[var(--accent-1)] bg-white/10' : 'border-white/10 bg-white/5'}`}><div className={`mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br ${item.gradient} text-3xl`}>{item.emoji}</div><div className="mt-2 text-[11px] font-bold soft-text">{item.label}</div></button>)}</div> : <div className="text-sm soft-text">{copy.loginForAvatar}</div>}
      </div>

      <div className="mt-8 text-lg font-black strong-muted">{copy.account}</div>
      <div className="mt-3 space-y-3">
        <Row icon={<WalletCards size={18} />} title={copy.workspace} desc={profile?.plan || 'Guest'} action={<span className="soft-text text-sm">{copy.plan}</span>} />
        <Row icon={<Mail size={18} />} title={copy.email} desc={displayEmail} />
        <Row icon={<Globe2 size={18} />} title={copy.billingCountry} desc={profile ? `${country} · ${currencyOf(country)}` : copy.loginToChangeCountry} action={profile ? <select className="chip max-w-[190px] py-2" value={country} onChange={(e) => setCountry(e.target.value as Country)}>{countries.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select> : <span className="soft-text text-sm">{country}</span>} />
        <Row icon={<Bell size={18} />} title={t.notifications} desc={copy.notificationsDesc} action={<button className={`btn ${notifications ? 'btn-primary' : 'btn-soft'} min-w-[116px]`} onClick={() => setNotifications((s) => !s)}>{notifications ? 'On' : 'Off'}</button>} />
        {profile && <button onClick={signOut} className="row-card setting-row w-full text-start"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-white/5"><LogOut size={18} /></div><div className="title">{copy.logout}</div></div><span className="soft-text">›</span></button>}
      </div>

      <div className="mt-8 text-lg font-black strong-muted">{copy.memory}</div>
      <div className="panel mt-3 rounded-[2rem] p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2 text-xl font-black"><Brain className="text-[var(--accent-1)]" /> {copy.compactMemory}</div>
        <p className="mb-5 text-sm leading-6 text-slate-400">{copy.memoryDesc}</p>
        <div className="grid gap-3 md:grid-cols-2"><input className="field" placeholder={copy.preferredName} value={memory.display_name || ''} onChange={(e) => setMemory({ ...memory, display_name: e.target.value })} /><input className="field" placeholder={copy.goals} value={memory.goals || ''} onChange={(e) => setMemory({ ...memory, goals: e.target.value })} /><input className="field" placeholder={copy.level} value={memory.study_level || ''} onChange={(e) => setMemory({ ...memory, study_level: e.target.value })} /><input className="field" placeholder={copy.interests} value={memory.interests || ''} onChange={(e) => setMemory({ ...memory, interests: e.target.value })} /><input className="field md:col-span-2" placeholder={copy.location} value={memory.location || ''} onChange={(e) => setMemory({ ...memory, location: e.target.value })} /></div>
        <div className="mt-3"><select className="field" value={memory.tone || ''} onChange={(e) => setMemory({ ...memory, tone: e.target.value })}><option value="">{copy.tonePlaceholder}</option>{copy.toneOptions.map((tone) => <option key={tone}>{tone}</option>)}</select></div>
        <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4"><div className="mb-2 text-sm font-black">{copy.autoNotes}</div>{memory.notes?.length ? <div className="grid gap-2">{memory.notes.slice(-5).reverse().map((note, i) => <div key={`${note}-${i}`} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm soft-text">{note}</div>)}</div> : <div className="text-sm soft-text">{copy.noNotes}</div>}</div>
        <div className="mt-5 flex flex-wrap gap-3"><button className="btn btn-primary" onClick={saveMemory}><UserRound size={18} /> {copy.saveMemory}</button><button className="btn btn-soft" onClick={saveProfile}><Save size={18} /> {copy.saveAll}</button></div>
      </div>

      <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{msg || 'Qalvero AI'}</div>
    </section>
  );
}
