import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Edit3, Home, LayoutDashboard, Lock, MessageSquareText, Pin, PinOff, Plus, Search, Settings, Trash2, Wand2, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { guestLimits, limits, publicPlanName } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import { getAvatar } from '../lib/avatars';
import { pruneQalveroChatHistory, type StoredThread } from '../chat-history-retention';

type UsageRow = { tier: 'flash' | 'pro'; messages_used: number; messages_limit: number };
type DashboardThread = StoredThread & { pinned?: boolean };

const copy = {
  ar: {
    home: 'الرئيسية', dashboard: 'لوحة التحكم', settings: 'الإعدادات', plan: 'الخطة', guest: 'ضيف', login: 'تسجيل الدخول', upgrade: 'ترقية', pricing: 'الأسعار', tools: 'الأدوات', newChat: 'محادثة جديدة', recentChats: 'الدردشات', noChats: 'لسه مفيش محادثات محفوظة.', noSearch: 'مفيش محادثات مطابقة.', usage: 'الاستخدام', flash: 'QLO 1.2', pro: 'QLO 1.3', models: 'الموديلات', saved: 'محفوظ', search: 'ابحث في المحادثات...', pin: 'تثبيت', unpin: 'إلغاء التثبيت', rename: 'إعادة تسمية', delete: 'حذف', renamePrompt: 'اسم المحادثة الجديد', deleteConfirm: 'حذف المحادثة دي؟', deleted: 'تم حذف المحادثة', renamed: 'تم تغيير الاسم', pinned: 'تم التثبيت', unpinned: 'تم إلغاء التثبيت'
  },
  en: {
    home: 'Home', dashboard: 'Dashboard', settings: 'Settings', plan: 'Plan', guest: 'Guest', login: 'Login', upgrade: 'Upgrade', pricing: 'Pricing', tools: 'Tools', newChat: 'New chat', recentChats: 'Chats', noChats: 'No saved chats yet.', noSearch: 'No matching chats.', usage: 'Usage', flash: 'QLO 1.2', pro: 'QLO 1.3', models: 'Models', saved: 'Saved', search: 'Search chats...', pin: 'Pin', unpin: 'Unpin', rename: 'Rename', delete: 'Delete', renamePrompt: 'New chat name', deleteConfirm: 'Delete this chat?', deleted: 'Chat deleted', renamed: 'Chat renamed', pinned: 'Chat pinned', unpinned: 'Chat unpinned'
  }
} as const;

function chatPreview(thread: StoredThread) {
  return ([...(thread.messages || [])].reverse().find((m) => m.content)?.content || '').replace(/\s+/g, ' ').slice(0, 92);
}

function chatDate(thread: StoredThread) {
  const date = new Date(thread.updatedAt || thread.createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function asTime(thread: StoredThread) {
  const time = Date.parse(thread.updatedAt || thread.createdAt || '');
  return Number.isFinite(time) ? time : 0;
}

function saveThreads(next: DashboardThread[]) {
  localStorage.setItem('qv_threads', JSON.stringify(next));
}

export default function Dashboard() {
  const { profile, lang } = useApp();
  const navigate = useNavigate();
  const c = lang === 'ar' ? copy.ar : copy.en;
  const isGuest = !profile;
  const plan = (profile?.plan || 'Free') as keyof typeof limits;
  const avatar = getAvatar(profile?.avatar_id);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [threads, setThreads] = useState<DashboardThread[]>([]);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    async function load() {
      if (!profile?.id || !supabase) { setUsage([]); return; }
      const { data } = await supabase.from('qv_model_usage').select('tier,messages_used,messages_limit').eq('user_id', profile.id);
      setUsage((data || []) as UsageRow[]);
    }
    load();
  }, [profile?.id]);

  useEffect(() => {
    const loadThreads = () => setThreads(pruneQalveroChatHistory() as DashboardThread[]);
    loadThreads();
    window.addEventListener('storage', loadThreads);
    window.addEventListener('focus', loadThreads);
    return () => {
      window.removeEventListener('storage', loadThreads);
      window.removeEventListener('focus', loadThreads);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads
      .filter((thread) => {
        if (!q) return true;
        const haystack = `${thread.title || ''} ${thread.messages?.map((m) => m.content).join(' ') || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || asTime(b) - asTime(a))
      .slice(0, 40);
  }, [threads, query]);

  const flash = usage.find((u) => u.tier === 'flash');
  const pro = usage.find((u) => u.tier === 'pro');
  const flashLimit = isGuest ? guestLimits.flash : (flash?.messages_limit ?? limits[plan].flash);
  const proLimit = isGuest ? guestLimits.pro : (pro?.messages_limit ?? limits[plan].pro);
  const flashUsed = flash?.messages_used ?? 0;
  const proUsed = pro?.messages_used ?? 0;

  function applyThreads(updater: (items: DashboardThread[]) => DashboardThread[], message?: string) {
    const next = updater(threads);
    setThreads(next);
    saveThreads(next);
    if (message) setToast(message);
  }

  function startNewChat() {
    localStorage.removeItem('qv_active_thread_id');
    localStorage.setItem('qv_start_new_chat', String(Date.now()));
    navigate('/');
  }

  function openThread(id: string) {
    localStorage.setItem('qv_active_thread_id', id);
    navigate('/');
  }

  function togglePin(thread: DashboardThread) {
    applyThreads((items) => items.map((item) => item.id === thread.id ? { ...item, pinned: !item.pinned, updatedAt: item.updatedAt || new Date().toISOString() } : item), thread.pinned ? c.unpinned : c.pinned);
  }

  function renameThread(thread: DashboardThread) {
    const nextTitle = window.prompt(c.renamePrompt, thread.title || c.newChat)?.trim();
    if (!nextTitle) return;
    applyThreads((items) => items.map((item) => item.id === thread.id ? { ...item, title: nextTitle, updatedAt: new Date().toISOString() } : item), c.renamed);
  }

  function deleteThread(thread: DashboardThread) {
    if (!window.confirm(c.deleteConfirm)) return;
    applyThreads((items) => items.filter((item) => item.id !== thread.id), c.deleted);
    if (localStorage.getItem('qv_active_thread_id') === thread.id) localStorage.removeItem('qv_active_thread_id');
  }

  const miniStats = [
    { label: c.flash, value: `${flashUsed}/${flashLimit}` },
    { label: c.pro, value: `${proUsed}/${proLimit}` },
    { label: c.models, value: isGuest ? '1' : String(limits[plan].models.length) },
    { label: c.saved, value: String(threads.length) }
  ];

  return (
    <section className="qlo-dashboard-screen mx-auto w-full max-w-4xl overflow-x-hidden pb-10">
      {toast && <div className="fixed bottom-5 left-1/2 z-[9999] -translate-x-1/2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">{toast}</div>}

      <div className="mb-5 rounded-[2rem] border border-white/10 bg-white/5 p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <Link to="/settings" className="flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 px-3 py-2 transition hover:border-[var(--accent-1)]/40">
            <div className="avatar-ring qlo-dashboard-avatar-small h-12 w-12 shrink-0 overflow-hidden">
              <div className={`avatar-core grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${avatar.gradient}`}>
                <span className="qlo-cartoon-face" />
              </div>
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-black">{profile?.email || c.guest}</div>
              <div className="truncate text-xs soft-text">{c.plan}: {isGuest ? c.guest : publicPlanName(plan)}</div>
            </div>
          </Link>

          <div className="min-w-0 flex-1 text-end">
            <h1 className="text-4xl font-black md:text-6xl">{c.settings}</h1>
            <p className="mt-1 text-sm soft-text">Qalvero AI</p>
          </div>

          <Link to="/settings" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-[var(--accent-1)] transition hover:bg-white/10" aria-label={c.settings}>
            <Settings size={22} />
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-end">
          <button onClick={startNewChat} className="btn btn-primary"><Plus size={18} /> {c.newChat}</button>
          <Link to="/tools" className="btn btn-soft"><Wand2 size={18} /> {c.tools}</Link>
          {isGuest ? <Link to="/login" className="btn"><Lock size={18} /> {c.login}</Link> : <Link to="/pricing" className="btn"><CreditCard size={18} /> {c.upgrade}</Link>}
        </div>

        <nav className="qlo-dashboard-nav mt-4" aria-label="Dashboard navigation">
          <Link to="/"><Home size={16} /> {c.home}</Link>
          <Link to="/dashboard" aria-current="page"><LayoutDashboard size={16} /> {c.dashboard}</Link>
          <Link to="/tools"><Wand2 size={16} /> {c.tools}</Link>
          <Link to="/pricing"><CreditCard size={16} /> {c.pricing}</Link>
          <Link to="/settings"><Settings size={16} /> {c.settings}</Link>
        </nav>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_230px]">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-black"><MessageSquareText className="text-[var(--accent-1)]" /> {c.recentChats}</h2>
            <div className="relative min-w-[210px] flex-1 md:max-w-[290px]">
              <Search size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 opacity-50 ltr:left-3 rtl:right-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.search} className="field h-10 w-full rounded-full py-2 text-sm ltr:pl-9 rtl:pr-9" />
            </div>
          </div>

          {visibleThreads.length ? (
            <div className="grid gap-2">
              {visibleThreads.map((thread) => (
                <div key={thread.id} className={`group rounded-[1.05rem] border px-3 py-3 transition ${thread.pinned ? 'border-[var(--accent-1)]/35 bg-white/7' : 'border-white/10 bg-black/20 hover:border-[var(--accent-1)]/40 hover:bg-white/5'}`}>
                  <button onClick={() => openThread(thread.id)} className="w-full text-start">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="min-w-0 truncate text-sm font-black">{thread.pinned ? '📌 ' : ''}{thread.title || c.newChat}</h3>
                      <span className="shrink-0 text-[11px] soft-text">{chatDate(thread)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs soft-text">{chatPreview(thread)}</p>
                  </button>
                  <div className="mt-2 flex items-center justify-end gap-1 opacity-90">
                    <button onClick={() => togglePin(thread)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white" title={thread.pinned ? c.unpin : c.pin}>{thread.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
                    <button onClick={() => renameThread(thread)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white" title={c.rename}><Edit3 size={15} /></button>
                    <button onClick={() => deleteThread(thread)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white" title={c.delete}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="rounded-[1.1rem] border border-dashed border-white/10 p-4 text-sm soft-text">{query ? c.noSearch : c.noChats}</div>}
        </div>

        <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-4">
          <h2 className="flex items-center gap-2 text-lg font-black"><Zap className="text-[var(--accent-1)]" /> {c.usage}</h2>
          <div className="mt-3 grid gap-2">
            {miniStats.map((item) => <div key={item.label} className="rounded-[1rem] border border-white/10 bg-black/20 p-3"><p className="text-[11px] soft-text">{item.label}</p><p className="mt-1 text-base font-black">{item.value}</p></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
