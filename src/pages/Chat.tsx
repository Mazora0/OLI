import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Code2, GraduationCap, Lightbulb, Send, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { labels } from '../lib/i18n';
import { getAccessToken } from '../lib/supabase';

type Msg = { role: 'user' | 'assistant'; content: string };
type ChatThread = { id: string; title: string; messages: Msg[]; createdAt: string };

const modes = [
  { id: 'Auto', label: { en: 'Auto', ar: 'تلقائي' } },
  { id: 'Study coach', label: { en: 'Study', ar: 'مذاكرة' } },
  { id: 'Writing studio', label: { en: 'Writing', ar: 'كتابة' } },
  { id: 'Business planner', label: { en: 'Ideas', ar: 'أفكار' } },
  { id: 'Code helper', label: { en: 'Code', ar: 'كود' } },
  { id: 'Reasoning', label: { en: 'Reasoning', ar: 'تحليل' } }
];

const guestModels = [
  { id: 'QLO Auto', name: 'QLO Auto' },
  { id: 'QLO Flash', name: 'QLO Flash' },
  { id: 'QLO Study', name: 'QLO Study' }
];

const accountModels = [
  ...guestModels,
  { id: 'QLO Pro', name: 'QLO Pro' },
  { id: 'QLO Reason', name: 'QLO Reason' },
  { id: 'QLO Code', name: 'QLO Code' },
  { id: 'QLO Creative', name: 'QLO Creative' }
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function loadThreads(): ChatThread[] {
  try {
    return JSON.parse(localStorage.getItem('qv_threads') || '[]');
  } catch {
    return [];
  }
}
function saveThreads(threads: ChatThread[]) {
  localStorage.setItem('qv_threads', JSON.stringify(threads.slice(0, 20)));
}

const copyByLang = {
  ar: {
    intro: 'أهلاً، أنا',
    subtitle: 'جاهز أساعدك تبدأ منين؟',
    cards: [
      { id: 'ask', title: 'اكتب سؤالك', desc: 'اسأل QLO في أي حاجة بسيطة.', prompt: '', mode: 'Auto', icon: Sparkles },
      { id: 'study', title: 'ساعدني أذاكر', desc: 'شرح وتلخيص وأسئلة مراجعة.', prompt: 'ساعدني أذاكر بشكل منظم النهارده.', mode: 'Study coach', icon: GraduationCap },
      { id: 'ideas', title: 'رتّب أفكاري', desc: 'حوّل الكلام لخطة واضحة.', prompt: 'رتّبلي أفكاري وخليها خطوات عملية.', mode: 'Business planner', icon: Lightbulb },
      { id: 'code', title: 'حل مشكلة كود', desc: 'ديباج وشرح وتحسين.', prompt: 'ساعدني أحل مشكلة في الكود أو المشروع.', mode: 'Code helper', icon: Code2 }
    ],
    typing: 'QLO بيكتب...',
    backendDown: 'الاتصال بالذكاء الاصطناعي مش متفعل دلوقتي. راجع مفاتيح الـ API في Vercel Environment Variables.',
    noProviders: 'مفيش مزوّد AI متفعل حاليًا. ضيف GEMINI_API_KEY أو GROQ_API_KEY أو OPENROUTER_API_KEY من إعدادات Vercel.',
    empty: 'QLO رجّع رد فاضي.',
    memorySaved: 'تم حفظ معلومة بسيطة في ذاكرة QLO.',
    guestHint: 'ضيف: 2 Flash يوميًا. Pro يحتاج تسجيل دخول.',
    settings: 'إعدادات الرد',
    model: 'الموديل',
    mode: 'الوضع',
    startNew: 'محادثة جديدة'
  },
  en: {
    intro: 'Hello, I’m',
    subtitle: 'Ready to help you get started.',
    cards: [
      { id: 'ask', title: 'Ask anything', desc: 'Simple daily chat with QLO.', prompt: '', mode: 'Auto', icon: Sparkles },
      { id: 'study', title: 'Help me study', desc: 'Explain, summarize, and quiz.', prompt: 'Help me study in an organized way today.', mode: 'Study coach', icon: GraduationCap },
      { id: 'ideas', title: 'Organize ideas', desc: 'Turn rough thoughts into steps.', prompt: 'Organize my ideas into clear practical steps.', mode: 'Business planner', icon: Lightbulb },
      { id: 'code', title: 'Fix code issue', desc: 'Debug, explain, and improve.', prompt: 'Help me solve a code or project issue.', mode: 'Code helper', icon: Code2 }
    ],
    typing: 'QLO is typing...',
    backendDown: 'The AI connection is not active yet. Check your API keys in Vercel Environment Variables.',
    noProviders: 'No AI provider is configured yet. Add GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY in Vercel.',
    empty: 'QLO returned an empty response.',
    memorySaved: 'A small detail was saved to QLO memory.',
    guestHint: 'Guest: 2 Flash/day. Pro requires login.',
    settings: 'Response settings',
    model: 'Model',
    mode: 'Mode',
    startNew: 'New chat'
  }
} as const;

function looksLikeNoProvider(text: string) {
  return /no qlo providers|no providers|provider.*configured/i.test(text);
}

export default function Chat() {
  const { lang, user, profile } = useApp();
  const t = labels[lang];
  const copy = lang === 'ar' ? copyByLang.ar : copyByLang.en;
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads());
  const [activeId, setActiveId] = useState<string>(() => loadThreads()[0]?.id || 'new');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [model, setModel] = useState('QLO Flash');
  const loggedIn = Boolean(user || profile);
  const availableModels = loggedIn ? accountModels : guestModels;
  const [mode, setMode] = useState('Auto');
  const [error, setError] = useState('');
  const [memoryNotice, setMemoryNotice] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const animatingRef = useRef(0);

  const active = useMemo(() => threads.find((x) => x.id === activeId), [threads, activeId]);
  const msgs = active?.messages || [];

  useEffect(() => {
    if (!availableModels.some((item) => item.id === model)) setModel('QLO Flash');
  }, [loggedIn, model, availableModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, typing]);

  function setThreadMessages(threadId: string, messages: Msg[]) {
    setThreads((prev) => {
      const next = prev.map((th) => (th.id === threadId ? { ...th, messages } : th));
      saveThreads(next);
      return next;
    });
  }

  function upsertThread(messages: Msg[], userText: string) {
    if (activeId === 'new' || !active) {
      const created: ChatThread = {
        id: crypto.randomUUID(),
        title: userText.slice(0, 42) || 'New chat',
        messages,
        createdAt: new Date().toISOString()
      };
      const next = [created, ...threads].slice(0, 20);
      setThreads(next);
      saveThreads(next);
      setActiveId(created.id);
      return created.id;
    }
    const next = threads.map((th) => (th.id === activeId ? { ...th, messages, title: th.title || userText.slice(0, 42) } : th));
    setThreads(next);
    saveThreads(next);
    return activeId;
  }

  function newChat() {
    setActiveId('new');
    setInput('');
    setError('');
    setMemoryNotice('');
    setTyping(false);
  }

  async function animateReply(threadId: string, afterUser: Msg[], reply: string) {
    const ticket = Date.now();
    animatingRef.current = ticket;
    setTyping(true);
    const clean = reply || copy.empty;
    setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: '' }]);
    await sleep(70);
    const step = clean.length > 1200 ? 26 : clean.length > 500 ? 14 : 8;
    for (let i = step; i <= clean.length; i += step) {
      if (animatingRef.current !== ticket) break;
      setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: clean.slice(0, i) }]);
      await sleep(9);
    }
    setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: clean }]);
    setTyping(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');
    setMemoryNotice('');
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
      const rawReply = data.reply || data.error || copy.empty;
      const reply = looksLikeNoProvider(rawReply) ? copy.noProviders : rawReply;
      if (!r.ok) setError(reply);
      if (data.memory_updated) setMemoryNotice(copy.memorySaved);
      await animateReply(threadId, afterUser, reply);
    } catch {
      setError(copy.backendDown);
      await animateReply(threadId, afterUser, copy.backendDown);
    } finally {
      setLoading(false);
    }
  }

  function selectCard(prompt: string, nextMode: string) {
    setMode(nextMode);
    if (prompt) setInput(prompt);
    textareaRef.current?.focus();
  }

  return (
    <section className="qlo-chat-shell mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col">
      <div className="flex items-center justify-between px-1 py-2 md:py-3">
        <div className="text-sm font-bold soft-text">{loggedIn ? profile?.plan || 'Free' : copy.guestHint}</div>
        <button onClick={newChat} className="qlo-mini-btn">{copy.startNew}</button>
      </div>

      <div className="qlo-chat-scroll flex-1">
        {msgs.length === 0 ? (
          <div className="qlo-empty-state grid min-h-[58vh] place-items-center pb-8 pt-7 text-center md:pb-14 md:pt-14">
            <div className="w-full">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black soft-text">
                <Brain size={16} className="text-[var(--accent-1)]" /> <span>QLO 1.2</span>
              </div>
              <h1 className="mt-7 text-4xl font-black leading-tight md:text-6xl">
                {copy.intro} <span className="grad">QLO 1.2</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg soft-text md:text-2xl">{copy.subtitle}</p>

              <div className="mt-9 grid gap-3 sm:grid-cols-2 md:gap-4">
                {copy.cards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} onClick={() => selectCard(item.prompt, item.mode)} className="qlo-action-card text-start">
                      <span className="qlo-action-icon"><Icon className="h-5 w-5" /></span>
                      <span>
                        <span className="block text-lg font-black md:text-xl">{item.title}</span>
                        <span className="mt-1 block text-sm soft-text">{item.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-6 pt-3 md:pt-6">
            {msgs.map((m, i) => (
              <div key={i} className={`message-bubble flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  dir="auto"
                  className={`qlo-message ${m.role === 'user' ? 'qlo-user-message' : 'qlo-ai-message'}`}
                >
                  <div className="markdownish whitespace-pre-wrap text-[15px] leading-7">
                    {m.content || (typing && i === msgs.length - 1 ? <span className="typing-cursor">▋</span> : '')}
                  </div>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="qlo-ai-message qlo-message text-sm soft-text">{copy.typing}</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 safe-bottom pt-3">
        {(error || memoryNotice) && (
          <div className="mb-3 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm soft-text">
            {memoryNotice || error}
          </div>
        )}

        <div className="qlo-composer">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t.placeholder}
              className="qlo-input"
            />
            <button onClick={() => setShowSettings((v) => !v)} className="qlo-icon-btn" aria-label={copy.settings}>
              <SlidersHorizontal size={20} />
            </button>
            <button onClick={send} disabled={loading || !input.trim()} className="qlo-send-btn" aria-label={t.send}>
              <Send size={20} />
            </button>
          </div>

          {showSettings && (
            <div className="qlo-composer-settings">
              <label className="qlo-select-wrap">
                <span>{copy.model}</span>
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  {availableModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <label className="qlo-select-wrap">
                <span>{copy.mode}</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {modes.map((m) => <option key={m.id} value={m.id}>{m.label[lang === 'ar' ? 'ar' : 'en']}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
