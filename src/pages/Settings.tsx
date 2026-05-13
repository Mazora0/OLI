import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, Brain, Database, Download, Globe2, LogIn, LogOut, Mail, Palette, Save, Sparkles, SunMoon, Trash2, UserRound, WalletCards, Shield, Cloud, PlayCircle, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp, type AccentColor, type ThemeMode } from '../context/AppContext';
import { hasSupabase, supabase, getAccessToken } from '../lib/supabase';
import { currencyOf } from '../lib/pricing';
import { labels, type Lang } from '../lib/i18n';
import { avatarOptions, getAvatar } from '../lib/avatars';

type Memory = { display_name?: string; goals?: string; study_level?: string; interests?: string; location?: string; tone?: string; projects?: string[]; notes?: string[]; updated_at?: string };
type TrainingStats = { count?: number; bytes?: number; max_bytes?: number; languages?: Record<string, number> };
type ChatStorageStats = { localThreads: number; localBytes: number; cloudThreads?: number; cloudRetentionDays?: number; localRetentionDays: number; plan: string };
type CloudTrainingStatus = { configured?: boolean; project_id?: string | null; bucket?: string | null; region?: string | null; auto_sync?: boolean; vertex_ready?: boolean };
type McpStatus = { enabled?: boolean; endpoint?: string; localTools?: number; resources?: number; prompts?: number; remoteServers?: { id: string; name: string; safe?: boolean }[]; strict?: Record<string, boolean> };
type UserAiProvider = 'gemini' | 'openrouter' | 'groq' | 'deepseek';
type UserAiSettings = { enabled: boolean; provider: UserAiProvider; apiKey: string; model?: string; useForAgent: boolean; savedAt?: string };

const userAiProviders: { id: UserAiProvider; label: string; modelHint: string }[] = [
  { id: 'gemini', label: 'Gemini API', modelHint: 'gemini-2.5-flash' },
  { id: 'openrouter', label: 'OpenRouter', modelHint: 'openrouter/auto' },
  { id: 'groq', label: 'Groq', modelHint: 'llama-3.3-70b-versatile' },
  { id: 'deepseek', label: 'DeepSeek', modelHint: 'deepseek-chat' }
];

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

function encodeLocalSecret(value: string) {
  try { return btoa(unescape(encodeURIComponent(value))); } catch { return ''; }
}
function decodeLocalSecret(value: string) {
  try { return decodeURIComponent(escape(atob(value))); } catch { return ''; }
}
function loadUserAiSettings(): UserAiSettings {
  try {
    const raw = localStorage.getItem('qv_user_ai_key');
    if (!raw) return { enabled: false, provider: 'gemini', apiKey: '', model: '', useForAgent: false };
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      provider: userAiProviders.some((p) => p.id === parsed.provider) ? parsed.provider : 'gemini',
      apiKey: decodeLocalSecret(parsed.apiKey || ''),
      model: parsed.model || '',
      useForAgent: Boolean(parsed.useForAgent),
      savedAt: parsed.savedAt
    };
  } catch {
    return { enabled: false, provider: 'gemini', apiKey: '', model: '', useForAgent: false };
  }
}
function saveUserAiSettingsLocal(settings: UserAiSettings) {
  localStorage.setItem('qv_user_ai_key', JSON.stringify({
    ...settings,
    apiKey: encodeLocalSecret(settings.apiKey.trim()),
    savedAt: new Date().toISOString()
  }));
}
function clearUserAiSettingsLocal() { localStorage.removeItem('qv_user_ai_key'); }

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
  const { lang, setLang, theme, setTheme, accent, setAccent, country, profile, refreshProfile, signOut } = useApp();
  const t = labels[lang];
  const copy = lang === 'ar' ? pageCopy.ar : pageCopy.en;
  const [memory, setMemory] = useState<Memory>({});
  const [msg, setMsg] = useState('');
  const [notifications, setNotifications] = useState(localStorage.getItem('qv_notifications') !== 'off');
  const [trainingEnabled, setTrainingEnabled] = useState(localStorage.getItem('qv_qlo1_training_enabled') !== 'off');
  const [advancedTrainingOpen, setAdvancedTrainingOpen] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingStats>({});
  const [chatStorageStats, setChatStorageStats] = useState<ChatStorageStats>({ localThreads: 0, localBytes: 0, localRetentionDays: 60, plan: 'Free' });
  const [cloudStatus, setCloudStatus] = useState<CloudTrainingStatus>({});
  const [cloudBusy, setCloudBusy] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<McpStatus>({});
  const [mcpBusy, setMcpBusy] = useState(false);
  const [userAi, setUserAi] = useState<UserAiSettings>(() => loadUserAiSettings());
  const [userAiShowKey, setUserAiShowKey] = useState(false);
  const [userAiTest, setUserAiTest] = useState('');
  const avatar = getAvatar(profile?.avatar_id);
  const displayName = profile?.full_name || profile?.email || copy.guest;
  const displayEmail = profile?.email || copy.notSigned;

  useEffect(() => { loadMemory(); loadTrainingStats(); loadCloudTrainingStatus(); loadMcpStatus(); loadChatStorageStats(); }, []);
  useEffect(() => { loadChatStorageStats(); }, [profile?.plan]);
  useEffect(() => { localStorage.setItem('qv_qlo1_training_enabled', trainingEnabled ? 'on' : 'off'); }, [trainingEnabled]);


  function getLocalChatRetentionDays() {
    return profile?.plan === 'Free' || !profile?.plan ? 60 : 180;
  }

  function loadChatStorageStats() {
    const raw = localStorage.getItem('qv_threads') || '[]';
    let threads: any[] = [];
    try { threads = JSON.parse(raw); } catch { threads = []; }
    setChatStorageStats((prev) => ({
      ...prev,
      localThreads: Array.isArray(threads) ? threads.length : 0,
      localBytes: new Blob([raw]).size,
      localRetentionDays: getLocalChatRetentionDays(),
      plan: profile?.plan || 'Free'
    }));
    void loadCloudChatStorageStats();
  }

  async function loadCloudChatStorageStats() {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const r = await fetch('/api/qlo-chat-history', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.error) {
        setChatStorageStats((prev) => ({ ...prev, cloudThreads: Array.isArray(data.threads) ? data.threads.length : 0, cloudRetentionDays: data.cloud_retention_days || 10 }));
      }
    } catch { /* cloud history is optional */ }
  }

  function clearLocalChatHistory() {
    localStorage.removeItem('qv_threads');
    localStorage.removeItem('qv_threads_meta');
    loadChatStorageStats();
    setMsg(lang === 'ar' ? 'تم مسح سجل الشات المحلي من هذا الجهاز.' : 'Local chat history cleared on this device.');
  }

  async function clearCloudChatHistory() {
    const token = await getAccessToken();
    if (!token) return setMsg(lang === 'ar' ? 'سجّل دخول الأول لمسح سجل الحساب السحابي.' : 'Login first to clear cloud chat history.');
    try {
      await fetch('/api/qlo-chat-history', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await loadCloudChatStorageStats();
      setMsg(lang === 'ar' ? 'تم مسح سجل الشات السحابي.' : 'Cloud chat history cleared.');
    } catch {
      setMsg(lang === 'ar' ? 'فشل مسح سجل الشات السحابي.' : 'Failed to clear cloud chat history.');
    }
  }

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


  const userAiAvailable = Boolean(profile?.email) && ['Standard', 'Premium', 'Max'].includes(profile?.plan || 'Free');

  function validateUserAiSettings(settings = userAi) {
    if (!settings.enabled) return '';
    if (!userAiAvailable) return lang === 'ar' ? 'المفاتيح الشخصية متاحة للحسابات المسجلة على Standard أو Premium أو Max فقط.' : 'Personal AI keys are available only for signed-in Standard, Premium, or Max accounts.';
    if (!settings.apiKey.trim() || settings.apiKey.trim().length < 12) return lang === 'ar' ? 'اكتب API key صحيح قبل التفعيل.' : 'Add a valid API key before enabling this.';
    if (!userAiProviders.some((p) => p.id === settings.provider)) return lang === 'ar' ? 'المزود غير مدعوم.' : 'Unsupported provider.';
    if (settings.model && !/^[A-Za-z0-9._:/@+\-]{2,90}$/.test(settings.model.trim())) return lang === 'ar' ? 'اسم الموديل غير مقبول.' : 'Model name is not accepted.';
    return '';
  }

  function saveUserAiSettings() {
    const validation = validateUserAiSettings(userAi);
    if (validation) { setUserAiTest(validation); return; }
    saveUserAiSettingsLocal(userAi);
    setUserAiTest(lang === 'ar' ? 'تم حفظ المفتاح على هذا الجهاز فقط. Qalvero لا يخزنه على السيرفر.' : 'Saved on this device only. Qalvero does not store it on the server.');
  }

  function clearUserAiSettings() {
    clearUserAiSettingsLocal();
    setUserAi({ enabled: false, provider: 'gemini', apiKey: '', model: '', useForAgent: false });
    setUserAiTest(lang === 'ar' ? 'تم حذف المفتاح من هذا الجهاز.' : 'Key removed from this device.');
  }

  async function testUserAiSettings() {
    const validation = validateUserAiSettings(userAi);
    if (validation) { setUserAiTest(validation); return; }
    setUserAiTest(lang === 'ar' ? 'جاري الفحص...' : 'Testing...');
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/qalvero-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: 'Reply with OK only.', history: [], model: 'QLO 1.2 Flash', mode: 'Auto', language: 'en', userAi: { provider: userAi.provider, apiKey: userAi.apiKey, model: userAi.model, enabled: true, test: true } })
      });
      const data = await r.json();
      setUserAiTest(r.ok ? (lang === 'ar' ? 'المفتاح شغال.' : 'Key works.') : (data.error || (lang === 'ar' ? 'فشل الاختبار.' : 'Test failed.')));
    } catch {
      setUserAiTest(lang === 'ar' ? 'فشل الاتصال أثناء الاختبار.' : 'Connection failed during test.');
    }
  }

  function formatBytes(bytes = 0) {
    if (!bytes) return '0 MB';
    const mb = bytes / 1024 / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  function downloadTextFile(name: string, content: string, type = 'application/jsonl') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadTrainingStats() {
    const token = await getAccessToken();
    const localRows = JSON.parse(localStorage.getItem('qv_qlo1_training_local') || '[]');
    if (!token) {
      setTrainingStats({ count: localRows.length, bytes: JSON.stringify(localRows).length, languages: {} });
      return;
    }
    try {
      const r = await fetch('/api/qlo-training', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.error) setTrainingStats(data);
    } catch {
      setTrainingStats({ count: localRows.length, bytes: JSON.stringify(localRows).length, languages: {} });
    }
  }

  async function exportTrainingDataset() {
    const token = await getAccessToken();
    try {
      if (token) {
        const r = await fetch('/api/qlo-training?format=jsonl', { headers: { Authorization: `Bearer ${token}` } });
        const text = await r.text();
        downloadTextFile('qlo-1-training-dataset.jsonl', text || '');
        return;
      }
    } catch { /* fallback below */ }
    const localRows = JSON.parse(localStorage.getItem('qv_qlo1_training_local') || '[]');
    downloadTextFile('qlo-1-local-training-dataset.jsonl', localRows.map((row: unknown) => JSON.stringify(row)).join('\n'));
  }

  async function clearTrainingDataset() {
    localStorage.removeItem('qv_qlo1_training_local');
    const token = await getAccessToken();
    if (token) {
      try { await fetch('/api/qlo-training', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch { /* ignore */ }
    }
    await loadTrainingStats();
    setMsg(lang === 'ar' ? 'تم مسح أمثلة تدريب QLO 1.' : 'QLO 1 training examples cleared.');
  }


  async function loadMcpStatus() {
    setMcpBusy(true);
    try {
      const r = await fetch('/api/qlo-mcp?action=status');
      const data = await r.json();
      if (!data.error) setMcpStatus(data);
    } catch {
      setMcpStatus({ enabled: false });
    } finally {
      setMcpBusy(false);
    }
  }

  async function loadCloudTrainingStatus() {
    try {
      const r = await fetch('/api/qlo-google-cloud-training');
      const data = await r.json();
      setCloudStatus(data || {});
    } catch {
      setCloudStatus({ configured: false });
    }
  }

  async function syncDatasetToGoogleCloud(startTraining = false) {
    setCloudBusy(true);
    setMsg('');
    try {
      const token = await getAccessToken();
      if (!token) return setMsg(lang === 'ar' ? 'سجّل دخول الأول عشان تزامن الداتا مع Google Cloud.' : 'Login first to sync the dataset with Google Cloud.');
      const r = await fetch('/api/qlo-google-cloud-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: startTraining ? 'start' : 'sync' })
      });
      const data = await r.json();
      if (!r.ok || data.error) return setMsg(data.error || (lang === 'ar' ? 'فشل الاتصال بـ Google Cloud.' : 'Google Cloud sync failed.'));
      setMsg(startTraining
        ? (lang === 'ar' ? `تم رفع الداتا ومحاولة بدء تدريب QLO 1. Dataset: ${data.dataset_uri || 'ready'}` : `Dataset synced and QLO 1 training start requested. Dataset: ${data.dataset_uri || 'ready'}`)
        : (lang === 'ar' ? `تم حفظ Dataset تلقائيًا على Google Cloud: ${data.dataset_uri}` : `Dataset saved to Google Cloud: ${data.dataset_uri}`));
      await loadCloudTrainingStatus();
    } catch (error: any) {
      setMsg(error?.message || (lang === 'ar' ? 'حصل خطأ أثناء مزامنة Google Cloud.' : 'Google Cloud sync error.'));
    } finally {
      setCloudBusy(false);
    }
  }

  async function saveProfile() {
    localStorage.setItem('qv_notifications', notifications ? 'on' : 'off');
    if (!profile?.id) return setMsg(copy.loginToChangeCountry);
    await refreshProfile();
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
    <section className="qlo-settings-page mx-auto w-full max-w-4xl overflow-x-hidden pb-10">
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
        <Row icon={<Globe2 size={18} />} title={copy.billingCountry} desc={profile ? `${country} · ${currencyOf(country)}` : copy.loginToChangeCountry} action={<span className="qlo-fixed-country-badge">{country}</span>} />
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

      <div className="mt-8 text-lg font-black strong-muted">{lang === 'ar' ? 'خيارات متقدمة' : 'Advanced options'}</div>
      <details
        className="panel mt-3 rounded-[2rem] p-5 md:p-6"
        open={advancedTrainingOpen}
        onToggle={(e) => setAdvancedTrainingOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xl font-black"><Database className="text-[var(--accent-1)]" /> {lang === 'ar' ? 'QLO 1 Training Lab' : 'QLO 1 Training Lab'}</div>
              <p className="mt-2 text-sm leading-6 soft-text">
                {lang === 'ar'
                  ? 'وضع مطور مخفي داخل الخيارات المتقدمة. التجميع مفعّل تلقائيًا، وتقدر توقفه من هنا.'
                  : 'A developer-focused area inside Advanced options. Collection is on by default and can be turned off here.'}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black soft-text">{advancedTrainingOpen ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'فتح' : 'Open')}</span>
          </div>
        </summary>

        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center gap-2 text-xl font-black"><Database className="text-[var(--accent-1)]" /> {lang === 'ar' ? 'تخزين الشات المحلي والسحابي' : 'Local-first chat storage'}</div>
          <p className="text-sm leading-6 soft-text">
            {lang === 'ar'
              ? 'Qalvero يحفظ سجل الشات بأسلوب Local-First: السجل الطويل يفضل على جهاز المستخدم، والنسخة السحابية مختصرة ويتم تنظيفها بعد 10 أيام لتقليل استهلاك Supabase وVercel. مستخدم Free يتم تنظيف سجله المحلي تلقائيًا كل 60 يوم.'
              : 'Qalvero keeps chat history local-first: long-term history stays on the user device, while compact cloud sync is cleaned after 10 days to protect Supabase and Vercel limits. Free users get automatic local cleanup every 60 days.'}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'محلي' : 'Local'}</div><div className="mt-1 text-2xl font-black">{chatStorageStats.localThreads}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'الحجم' : 'Size'}</div><div className="mt-1 text-2xl font-black">{formatBytes(chatStorageStats.localBytes)}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'تنظيف محلي' : 'Local cleanup'}</div><div className="mt-1 text-2xl font-black">{chatStorageStats.localRetentionDays}d</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'سحابي' : 'Cloud'}</div><div className="mt-1 text-2xl font-black">{chatStorageStats.cloudRetentionDays || 10}d</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-soft" onClick={loadChatStorageStats}><Database size={18} /> {lang === 'ar' ? 'تحديث التخزين' : 'Refresh storage'}</button>
            <button className="btn btn-soft" onClick={clearLocalChatHistory}><Trash2 size={18} /> {lang === 'ar' ? 'مسح المحلي' : 'Clear local'}</button>
            <button className="btn btn-soft" onClick={clearCloudChatHistory}><Trash2 size={18} /> {lang === 'ar' ? 'مسح السحابي' : 'Clear cloud'}</button>
          </div>
        </div>

        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center gap-2 text-xl font-black"><Database className="text-[var(--accent-1)]" /> {lang === 'ar' ? 'تجميع أمثلة تدريب نظيفة' : 'Clean training examples'}</div>
          <p className="text-sm leading-6 soft-text">
            {lang === 'ar'
              ? 'النظام يحفظ أمثلة سؤال/رد مختصرة من الشات بالإنجليزي والعربي الفصحى والعامية المصرية عشان تقدر تصدرها بعدين كـ JSONL وتستخدمها في تدريب QLO 1 خارجيًا. لا يتم تدريب موديل داخل Vercel؛ هنا بنجمع الداتا النظيفة فقط.'
              : 'This saves compact prompt/response examples from chat in English, Modern Standard Arabic, and Egyptian Arabic so you can export them later as JSONL for external QLO 1 fine-tuning. It does not train a model inside Vercel; it prepares clean data.'}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'الأمثلة' : 'Examples'}</div><div className="mt-1 text-2xl font-black">{trainingStats.count || 0}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'المستخدم' : 'Used'}</div><div className="mt-1 text-2xl font-black">{formatBytes(trainingStats.bytes || 0)}</div></div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4"><div className="text-xs font-black soft-text">{lang === 'ar' ? 'الحد التقريبي' : 'Approx limit'}</div><div className="mt-1 text-2xl font-black">{formatBytes(trainingStats.max_bytes || 8 * 1024 * 1024 * 1024)}</div></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={`btn ${trainingEnabled ? 'btn-primary' : 'btn-soft'}`} onClick={() => setTrainingEnabled((v) => !v)}><Brain size={18} /> {trainingEnabled ? (lang === 'ar' ? 'التجميع شغال تلقائيًا' : 'Auto collection on') : (lang === 'ar' ? 'التجميع متوقف' : 'Collection off')}</button>
            <button className="btn btn-soft" onClick={exportTrainingDataset}><Download size={18} /> {lang === 'ar' ? 'تصدير JSONL' : 'Export JSONL'}</button>
            <button className="btn btn-soft" onClick={loadTrainingStats}><Database size={18} /> {lang === 'ar' ? 'تحديث الإحصائيات' : 'Refresh stats'}</button>
            <button className="btn btn-soft" onClick={clearTrainingDataset}><Trash2 size={18} /> {lang === 'ar' ? 'مسح الداتا' : 'Clear data'}</button>
          </div>
          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-lg font-black"><Sparkles className="text-[var(--accent-1)]" /> MCP</div>
            <p className="text-sm leading-6 soft-text">
              {lang === 'ar'
                ? 'طبقة MCP حقيقية وصارمة داخل Qalvero AI: أدوات، موارد، Prompts، وسيرفر JSON-RPC آمن مع دعم Remote MCP من allowlist فقط.'
                : 'A strict real MCP layer inside Qalvero AI: tools, resources, prompts, and a secure JSON-RPC server with allowlisted remote MCP support only.'}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Endpoint</div><div className="mt-1 truncate text-sm font-black">{mcpStatus.endpoint || '/api/mcp'}</div></div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Tools</div><div className="mt-1 truncate text-sm font-black">{mcpStatus.localTools ?? 0}</div></div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Resources</div><div className="mt-1 truncate text-sm font-black">{mcpStatus.resources ?? 0}</div></div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Remote</div><div className="mt-1 truncate text-sm font-black">{mcpStatus.remoteServers?.length || 0}</div></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-soft" disabled={mcpBusy} onClick={loadMcpStatus}><Sparkles size={18} /> {lang === 'ar' ? 'فحص MCP' : 'Check MCP'}</button>
              <a className="btn btn-soft" href="/api/mcp" target="_blank" rel="noreferrer"><Globe2 size={18} /> {lang === 'ar' ? 'فتح Endpoint' : 'Open endpoint'}</a>
            </div>
            <div className="mt-3 text-xs leading-6 soft-text">
              {lang === 'ar'
                ? 'الأمان صارم: لا STDIO من الشات، لا localhost، لا مفاتيح في المتصفح، والاتصال الخارجي بس من QLO_MCP_SERVERS_JSON.'
                : 'Strict security: no chat-triggered STDIO, no localhost, no browser secrets, and external connections only from QLO_MCP_SERVERS_JSON.'}
            </div>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-lg font-black"><KeyRound className="text-[var(--accent-1)]" /> {lang === 'ar' ? 'مفتاح AI شخصي' : 'Personal AI key'}</div>
            <p className="text-sm leading-6 soft-text">
              {lang === 'ar'
                ? 'اختياري للحسابات المدفوعة: استخدم مفتاحك الشخصي في الشات أو Agent لتقليل استهلاك كريدت المنصة. المفتاح يتخزن محليًا على جهازك فقط، ويتم إرساله للسيرفر وقت الطلب فقط. لا تضف مفتاح شركة أو مفتاح لا تملك حق استخدامه.'
                : 'Optional for paid accounts: use your own AI key for chat or Agent to reduce platform credit usage. The key is stored locally on this device only and sent to the server only when a request is made. Do not add a company key or a key you are not allowed to use.'}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="qlo-select-wrap"><span>{lang === 'ar' ? 'المزود' : 'Provider'}</span><select value={userAi.provider} onChange={(e) => setUserAi({ ...userAi, provider: e.target.value as UserAiProvider, model: userAiProviders.find((p) => p.id === e.target.value)?.modelHint || '' })}>{userAiProviders.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
              <label className="qlo-select-wrap"><span>{lang === 'ar' ? 'اسم الموديل اختياري' : 'Model name, optional'}</span><input className="field" value={userAi.model || ''} placeholder={userAiProviders.find((p) => p.id === userAi.provider)?.modelHint} onChange={(e) => setUserAi({ ...userAi, model: e.target.value })} /></label>
              <label className="md:col-span-2"><span className="mb-2 block text-xs font-black soft-text">API Key</span><div className="flex gap-2"><input className="field flex-1" type={userAiShowKey ? 'text' : 'password'} value={userAi.apiKey} placeholder="••••••••••••••••" onChange={(e) => setUserAi({ ...userAi, apiKey: e.target.value })} /><button type="button" className="btn btn-soft" onClick={() => setUserAiShowKey((v) => !v)}>{userAiShowKey ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              <label className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><input type="checkbox" checked={userAi.enabled} onChange={(e) => setUserAi({ ...userAi, enabled: e.target.checked })} /><span className="text-sm font-black">{lang === 'ar' ? 'تفعيل المفتاح الشخصي للشات' : 'Enable for chat'}</span></label>
              <label className="flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><input type="checkbox" checked={userAi.useForAgent} onChange={(e) => setUserAi({ ...userAi, useForAgent: e.target.checked })} /><span className="text-sm font-black">{lang === 'ar' ? 'استخدامه مع Agent أيضًا' : 'Use with Agent too'}</span></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={saveUserAiSettings}><Save size={18} /> {lang === 'ar' ? 'حفظ على الجهاز' : 'Save on device'}</button>
              <button className="btn btn-soft" onClick={testUserAiSettings}><CheckCircle2 size={18} /> {lang === 'ar' ? 'اختبار المفتاح' : 'Test key'}</button>
              <button className="btn btn-soft" onClick={clearUserAiSettings}><Trash2 size={18} /> {lang === 'ar' ? 'حذف المفتاح' : 'Remove key'}</button>
            </div>
            <div className="mt-3 text-xs leading-6 soft-text">
              {userAiTest || (lang === 'ar'
                ? 'الشروط: حساب مسجل، خطة Standard أو Premium أو Max، مزود من القائمة فقط، بدون endpoints مخصصة، ومفاتيحك لا تتجاوز فلاتر الأمان أو حدود Agent اليومية.'
                : 'Conditions: signed-in account, Standard/Premium/Max plan, allowlisted provider only, no custom endpoints, and your key does not bypass safety filters or daily Agent limits.')}
            </div>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-lg font-black"><Cloud className="text-[var(--accent-1)]" /> {lang === 'ar' ? 'Google Cloud Auto Training' : 'Google Cloud Auto Training'}</div>
            <p className="text-sm leading-6 soft-text">
              {lang === 'ar'
                ? 'لما Google Cloud يتظبط في Environment Variables، أمثلة التدريب المقبولة بتتحفظ تلقائيًا في Cloud Storage. ومن هنا تقدر تعمل Sync كامل للـDataset أو تبدأ Vertex AI Custom Job لو حاطط صورة التدريب.'
                : 'When Google Cloud is configured in environment variables, accepted examples are mirrored automatically to Cloud Storage. You can also sync the full dataset or start a Vertex AI Custom Job if a training image is configured.'}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Project</div><div className="mt-1 truncate text-sm font-black">{cloudStatus.project_id || 'Not set'}</div></div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Bucket</div><div className="mt-1 truncate text-sm font-black">{cloudStatus.bucket || 'Not set'}</div></div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Region</div><div className="mt-1 truncate text-sm font-black">{cloudStatus.region || 'us-central1'}</div></div>
              <div className="rounded-[1.2rem] border border-white/10 bg-black/10 p-3"><div className="text-[11px] font-black soft-text">Status</div><div className="mt-1 truncate text-sm font-black">{cloudStatus.configured ? (cloudStatus.vertex_ready ? 'Vertex ready' : 'Storage ready') : 'Not configured'}</div></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-soft" disabled={cloudBusy} onClick={loadCloudTrainingStatus}><Cloud size={18} /> {lang === 'ar' ? 'فحص الاتصال' : 'Check status'}</button>
              <button className="btn btn-soft" disabled={cloudBusy || !cloudStatus.configured} onClick={() => syncDatasetToGoogleCloud(false)}><Download size={18} /> {lang === 'ar' ? 'حفظ Dataset على Google Cloud' : 'Save dataset to Google Cloud'}</button>
              <button className="btn btn-primary" disabled={cloudBusy || !cloudStatus.configured} onClick={() => syncDatasetToGoogleCloud(true)}><PlayCircle size={18} /> {lang === 'ar' ? 'بدء تدريب QLO 1' : 'Start QLO 1 training'}</button>
            </div>
            <div className="mt-3 text-xs leading-6 soft-text">
              {lang === 'ar'
                ? 'التشغيل الكامل للتدريب يحتاج GCLOUD_VERTEX_TRAINING_IMAGE. لو مش موجود، النظام هيحفظ الـDataset فقط عشان التدريب لاحقًا.'
                : 'Full training requires GCLOUD_VERTEX_TRAINING_IMAGE. Without it, the system saves the dataset only for later training.'}
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-xs leading-6 soft-text">
            {lang === 'ar'
              ? 'الوسوم المدعومة: ar_fusha، ar_eg، en، mixed. يتم تقليل البيانات الحساسة مثل الإيميل ورقم الهاتف والتوكن قبل التخزين. في النسخة العامة لازم تذكر جمع بيانات التدريب بوضوح في سياسة الخصوصية، لأن تدريب موديل من كلام الناس من غير علمهم طريقة ممتازة لجمع مشاكل قانونية بدل Dataset.'
              : 'Supported tags: ar_fusha, ar_eg, en, mixed. Sensitive strings like emails, phone numbers, and tokens are reduced before storage. In public production, disclose training-data collection in the privacy policy.'}
          </div>
        </div>
      </details>


      <div id="company" className="mt-8 text-lg font-black strong-muted">{lang === 'ar' ? 'الشركة والقوانين' : 'Company & Legal'}</div>
      <div className="panel mt-3 rounded-[2rem] p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-lg font-black"><Sparkles className="text-[var(--accent-1)]" /> Qalvero AI</div>
            <p className="text-sm leading-6 soft-text">
              {lang === 'ar'
                ? 'Qalvero AI منصة ذكاء اصطناعي تساعد المستخدمين في الكتابة، البرمجة، التلخيص، توليد الأفكار، حل المشاكل، وإنجاز المهام الرقمية من خلال تجربة شات نظيفة.'
                : 'Qalvero AI helps users write, code, summarize, brainstorm, solve problems, and complete digital tasks through a clean AI chat experience.'}
            </p>
            <p className="mt-3 text-sm leading-6 soft-text">
              {lang === 'ar'
                ? 'QLO هو تجربة الذكاء الاصطناعي المميزة داخل Qalvero AI، وليس موديلًا مدربًا من الصفر.'
                : 'QLO is the branded AI experience inside Qalvero AI, not a model trained from scratch.'}
            </p>
          </div>
          <Link to="/legal" className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
            <div className="mb-2 flex items-center gap-2 text-lg font-black"><Shield className="text-[var(--accent-1)]" /> {t.legal}</div>
            <p className="text-sm leading-6 soft-text">
              {lang === 'ar'
                ? 'افتح صفحة القوانين والسياسات من هنا بدل ما تكون ظاهرة في القائمة الرئيسية.'
                : 'Open legal pages and policies here instead of keeping them in the main navigation.'}
            </p>
          </Link>
        </div>
      </div>

      <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{msg || 'Qalvero AI'}</div>
    </section>
  );
}
