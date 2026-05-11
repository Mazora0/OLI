import { BookOpen, BriefcaseBusiness, Code2, FileText, Languages, Layers3, ListTodo, NotebookPen, Timer, Wand2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useState, useEffect } from 'react';

const data = {
  ar: {
    badge: 'مركز الأدوات',
    title: 'مش مجرد شات.',
    subtitle: 'Qalvero AI متقسم لأدوات إنتاجية للمذاكرة والكتابة والكود والتخطيط. الأدوات دي واجهة منظمة لنفس موديلات QLO المدعومة.',
    tools: [
      ['مدرب مذاكرة', 'خطط، أسئلة، شرح، ومراجعة امتحانات.', BookOpen, 'QLO 1.2 Study'],
      ['استوديو كتابة', 'إيميلات، بوستات، سكريبتات، وإعادة صياغة.', NotebookPen, 'QLO 1.2 Pro'],
      ['مساعد كود', 'ديباج، شرح أخطاء، وخطط تنفيذ.', Code2, 'QLO 1.3 Agent'],
      ['مخطط مشاريع', 'تسعير، إطلاق، أفكار SaaS، واستراتيجية.', BriefcaseBusiness, 'QLO 1.3 Pro'],
      ['تلخيص', 'حوّل النص الطويل لنقاط عملية.', FileText, 'QLO 1.2 Flash'],
      ['ترجمة', 'ترجمة بسياق ونبرة مناسبة.', Languages, 'QLO 1.3 Pro'],
      ['منظم مهام', 'قسّم الهدف الكبير لخطوات يومية.', ListTodo, 'QLO 1.2 Flash'],
      ['تركيز', 'نظام Pomodoro وتجهيز جلسات إنتاجية.', Timer, 'Qalvero Focus'],
      ['مكتبة Prompts', 'Prompts جاهزة للشغل والمذاكرة والمشاريع.', Wand2, 'QLO Tools'],
      ['QLO Agents', 'المهندس والمطور والمحلل والكاتب في Workflow واحد.', Layers3, 'Max']
    ]
  },
  en: {
    badge: 'AI Tools Hub',
    title: 'More than a chatbot.',
    subtitle: 'Qalvero AI is organized into productivity tools for study, writing, code, planning, and daily workflows. These tools are structured fronts for the supported QLO models.',
    tools: [
      ['AI Study Coach', 'Plans, quizzes, explanations, and exam prep.', BookOpen, 'QLO 1.2 Study'],
      ['Writing Studio', 'Emails, posts, product copy, scripts, and rewrites.', NotebookPen, 'QLO 1.2 Pro'],
      ['Code Helper', 'Debugging, architecture, prompts, and implementation plans.', Code2, 'QLO 1.3 Agent'],
      ['Business Planner', 'Pricing, launch plans, SaaS ideas, and strategy.', BriefcaseBusiness, 'QLO 1.3 Pro'],
      ['Summarizer', 'Turn long notes into action points and summaries.', FileText, 'QLO 1.2 Flash'],
      ['Translator', 'Multi-language translation with context and tone.', Languages, 'QLO 1.3 Pro'],
      ['Task Builder', 'Break big goals into daily steps.', ListTodo, 'QLO 1.2 Flash'],
      ['Focus Timer', 'Pomodoro-ready productivity flow.', Timer, 'Qalvero Focus'],
      ['Prompt Library', 'Reusable prompts for work, study, and projects.', Wand2, 'QLO Tools'],
      ['QLO Agents', 'Architect, Developer, Analyst, and Writer in one workflow.', Layers3, 'Max']
    ]
  }
} as const;

export default function Tools() {
  const { lang } = useApp();
  const c = lang === 'ar' ? data.ar : data.en;
  // State to track which tools are enabled. Uses Set for easy add/remove.
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  // Create a slug ID from a tool title to use as a stable key.
  function slug(title: string) {
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  // Load enabled tools from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('qv_enabled_tools');
      if (stored) {
        setEnabled(new Set(JSON.parse(stored)));
      }
    } catch {
      /* ignore parse errors */
    }
  }, []);

  // Persist enabled tools to localStorage whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem('qv_enabled_tools', JSON.stringify(Array.from(enabled)));
    } catch {
      /* ignore write errors */
    }
  }, [enabled]);

  // Toggle the enabled state of a tool by ID.
  function toggle(id: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  return (
    <section className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Wand2 size={14} /> {c.badge}</div>
        <h1 className="mt-4 text-4xl font-black md:text-6xl">{c.title}</h1>
        <p className="mt-3 max-w-2xl soft-text">{c.subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {c.tools.map(([title, text, Icon, badge]) => {
          const id = slug(String(title));
          const isEnabled = enabled.has(id);
          return (
            <div key={title} className="card rounded-[2rem] p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <Icon className="h-9 w-9 text-[var(--accent-1)]" />
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black">{badge}</span>
              </div>
              <h3 className="text-xl font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 soft-text">{text}</p>
              <button
                onClick={() => toggle(id)}
                className={`btn mt-4 ${isEnabled ? 'btn-primary' : 'btn-soft'}`}
              >
                {isEnabled ? (lang === 'ar' ? 'مفعّل' : 'Enabled') : (lang === 'ar' ? 'تفعيل' : 'Enable')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
