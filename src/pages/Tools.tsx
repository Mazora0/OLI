import { BookOpen, BriefcaseBusiness, Code2, FileText, Languages, ListTodo, NotebookPen, Timer, Wand2 } from 'lucide-react';

const tools = [
  ['AI Study Coach', 'Plans, quizzes, explanations, and exam prep.', BookOpen, 'QLO Study'],
  ['Writing Studio', 'Emails, posts, product copy, scripts, and rewrites.', NotebookPen, 'QLO Creative'],
  ['Code Helper', 'Debugging, architecture, prompts, and implementation plans.', Code2, 'QLO Code'],
  ['Business Planner', 'Pricing, launch plans, SaaS ideas, and strategy.', BriefcaseBusiness, 'QLO Pro'],
  ['Summarizer', 'Turn long notes into action points and summaries.', FileText, 'QLO Flash'],
  ['Translator', 'Multi-language translation with context and tone.', Languages, 'QLO Pro'],
  ['Task Builder', 'Break big goals into daily steps.', ListTodo, 'QLO Flash'],
  ['Focus Timer', 'Pomodoro-ready productivity flow.', Timer, 'Qalvero Focus'],
  ['Prompt Library', 'Reusable prompts for work, study, and projects.', Wand2, 'QLO Tools']
] as const;

export default function Tools() {
  return <section className="mx-auto max-w-6xl"><div className="mb-6"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Wand2 size={14} /> AI Tools Hub</div><h1 className="mt-4 text-4xl font-black md:text-6xl">More than a chatbot.</h1><p className="mt-3 max-w-2xl text-slate-400">Qalvero is structured as an AI productivity ecosystem: chat, tools, notes, focus, planning, writing, code, and study workflows.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tools.map(([title, text, Icon, badge]) => <div key={title} className="card rounded-[2rem] p-5"><div className="mb-5 flex items-start justify-between gap-3"><Icon className="h-9 w-9 text-cyan-300" /><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{badge}</span></div><h3 className="text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div></section>;
}
