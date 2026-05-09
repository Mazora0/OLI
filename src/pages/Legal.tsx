import { ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

const data = {
  ar: {
    title: 'مركز القوانين',
    subtitle: 'آخر تحديث: مايو 2026. الصفحات دي قوالب عامة ولازم تتراجع قانونيًا قبل التشغيل الحقيقي.',
    body: 'Qalvero AI بتوفر أدوات ذكاء اصطناعي، تطبيقات إنتاجية، وخدمات سحابية. السياسة دي بتوضح الاستخدام المقبول، الحسابات، البيانات، الدفع، والدعم. استبدل النصوص النهائية بمراجعة قانونية مناسبة لبلدك وطريقة الدفع.',
    items: ['شروط الخدمة', 'سياسة الخصوصية', 'سياسة الاسترجاع', 'سياسة الكوكيز', 'إتاحة الوصول', 'سياسة استخدام البيانات', 'إرشادات المجتمع', 'سياسة المحتوى']
  },
  en: {
    title: 'Legal Center',
    subtitle: 'Last updated: May 2026. These are general templates and should be legally reviewed before production use.',
    body: 'Qalvero AI provides AI tools, productivity apps, and cloud-connected services. This policy explains acceptable use, accounts, data, payments, and support. Replace final language after legal review for your jurisdiction and payment setup.',
    items: ['Terms of Service', 'Privacy Policy', 'Refund Policy', 'Cookie Policy', 'Accessibility Statement', 'Data Usage Policy', 'Community Guidelines', 'Content Policy']
  }
} as const;

export default function Legal() {
  const { lang } = useApp();
  const c = lang === 'ar' ? data.ar : data.en;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><ShieldCheck size={14} /> Qalvero AI</div>
      <h1 className="text-4xl font-black md:text-6xl">{c.title}</h1>
      <p className="mt-3 soft-text">{c.subtitle}</p>
      <div className="mt-6 grid gap-4">
        {c.items.map((item) => (
          <section key={item} className="glass rounded-[2rem] p-5">
            <h2 className="text-2xl font-black">{item}</h2>
            <p className="mt-2 text-sm leading-7 soft-text">{c.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
