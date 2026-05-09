import { BrainCircuit, Cloud, CreditCard, Globe2, LockKeyhole, Smartphone, Sparkles, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';

const data = {
  ar: {
    badge: 'Qalvero AI',
    title: 'منصة ذكاء وتطبيقات SaaS بواجهة واحدة.',
    subtitle: 'Qalvero بتبني مساعدين AI، أدوات إنتاجية، تطبيقات موبايل، وخدمات سحابية بحساب واحد وخطط واضحة.',
    building: 'اللي Qalvero بتبنيه',
    support: 'الدعم',
    supportText: 'نوع النشاط: Software, AI tools, mobile applications, SaaS. البريد: support@qalvero.com',
    legal: 'صفحات القانون هنا قوالب احترافية وتحتاج مراجعة قبل التشغيل التجاري الكامل.',
    cards: [
      ['منصة AI', 'عائلة QLO 1.2، توجيه ذكي، ذاكرة بسيطة، وحدود استخدام.', BrainCircuit],
      ['موبايل و SaaS', 'تطبيقات إنتاجية وخدمات يومية وتجارب مدعومة بالذكاء.', Smartphone],
      ['حسابات سحابية', 'Supabase Auth، ملفات مستخدم، خطط، وتفضيلات.', Cloud],
      ['تسعير عالمي', 'أسعار حسب الدولة وعرض العملة وخطط Free/Standard/Premium.', Globe2],
      ['ثقة وأمان', 'شروط استخدام، حماية إساءة، وسياسات واضحة.', LockKeyhole],
      ['هوية المؤسس', 'منصة يقودها أحمد أشرف حمزة محمد، مطور مصري مهتم بالـ AI و SaaS.', UserRound]
    ],
    list: ['QLO AI للمذاكرة والكتابة والتخطيط والكود.', 'Qalvero Focus للمهام والتركيز والأهداف.', 'Qalvero Notes للملاحظات والملخصات.', 'Qalvero Cloud للحسابات والمزامنة.']
  },
  en: {
    badge: 'Qalvero AI',
    title: 'AI apps and SaaS tools under one interface.',
    subtitle: 'Qalvero builds AI assistants, productivity tools, mobile apps, and cloud-connected services with one account and clear plans.',
    building: 'What Qalvero is building',
    support: 'Support',
    supportText: 'Business type: Software, AI tools, mobile applications, SaaS. Email: support@qalvero.com',
    legal: 'Legal pages are professional placeholders and should be reviewed before full commercial operation.',
    cards: [
      ['AI Platform', 'QLO 1.2 model family, smart routing, compact memory, and usage limits.', BrainCircuit],
      ['Mobile & SaaS', 'Productivity apps, daily utilities, and AI-powered experiences.', Smartphone],
      ['Cloud Accounts', 'Supabase Auth, user profiles, plans, and preferences.', Cloud],
      ['Global Pricing', 'Country-based pricing, currency display, and Free/Standard/Premium plans.', Globe2],
      ['Trust & Safety', 'Terms, abuse protection, and clear policy pages.', LockKeyhole],
      ['Founder Identity', 'Led by Ahmed Ashraf Hamza Mohamed, an Egyptian developer focused on AI and SaaS.', UserRound]
    ],
    list: ['QLO AI for study, writing, planning, and code.', 'Qalvero Focus for tasks, focus, and goals.', 'Qalvero Notes for notes and summaries.', 'Qalvero Cloud for accounts and sync.']
  }
} as const;

export default function Company() {
  const { lang } = useApp();
  const c = lang === 'ar' ? data.ar : data.en;
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="glass rounded-[2.5rem] p-6 md:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><Sparkles size={14} /> {c.badge}</div>
        <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">{c.title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 soft-text md:text-lg">{c.subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {c.cards.map(([title, text, Icon]) => (
          <article key={title} className="card rounded-[2rem] p-5">
            <Icon className="h-9 w-9 text-[var(--accent-1)]" />
            <h2 className="mt-4 text-xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-7 soft-text">{text}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-black">{c.building}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-7 soft-text">{c.list.map((item) => <li key={item}>• {item}</li>)}</ul>
        </div>
        <div className="glass rounded-[2rem] p-6">
          <h2 className="text-2xl font-black">{c.support}</h2>
          <p className="mt-3 text-sm leading-7 soft-text">{c.supportText}</p>
          <p className="mt-3 text-sm leading-7 soft-text">{c.legal}</p>
        </div>
      </div>
    </section>
  );
}
