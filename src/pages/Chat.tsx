import { useMemo, useRef, useState } from 'react';
import { Brain, Clock3, Code2, GraduationCap, Lightbulb, MessageSquarePlus, Paperclip, PenTool, Send, Sparkles, Wand2, Zap, Crown, Layers3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { labels } from '../lib/i18n';
import { getAccessToken } from '../lib/supabase';

type Msg = { role: 'user' | 'assistant'; content: string };
type ChatThread = { id: string; title: string; messages: Msg[]; createdAt: string };

const modes = [
  { id: 'Auto', label: 'Auto route', icon: Sparkles },
  { id: 'Study coach', label: 'Study', icon: GraduationCap },
  { id: 'Writing studio', label: 'Writing', icon: PenTool },
  { id: 'Business planner', label: 'Business', icon: Lightbulb },
  { id: 'Code helper', label: 'Code', icon: Code2 },
  { id: 'Reasoning', label: 'Reason', icon: Brain }
];

const models = [
  { id: 'QLO Auto', name: 'QLO Auto', desc: 'يختار المسار الأنسب تلقائيًا حسب السؤال', badge: 'Smart' },
  { id: 'QLO Flash', name: 'QLO Flash', desc: 'سريع جدًا وحدوده كبيرة للشات اليومي والأسئلة العادية', badge: 'Big limits' },
  { id: 'QLO Pro', name: 'QLO Pro', desc: 'للشغل التقيل: تحليل، كتابة، تخطيط، وحلول أعمق', badge: 'Limited' },
  { id: 'QLO Reason', name: 'QLO Reason', desc: 'للتفكير العميق، المشاكل المعقدة، والتحليل الطويل', badge: 'Premium' },
  { id: 'QLO Code', name: 'QLO Code', desc: 'للكود والديباج والـ architecture', badge: 'Premium' },
  { id: 'QLO Study', name: 'QLO Study', desc: 'شرح ومذاكرة وخطط تعليمية سلسة', badge: 'Daily' },
  { id: 'QLO Creative', name: 'QLO Creative', desc: 'أفكار، سكريبتات، كتابة وتسويق', badge: 'Pro' }
];

const starterPrompts = [
  'اعمللي خطة مذاكرة 3 ساعات بطريقة سهلة',
  'اكتبلي خطة إطلاق لمنصة Qalvero AI',
  'حوّل الفكرة دي لخطة SaaS احترافية',
  'Debug this React/Vite deployment issue',
  'اكتبلي وصف احترافي لمنتج AI جديد'
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadThreads(): ChatThread[] {
  try { return JSON.parse(localStorage.getItem('qv_threads') || '[]'); } catch { return []; }
}
function saveThreads(threads: ChatThread[]) { localStorage.setItem('qv_threads', JSON.stringify(threads.slice(0, 20))); }

export default function Chat() {
  const { lang, profile } = useApp();
  const t = labels[lang];
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads());
  const [activeId, setActiveId] = useState<string>(() => loadThreads()[0]?.id || 'new');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [model, setModel] = useState(models[0].id);
  const [mode, setMode] = useState(modes[0].id);
  const [error, setError] = useState('');
  const animatingRef = useRef(0);

  const active = useMemo(() => threads.find((x) => x.id === activeId), [threads, activeId]);
  const msgs = active?.messages || [];
  const currentModel = models.find((m) => m.id === model) || models[0];
  const currentMode = modes.find((m) => m.id === mode) || modes[0];
  const plan = profile?.plan || 'Free';
  const isFree = plan === 'Free';

  function newChat() { setActiveId('new'); setError(''); }

  function setThreadMessages(threadId: string, messages: Msg[]) {
    setThreads((prev) => {
      const next = prev.map((th) => th.id === threadId ? { ...th, messages } : th);
      saveThreads(next);
      return next;
    });
  }

  function upsertThread(messages: Msg[], userText: string) {
    if (activeId === 'new' || !active) {
      const created: ChatThread = { id: crypto.randomUUID(), title: userText.slice(0, 42) || 'New chat', messages, createdAt: new Date().toISOString() };
      const next = [created, ...threads].slice(0, 20);
      setThreads(next); saveThreads(next); setActiveId(created.id);
      return created.id;
    }
    const next = threads.map((th) => th.id === activeId ? { ...th, messages, title: th.title || userText.slice(0, 42) } : th);
    setThreads(next); saveThreads(next);
    return activeId;
  }

  async function animateReply(threadId: string, afterUser: Msg[], reply: string) {
    const ticket = Date.now();
    animatingRef.current = ticket;
    setTyping(true);
    const clean = reply || 'QLO returned an empty response.';
    setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: '' }]);
    await sleep(120);
    const step = clean.length > 1200 ? 24 : clean.length > 500 ? 12 : 7;
    for (let i = step; i <= clean.length; i += step) {
      if (animatingRef.current !== ticket) break;
      setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: clean.slice(0, i) }]);
      await sleep(10);
    }
    setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: clean }]);
    setTyping(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput(''); setError('');
    const afterUser = [...msgs, { role: 'user', content: text } as Msg];
    const threadId = upsertThread(afterUser, text);
    setLoading(true);
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/qalvero-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: text, history: msgs, model, mode, language: lang })
      });
      const data = await r.json();
      const reply = data.reply || data.error || 'QLO لسه محتاج مفاتيح API في Vercel عشان يرد فعليًا.';
      if (!r.ok) setError(data.error || 'QLO request failed');
      await animateReply(threadId, afterUser, reply);
    } catch {
      const reply = 'QLO backend مش واصل دلوقتي. راجع Vercel API routes و Environment Variables.';
      setError(reply);
      await animateReply(threadId, afterUser, reply);
    } finally { setLoading(false); }
  }

  return (
    <section className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[280px_1fr_320px]">
      <aside className="hidden rounded-[2rem] border border-white/10 bg-white/[.04] p-4 lg:block">
        <button onClick={newChat} className="btn btn-primary mb-4 w-full"><MessageSquarePlus size={18} /> New chat</button>
        <div className="mb-3 text-xs font-black uppercase tracking-[.2em] text-slate-400">Saved chats</div>
        <div className="grid gap-2">
          {threads.length === 0 && <p className="rounded-2xl bg-white/5 p-3 text-sm opacity-60">No saved chats yet.</p>}
          {threads.map((th) => (
            <button key={th.id} onClick={() => setActiveId(th.id)} className={`rounded-2xl p-3 text-left text-sm font-bold ${activeId === th.id ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}>
              <div className="line-clamp-2">{th.title}</div>
              <div className="mt-1 flex items-center gap-1 text-[11px] opacity-60"><Clock3 size={12} /> {new Date(th.createdAt).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="glass flex min-h-[82vh] flex-col overflow-hidden rounded-[2rem]">
        <div className="border-b border-white/10 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-cyan-200"><Sparkles size={13} /> QLO 1.2 Model Family</div>
              <h1 className="mt-2 text-2xl font-black md:text-4xl">{t.welcome}</h1>
              <p className="mt-1 text-sm text-slate-400">QLO Flash هو الوضع اليومي السريع. QLO Pro محدود ومخصص للكود، التحليل، والتفكير العميق.</p>
            </div>
            <img src="/qlo-face.jpg" className="float h-16 w-16 rounded-3xl object-cover ring-1 ring-cyan-300/30" />
          </div>
          <div className="mt-4 rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-cyan-300/10 via-violet-400/10 to-fuchsia-400/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">{isFree ? 'Pro trial available' : 'Pro access active'}</p>
                <p className="mt-1 text-sm text-slate-300">{isFree ? 'جرّب QLO Pro كام مرة، وبعدها كمل على Flash أو اعمل Upgrade عشان تفتح ردود أعمق.' : 'خطتك بتديك Flash أكتر وPro أذكى للمهام التقيلة.'}</p>
              </div>
              <a href="/pricing" className="btn btn-primary"><Crown size={16} /> Upgrade to Pro</a>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <select className="field" value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.badge}</option>)}</select>
            <select className="field" value={mode} onChange={(e) => setMode(e.target.value)}>{modes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {msgs.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-2xl">
                <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[2rem] bg-white/10"><Wand2 className="h-10 w-10 text-cyan-200" /></div>
                <h2 className="text-3xl font-black md:text-6xl"><span className="grad">Qalvero AI</span> workspace</h2>
                <p className="mx-auto mt-3 max-w-xl text-slate-400">QLO يختار المسار الأنسب، يحافظ على رد سلس، ويخلي أسماء المزودين مخفية جوه الباكند.</p>
                <div className="mt-6 grid gap-2 md:grid-cols-2">
                  {starterPrompts.map((x) => <button key={x} onClick={() => setInput(x)} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm font-bold hover:bg-white/10">{x}</button>)}
                </div>
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`markdownish message-bubble max-w-[90%] whitespace-pre-wrap rounded-[1.5rem] px-4 py-3 text-sm leading-7 md:max-w-[76%] ${m.role === 'user' ? 'bg-white text-black' : 'border border-white/10 bg-white/8'}`}>{m.content}{typing && i === msgs.length - 1 && m.role === 'assistant' ? <span className="typing-cursor">|</span> : null}</div>
            </div>
          ))}
          {loading && !typing && <div className="inline-flex items-center gap-2 rounded-2xl bg-white/5 p-3 text-sm opacity-80"><span className="dotty" /><span className="dotty delay-1" /><span className="dotty delay-2" /> QLO بيختار أحسن مسار للرد...</div>}
          {error && <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        </div>

        <div className="safe-bottom border-t border-white/10 p-3">
          <div className="flex items-end gap-2 rounded-[1.75rem] bg-white/8 p-2">
            <button className="btn btn-soft p-3" title="File tools ready"><Paperclip size={18} /></button>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={t.placeholder} className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-3 outline-none" />
            <button onClick={send} className="btn btn-primary p-3"><Send size={18} /></button>
          </div>
        </div>
      </main>

      <aside className="grid gap-4 lg:block">
        <div className="card rounded-[2rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Current model</p>
              <h3 className="mt-1 text-2xl font-black">{currentModel.name}</h3>
            </div>
            <Zap className="text-cyan-300" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">{currentModel.desc}</p>
          <div className="mt-4 rounded-2xl bg-white/5 p-3 text-xs leading-5 text-slate-300">Mode: <b>{currentMode.label}</b><br />Plan: <b>{profile?.plan || 'Free'}</b></div>
        </div>
        <div className="card mt-4 rounded-[2rem] p-5">
          <div className="mb-2 flex items-center gap-2 font-black"><Layers3 className="text-cyan-300" /> Internal engine chain</div>
          <p className="text-sm leading-6 text-slate-400">Flash: Groq أولًا لتوفير الكريدت، Gemini Flash احتياطي، Cloudflare للمهام الخفيفة، وOpenRouter كآخر fallback. Pro: DeepSeek أولًا للذكاء والكود، وبعده Gemini Pro/Groq/OpenRouter حسب المتاح.</p>
        </div>
        <div className="card mt-4 rounded-[2rem] p-5">
          <div className="mb-2 flex items-center gap-2 font-black"><Crown className="text-cyan-300" /> Pro limits</div>
          <p className="text-sm leading-6 text-slate-400">Pro محدود عمدًا عشان التكلفة. لما يخلص، المستخدم يكمل على QLO Flash أو يشترك. كده المنصة تفضل سريعة ورخيصة بدل ما تحرق المفاتيح في يومين.</p>
        </div>
      <div className="card mt-4 rounded-[2rem] p-5">
          <div className="mb-2 flex items-center gap-2 font-black"><Sparkles className="text-cyan-300" /> Credit saver</div>
          <p className="text-sm leading-6 text-slate-400">Auto route بيحاول يخلي حوالي 90% من الطلبات على Flash، ويستخدم Pro بس لما السؤال يستاهل. كده QLO يحس كبير، والكريدت مايتشفطش زي اشتراك نت في آخر الشهر.</p>
        </div>
      </aside>
    </section>
  );
}
