import { Link } from 'react-router-dom';
import { ArrowLeft, LogIn, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

const data = {
  ar: {
    badge: 'Qalvero Legal',
    title: 'شروط وأحكام Qalvero AI',
    subtitle: 'آخر تحديث: 12 مايو 2026. باستخدامك Qalvero AI فأنت توافق على القواعد التالية.',
    login: 'الرجوع لتسجيل الدخول',
    back: 'الرجوع للتطبيق',
    sections: [
      ['قبول الشروط', 'باستخدام Qalvero AI أو إنشاء حساب داخل المنصة، أنت توافق على شروط الخدمة وسياسة الخصوصية وأي قواعد تظهر داخل المنتج. إذا لم توافق، لا تستخدم الخدمة.'],
      ['وصف الخدمة', 'Qalvero AI منصة أدوات ذكاء اصطناعي تساعد في الكتابة، الشرح، التلخيص، البرمجة، البحث، إنشاء واجهات ومشاريع رقمية، وتنظيم مهام الإنتاجية. بعض المميزات تعتمد على مزودي ذكاء اصطناعي وخدمات سحابية خارجية.'],
      ['الحساب والأمان', 'أنت مسؤول عن حماية حسابك وكلمة المرور وأي مفاتيح API تضيفها بنفسك. لا تشارك بيانات الدخول مع غيرك. يحق لـ Qalvero تقييد الحساب عند وجود إساءة استخدام أو مخالفة واضحة.'],
      ['الاستخدام المقبول', 'يجب استخدام Qalvero AI بطريقة قانونية ومحترمة. ممنوع استخدام المنصة في الإضرار بالآخرين، انتهاك الخصوصية، التحايل، نشر محتوى مسيء، أو أي نشاط يخالف القانون أو شروط مزودي الخدمة.'],
      ['مخرجات الذكاء الاصطناعي', 'المخرجات قد تحتوي على أخطاء أو معلومات ناقصة. يجب مراجعة أي رد قبل استخدامه في قرارات مهمة، خاصة في الطب، القانون، المال، الدراسة الرسمية، أو الإنتاج التجاري.'],
      ['البيانات والخصوصية', 'قد تحفظ المنصة بيانات الحساب الأساسية، الإعدادات، الاستخدام، وذاكرة مختصرة عند تفعيلها. سجل الشات المحلي يحفظ كنص فقط على جهازك ويتم تنظيفه تلقائيًا بعد فترة الاحتفاظ المحددة.'],
      ['مفاتيح API الشخصية', 'إذا أضفت مفتاح AI شخصي، يتم استخدامه للطلبات التي تختارها. أنت مسؤول عن تكلفة المفتاح وحدوده وشروط مزوده. Qalvero لا يضمن عمل أي مفتاح خارجي إذا كان غير صالح أو محدودًا.'],
      ['الخطط والدفع', 'قد تحتوي المنصة على خطط مجانية ومدفوعة بحدود مختلفة. الأسعار والحدود والمميزات قابلة للتغيير مع إشعار مناسب داخل المنتج أو صفحة الأسعار.'],
      ['الملكية الفكرية', 'اسم Qalvero AI، التصميمات، الواجهات، النصوص، والشعارات الخاصة بالمنصة مملوكة لصاحب المشروع أو مرخصة له. أنت تحتفظ بحقوق المحتوى الذي تدخله.'],
      ['التوفر والتعديلات', 'قد تتوقف الخدمة مؤقتًا للصيانة، حدود استخدام، أو مشاكل تقنية. يحق لـ Qalvero تعديل أو إزالة مميزات لتحسين الأمان، الأداء، أو الامتثال.'],
      ['حدود المسؤولية', 'تُقدم الخدمة كما هي. إلى أقصى حد يسمح به القانون، لا تتحمل Qalvero مسؤولية خسائر غير مباشرة أو قرارات اتخذتها بناءً على مخرجات AI غير مراجعة.'],
      ['التواصل', 'للدعم أو الاستفسارات، استخدم قنوات التواصل الرسمية داخل التطبيق أو صفحة الدعم عند توفرها.']
    ]
  },
  en: {
    badge: 'Qalvero Legal',
    title: 'Qalvero AI Terms and Conditions',
    subtitle: 'Last updated: May 12, 2026. By using Qalvero AI, you agree to the rules below.',
    login: 'Back to login',
    back: 'Back to app',
    sections: [
      ['Acceptance', 'By using Qalvero AI or creating an account, you agree to these terms, the privacy policy, and any in-product rules. Do not use the service if you do not agree.'],
      ['Service description', 'Qalvero AI provides AI tools for writing, explanations, summaries, coding, research, digital projects, and productivity workflows. Some features depend on external AI providers and cloud services.'],
      ['Account security', 'You are responsible for your account, password, and any API keys you add. Do not share login details. Qalvero may restrict accounts involved in abuse or clear policy violations.'],
      ['Acceptable use', 'Use Qalvero AI lawfully and respectfully. Do not use the platform to harm others, violate privacy, evade rules, publish abusive content, or break applicable law or provider terms.'],
      ['AI outputs', 'AI outputs can be wrong or incomplete. Review results before using them for important decisions, especially medical, legal, financial, academic, or commercial work.'],
      ['Data and privacy', 'The platform may store basic account data, settings, usage, and compact memory when enabled. Local chat history is stored as text only on your device and cleaned automatically based on the retention policy.'],
      ['Personal API keys', 'If you add a personal AI API key, it is used for requests you choose. You are responsible for provider costs, limits, and terms. Qalvero does not guarantee external keys.'],
      ['Plans and billing', 'The platform may offer free and paid plans with different limits. Pricing, limits, and features may change with reasonable notice in-product or on the pricing page.'],
      ['Intellectual property', 'The Qalvero AI name, product design, interface, text, and brand assets belong to the project owner or are licensed to them. You keep rights to your input.'],
      ['Availability and changes', 'The service may be interrupted for maintenance, usage limits, or technical issues. Qalvero may modify or remove features to improve safety, performance, or compliance.'],
      ['Liability limits', 'The service is provided as-is. To the maximum extent allowed by law, Qalvero is not responsible for indirect losses or decisions made from unreviewed AI output.'],
      ['Contact', 'For support or questions, use official in-app channels or the support page when available.']
    ]
  }
} as const;

export default function Legal() {
  const { lang } = useApp();
  const c = lang === 'ar' ? data.ar : data.en;
  return (
    <div className="mx-auto max-w-4xl pb-10">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><ShieldCheck size={14} /> {c.badge}</div>
      <h1 className="text-4xl font-black md:text-6xl">{c.title}</h1>
      <p className="mt-3 max-w-2xl leading-7 soft-text">{c.subtitle}</p>
      <div className="mt-6 grid gap-3">
        {c.sections.map(([title, body]) => (
          <section key={title} className="glass rounded-[1.6rem] p-5">
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm leading-7 soft-text">{body}</p>
          </section>
        ))}
      </div>
      <div className="sticky bottom-4 mt-6 flex flex-wrap gap-3 rounded-[1.5rem] border border-white/10 bg-black/50 p-3 backdrop-blur-xl">
        <Link to="/login" className="btn btn-primary"><LogIn size={17} /> {c.login}</Link>
        <Link to="/" className="btn"><ArrowLeft size={17} /> {c.back}</Link>
      </div>
    </div>
  );
}
