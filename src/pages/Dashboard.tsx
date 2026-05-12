import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, BrainCircuit, CreditCard, Database, Lock, MessageSquareText, Plus, ShieldCheck, Sparkles, Trash2, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { guestLimits, limits, price, publicPlanName } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import { pruneQalveroChatHistory, type StoredThread } from '../chat-history-retention';

type UsageRow = { tier: 'flash' | 'pro'; messages_used: number; messages_limit: number; reset_date?: string };

const copy = {
  ar: {
    badge: 'مركز التحكم', title: 'لوحة تحكم Qalvero', currentPlan: 'الخطة الحالية', upgrade: 'ترقية الخطة', daily: 'حدود الرسائل كل 6 ساعات', used: 'مستخدم', left: 'متبقي', serverTracked: 'الأرقام الحقيقية بتتجاب من Supabase لما تكون مسجل دخول.', region: 'منطقة الدفع', models: 'موديلات متاحة', guest: 'ضيف', loginHint: 'سجّل دخول عشان تشوف استخدامك الحقيقي وحدود حسابك.', login: 'تسجيل الدخول', next: 'حالة الإنتاج', nextText: 'لو ظهر خطأ في الشات، راجع مفاتيح AI و Supabase في Vercel. الواجهة لا تستخدم أزرار وهمية.', newChat: 'محادثة جديدة', recentChats: 'آخر المحادثات', noChats: 'لسه مفيش محادثات محفوظة.', textOnly: 'الحفظ نص فقط، والقديم يتم تنظيفه تلقائيًا بعد 30 يوم.', open: 'فتح', clearOld: 'تنظيف القديم', cards: [ ['QLO 1.2', 'ردود تتجدد كل 6 ساعات بحدود حسب الخطة.', Zap], ['QLO 1.3', 'تجربة محسّنة للشغل الأعمق بعد تسجيل الدخول.', BrainCircuit], ['ذاكرة بسيطة', 'تحفظ الاسم والدراسة والهدف من الشات للمسجلين.', Database], ['أمان الحساب', 'Supabase Auth + RLS + مفاتيح السيرفر.', ShieldCheck] ]
  },
  en: {
    badge: 'Control Center', title: 'Qalvero Dashboard', currentPlan: 'Current plan', upgrade: 'Upgrade plan', daily: '6-hour message limits', used: 'Used', left: 'Left', serverTracked: 'Real numbers are read from Supabase when you are signed in.', region: 'Billing region', models: 'Available models', guest: 'Guest', loginHint: 'Sign in to see real usage and account limits.', login: 'Login', next: 'Production status', nextText: 'If chat returns an error, check AI and Supabase keys in Vercel. The UI avoids fake buttons.', newChat: 'New chat', recentChats: 'Recent chats', noChats: 'No saved chats yet.', textOnly: 'Chats are saved as text only. Old chats are cleaned automatically after 30 days.', open: 'Open', clearOld: 'Clean old', cards: [ ['QLO 1.2', 'Fast replies with 6-hour limits by plan.', Zap], ['QLO 1.3', 'Enhanced experience for deeper work after login.', BrainCircuit], ['Compact memory', 'Saves basics like name, study, and goal from chat.', Database], ['Account security', 'Supabase Auth + RLS + server keys.', ShieldCheck] ]
  }
} as const;

function chatPreview(thread: StoredThread) {
  const last = [...(thread.messages || [])].reverse().find((m) => m.content)?.content || '';
  return last.replace(/\s+/g, ' ').slice(0, 96);
}

function chatDate(thread: StoredThread) {
  const value = thread.updatedAt || thread.createdAt;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { profile, country, lang } = useApp();
  const navigate = useNavigate();
  const c = lang === 'ar' ? copy.ar : copy.en;
  const isGuest = !profile;
  const plan = (profile?.plan || 'Free') as keyof typeof limits;
  const current = isGuest ? guestLimits : limits[plan];
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [threads, setThreads] = useState<StoredThread[]>([]);

  useEffect(() => {
    async function load() {
      if (!profile?.id || !supabase) { setUsage([]); return; }
      const { data } = await supabase.from('qv_model_usage').select('tier,messages_used,messages_limit,reset_date').eq('user_id', profile.id);
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

  const recentThreads = useMemo(() => threads.slice(0, 8), [threads]);
  const flash = usage.find((u) => u.tier === 'flash');
  const pro = usage.find((u) => u.tier === 'pro');
  const flashLimit = isGuest ? guestLimits.flash : (flash?.messages_limit ?? limits[plan].flash);
  const proLimit = isGuest ? guestLimits.pro : (pro?.messages_limit ?? limits[plan].pro);
  const flashUsed = flash?.messages_used ?? 0;
  const proUsed = pro?.messages_used ?? 0;

  const usageCards = [
    { name: 'QLO 1.2', used: flashUsed, limit: flashLimit },
    { name: 'QLO 1.3', used: proUsed, limit: proLimit }
  ];

  function startNewChat() {
    localStorage.removeItem('qv_active_thread_id');
    localStorage.setItem('qv_start_new_chat', String(Date.now()));
    navigate('/');
  }

  function openThread(id: string) {
    localStorage.setItem('qv_active_thread_id', id);
    navigate('/');
  }

  function cleanOldChats() {
    setThreads(pruneQalveroChatHistory());
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Sparkles size={14} /> {c.badge}</div>
          <h1 className="text-4xl font-black md:text-6xl">{c.title} <span className="grad">AI</span></h1>
          <p className="mt-3 soft-text">{profile?.email || c.guest} · {c.currentPlan}: <b className="strong-muted">{isGuest ? c.guest : publicPlanName(plan)}</b></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={startNewChat} className="btn btn-primary"><Plus size={18} /> {c.newChat}</button>
          {isGuest ? <Link to="/login" className="btn"><Lock size={18} /> {c.login}</Link> : <Link to="/pricing" className="btn"><CreditCard size={18} /> {c.upgrade}</Link>}
        </div>
      </div>

      {isGuest && <div className="mb-5 rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm leading-6 soft-text">{c.loginHint}</div>}

      <div className="mb-5 rounded-[2rem] border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black"><MessageSquareText className="text-[var(--accent-1)]" /> {c.recentChats}</h2>
            <p className="mt-1 text-sm soft-text">{c.textOnly}</p>
          </div>
          <button onClick={cleanOldChats} className="btn"><Trash2 size={16} /> {c.clearOld}</button>
        </div>
        {recentThreads.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recentThreads.map((thread) => (
              <button key={thread.id} onClick={() => openThread(thread.id)} className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4 text-start transition hover:border-[var(--accent-1)]/40 hover:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-1 font-black">{thread.title || c.newChat}</h3>
                  <span className="shrink-0 text-xs soft-text">{chatDate(thread)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 soft-text">{chatPreview(thread) || c.open}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-white/10 p-5 text-sm soft-text">{c.noChats}</div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card rounded-[2rem] p-5"><p className="text-sm soft-text">{c.daily}</p><h2 className="mt-2 text-2xl font-black leading-tight">{current.messages}</h2><p className="mt-2 text-sm soft-text">{c.serverTracked}</p></div>
        <div className="card rounded-[2rem] p-5"><p className="text-sm soft-text">{c.region}</p><h2 className="mt-2 text-4xl font-black">{country}</h2><p className="mt-2 text-sm soft-text">Standard: {price(country, 'standard')} · Max: {price(country, 'max')}</p></div>
        <div className="card rounded-[2rem] p-5"><p className="text-sm soft-text">{c.models}</p><h2 className="mt-2 text-4xl font-black">{isGuest ? 1 : limits[plan].models.length}</h2><p className="mt-2 text-sm soft-text">{isGuest ? 'QLO 1.2 Flash' : limits[plan].models.join(', ')}</p></div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {usageCards.map((item) => {
          const left = Math.max(0, item.limit - item.used);
          const pct = item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0;
          return <div key={item.name} className="card rounded-[2rem] p-5"><div className="flex items-center justify-between"><h3 className="text-xl font-black">{item.name}</h3><span className="soft-text text-sm">{item.used}/{item.limit}</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[linear-gradient(135deg,var(--accent-1),var(--accent-2))]" style={{ width: `${pct}%` }} /></div><p className="mt-3 text-sm soft-text">{c.used}: {item.used} · {c.left}: {left}</p></div>;
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {c.cards.map(([title, text, Icon]) => <div key={title} className="card rounded-[2rem] p-5"><Icon className="mb-4 text-[var(--accent-1)]" /><h3 className="text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 soft-text">{text}</p></div>)}
      </div>

      <div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-5"><div className="flex items-start gap-3"><BarChart3 className="mt-1 text-[var(--accent-1)]" /><div><h3 className="font-black">{c.next}</h3><p className="mt-1 text-sm soft-text">{c.nextText}</p></div></div></div>
    </section>
  );
}
