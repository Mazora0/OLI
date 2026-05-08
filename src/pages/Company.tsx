import { BrainCircuit, Cloud, CreditCard, Globe2, LockKeyhole, Smartphone, Sparkles, UserRound } from 'lucide-react';

const cards = [
  ['AI Platform', 'QLO 1.2 model family, smart routing, Flash/Pro usage layers, compact memory, and safety controls.', BrainCircuit],
  ['Mobile & SaaS', 'Qalvero builds AI-powered mobile apps, SaaS tools, productivity workflows, and daily digital utilities.', Smartphone],
  ['Cloud Accounts', 'Supabase-ready authentication, account profiles, usage limits, plan state, and lightweight user preferences.', Cloud],
  ['Global Pricing', 'Country-based pricing, local currency display, Free/Standard/Premium plans, and payment hooks for Stripe/PayPal.', Globe2],
  ['Trust & Safety', 'Terms acceptance, abuse detection, usage protection, and clear policy pages for production verification.', LockKeyhole],
  ['Founder Profile', 'Qalvero AI is led by Ahmed Ashraf Hamza Mohamed, an Egyptian developer from Assiut focused on AI and SaaS products.', UserRound]
] as const;

export default function Company() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="glass rounded-[2.5rem] p-6 md:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[.18em] text-cyan-200">
          <Sparkles size={14} /> Qalvero LLC
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">AI apps, productivity tools, and cloud-connected software.</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
          Qalvero LLC is a software company building AI-powered assistants, mobile app experiences, media utilities, productivity systems, notes, cloud sync tools, and SaaS-style digital products for everyday users and businesses.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([title, text, Icon]) => (
          <article key={title} className="card rounded-[2rem] p-5">
            <Icon className="h-9 w-9 text-cyan-300" />
            <h2 className="mt-4 text-xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">{text}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-black">What Qalvero is building</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-slate-300">
            <li>• QLO AI assistant for study, writing, planning, coding, and daily productivity.</li>
            <li>• Qalvero Focus for tasks, Pomodoro, goals, and progress tracking.</li>
            <li>• Qalvero Notes for lightweight notes, reminders, summaries, and sync-ready writing tools.</li>
            <li>• Qalvero Player for modern video/audio experiences across devices.</li>
            <li>• Qalvero Cloud for account sync, user data management, and connected app experiences.</li>
          </ul>
        </div>
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-black">Support</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">Business type: Software, AI tools, mobile applications, SaaS.</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">Support email: support@qalvero.com</p>
          <p className="mt-3 text-sm leading-7 text-slate-400">Legal pages are provided as professional placeholders and must be reviewed before production use. Because apparently lawyers also need something to do.</p>
        </div>
      </div>
    </section>
  );
}
