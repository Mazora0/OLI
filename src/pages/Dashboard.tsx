import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Lock, MessageSquareText, Plus, Trash2, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { guestLimits, limits, publicPlanName } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import { getAvatar } from '../lib/avatars';
import { pruneQalveroChatHistory, type StoredThread } from '../chat-history-retention';

type UsageRow = { tier: 'flash' | 'pro'; messages_used: number; messages_limit: number };

const copy = {
  ar: { plan: 'الخطة', guest: 'ضيف', login: 'تسجيل الدخول', upgrade: 'ترقية', newChat: 'محادثة جديدة', recentChats: 'المحادثات', noChats: 'لسه مفيش محادثات محفوظة.', textOnly: 'يتم حفظ النص فقط. المحادثات الأقدم من 30 يوم تُحذف تلقائيًا.', cleanOld: 'تنظيف', usage: 'الاستخدام', flash: 'QLO 1.2', pro: 'QLO 1.3', models: 'الموديلات', saved: 'محفوظ' },
  en: { plan: 'Plan', guest: 'Guest', login: 'Login', upgrade: 'Upgrade', newChat: 'New chat', recentChats: 'Chats', noChats: 'No saved chats yet.', textOnly: 'Text only is saved. Chats older than 30 days are cleaned automatically.', cleanOld: 'Clean', usage: 'Usage', flash: 'QLO 1.2', pro: 'QLO 1.3', models: 'Models', saved: 'Saved' }
} as const;

function chatPreview(thread: StoredThread) {
  return ([...(thread.messages || [])].reverse().find((m) => m.content)?.content || '').replace(/\s+/g, ' ').slice(0, 92);
}
function chatDate(thread: StoredThread) {
  const date = new Date(thread.updatedAt || thread.createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { profile, lang } = useApp();
  const navigate = useNavigate();
  const c = lang === 'ar' ? copy.ar : copy.en;
  const isGuest = !profile;
  const plan = (profile?.plan || 'Free') as keyof typeof limits;
  const avatar = getAvatar(profile?.avatar_id);
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || c.guest;
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [threads, setThreads] = useState<StoredThread[]>([]);

  useEffect(() => {
    async function load() {
      if (!profile?.id || !supabase) { setUsage([]); return; }
      const { data } = await supabase.from('qv_model_usage').select('tier,messages_used,messages_limit').eq('user_id', profile.id);
      setUsage((data || []) as UsageRow[]);
    }
    load();
  }, [profile?.id]);

  useEffect(() => {
    const loadThreads = () => setThreads(pruneQalveroChatHistory());
    loadThreads();
    window.addEventListener('storage', loadThreads);
    window.addEventListener('focus', loadThreads);
    return () => {
      window.removeEventListener('storage', loadThreads);
      window.removeEventListener('focus', loadThreads);
    };
  }, []);

  const recentThreads = useMemo(() => threads.slice(0, 20), [threads]);
  const flash = usage.find((u) => u.tier === 'flash');
  const pro = usage.find((u) => u.tier === 'pro');
  const flashLimit = isGuest ? guestLimits.flash : (flash?.messages_limit ?? limits[plan].flash);
  const proLimit = isGuest ? guestLimits.pro : (pro?.messages_limit ?? limits[plan].pro);
  const flashUsed = flash?.messages_used ?? 0;
  const proUsed = pro?.messages_used ?? 0;

  function startNewChat() {
    localStorage.removeItem('qv_active_thread_id');
    localStorage.setItem('qv_start_new_chat', String(Date.now()));
    navigate('/');
  }
  function openThread(id: string) {
    localStorage.setItem('qv_active_thread_id', id);
    navigate('/');
  }
  function cleanOldChats() { setThreads(pruneQalveroChatHistory()); }

  const miniStats = [
    { label: c.flash, value: `${flashUsed}/${flashLimit}` },
    { label: c.pro, value: `${proUsed}/${proLimit}` },
    { label: c.models, value: isGuest ? '1' : String(limits[plan].models.length) },
    { label: c.saved, value: String(threads.length) }
  ];

  return (
    <section className="mx-auto max-w-4xl pb-10">
      <div className="mb-5 rounded-[2rem] border border-white/10 bg-white/5 p-5 text-center">
        <div className="mx-auto avatar-ring qlo-dashboard-avatar h-[96px] w-[96px] overflow-hidden">
          <div className={`avatar-core grid h-full w-full place-items-center rounded-full bg-gradient-to-br ${avatar.gradient}`}>
            <span className="qlo-cartoon-face" />
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-black md:text-5xl">{displayName}</h1>
        <p className="mt-2 text-sm soft-text">{profile?.email || c.guest} · {c.plan}: <b className="strong-muted">{isGuest ? c.guest : publicPlanName(plan)}</b></p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={startNewChat} className="btn btn-primary"><Plus size={18} /> {c.newChat}</button>
          {isGuest ? <Link to="/login" className="btn"><Lock size={18} /> {c.login}</Link> : <Link to="/pricing" className="btn"><CreditCard size={18} /> {c.upgrade}</Link>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_230px]">
        <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black"><MessageSquareText className="text-[var(--accent-1)]" /> {c.recentChats}</h2>
              <p className="mt-1 text-xs leading-5 soft-text">{c.textOnly}</p>
            </div>
            <button onClick={cleanOldChats} className="btn btn-soft !px-3 !py-2 text-xs"><Trash2 size={14} /> {c.cleanOld}</button>
          </div>
          {recentThreads.length ? (
            <div className="grid gap-2">
              {recentThreads.map((thread) => (
                <button key={thread.id} onClick={() => openThread(thread.id)} className="rounded-[1.05rem] border border-white/10 bg-black/20 px-4 py-3 text-start transition hover:border-[var(--accent-1)]/40 hover:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="min-w-0 truncate text-sm font-black">{thread.title || c.newChat}</h3>
                    <span className="shrink-0 text-[11px] soft-text">{chatDate(thread)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs soft-text">{chatPreview(thread)}</p>
                </button>
              ))}
            </div>
          ) : <div className="rounded-[1.1rem] border border-dashed border-white/10 p-4 text-sm soft-text">{c.noChats}</div>}
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
