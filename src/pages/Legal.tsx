import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, LockKeyhole, LogIn, Mail, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

const companyEmail = 'mazo3211@outlook.com';

const data = {
  ar: {
    badge: 'Qalvero Legal',
    kicker: 'مركز الثقة والشروط',
    title: 'شروط وأحكام Qalvero AI',
    subtitle: 'إطار واضح لاستخدام Qalvero AI، حماية الحساب، الدفع، البيانات، ومخرجات الذكاء الاصطناعي. آخر تحديث: 12 مايو 2026.',
    login: 'الرجوع لتسجيل الدخول',
    back: 'الرجوع للتطبيق',
    contact: 'التواصل الرسمي',
    contactText: `للاستفسارات القانونية أو الدعم العام: ${companyEmail}`,
    summary: ['استخدم الخدمة بشكل قانوني وآمن.', 'راجع مخرجات AI قبل الاعتماد عليها.', 'أنت مسؤول عن حسابك ومفاتيحك الشخصية.', 'الخطط والحدود قد تتغير بإشعار مناسب.'],
    sections: [
      ['قبول الشروط', 'باستخدام Qalvero AI أو إنشاء حساب داخل المنصة، أنت توافق على شروط الخدمة وسياسة الخصوصية وأي قواعد تظهر داخل المنتج. إذا لم توافق على هذه الشروط، يجب عدم استخدام الخدمة.'],
      ['وصف الخدمة', 'Qalvero AI منصة مصرية لتطوير منتجات رقمية وتجارب ذكاء اصطناعي تساعد في الكتابة، الشرح، التلخيص، البرمجة، البحث، إنشاء واجهات ومشاريع رقمية، وتنظيم مهام الإنتاجية. بعض المميزات تعتمد على مزودي ذكاء اصطناعي وخدمات سحابية خارجية.'],
      ['الحساب والأمان', 'أنت مسؤول عن حماية حسابك وكلمة المرور وأي مفاتيح API تضيفها بنفسك. لا تشارك بيانات الدخول أو المفاتيح مع غيرك. يحق لـ Qalvero تقييد الحساب عند وجود إساءة استخدام أو مخالفة واضحة.'],
      ['الاستخدام المقبول', 'يجب استخدام Qalvero AI بطريقة قانونية ومحترمة. ممنوع استخدام المنصة في الإضرار بالآخرين، انتهاك الخصوصية، التحايل، نشر محتوى مسيء، أو أي نشاط يخالف القانون أو شروط مزودي الخدمة.'],
      ['مخرجات الذكاء الاصطناعي', 'المخرجات قد تحتوي على أخطاء أو معلومات ناقصة. يجب مراجعة أي رد قبل استخدامه في قرارات مهمة، خاصة في الطب، القانون، المال، الدراسة الرسمية، أو الإنتاج التجاري.'],
      ['البيانات والخصوصية', 'قد تحفظ المنصة بيانات الحساب الأساسية، الإعدادات، الاستخدام، وذاكرة مختصرة عند تفعيلها. سجل الشات المحلي يحفظ كنص فقط على جهازك، وسجل الحساب السحابي يحتفظ به لمدة شهر واحد عند تفعيل حفظ الحساب.'],
      ['مفاتيح API الشخصية', 'إذا أضفت مفتاح AI شخصي، يتم استخدامه للطلبات التي تختارها. أنت مسؤول عن تكلفة المفتاح وحدوده وشروط مزوده. Qalvero لا يضمن عمل أي مفتاح خارجي إذا كان غير صالح أو محدودًا أو منتهي الصلاحية.'],
      ['الخطط والدفع', 'قد تحتوي المنصة على خطط مجانية ومدفوعة بحدود مختلفة. الأسعار والحدود والمميزات قابلة للتغيير مع إشعار مناسب داخل المنتج أو صفحة الأسعار. عمليات الدفع تخضع لشروط مزود الدفع المستخدم.'],
      ['الملكية الفكرية', 'اسم Qalvero AI، التصميمات، الواجهات، النصوص، والشعارات الخاصة بالمنصة مملوكة لصاحب المشروع أو مرخصة له. أنت تحتفظ بحقوق المحتوى الذي تدخله مع منح المنصة حق معالجته لتقديم الخدمة.'],
      ['التوفر والتعديلات', 'قد تتوقف الخدمة مؤقتًا للصيانة، حدود استخدام، أو مشاكل تقنية. يحق لـ Qalvero تعديل أو إزالة مميزات لتحسين الأمان، الأداء، الجودة، أو الامتثال.'],
      ['حدود المسؤولية', 'تُقدم الخدمة كما هي. إلى أقصى حد يسمح به القانون، لا تتحمل Qalvero مسؤولية خسائر غير مباشرة أو قرارات اتخذتها بناءً على مخرجات AI غير مراجعة.'],
      ['التواصل', `للدعم أو الاستفسارات الرسمية، يمكن التواصل عبر البريد: ${companyEmail}.`]
    ]
  },
  en: {
    badge: 'Qalvero Legal',
    kicker: 'Trust & Terms Center',
    title: 'Qalvero AI Terms and Conditions',
    subtitle: 'A clear framework for using Qalvero AI, account safety, billing, data, and AI outputs. Last updated: May 12, 2026.',
    login: 'Back to login',
    back: 'Back to app',
    contact: 'Official contact',
    contactText: `For legal questions or general support: ${companyEmail}`,
    summary: ['Use the service lawfully and safely.', 'Review AI outputs before relying on them.', 'You are responsible for your account and personal keys.', 'Plans and limits may change with reasonable notice.'],
    sections: [
      ['Acceptance', 'By using Qalvero AI or creating an account, you agree to these terms, the privacy policy, and any in-product rules. Do not use the service if you do not agree.'],
      ['Service description', 'Qalvero AI is an Egyptian digital-product and AI-experience platform that helps with writing, explanations, summaries, coding, research, digital projects, and productivity workflows. Some features depend on external AI providers and cloud services.'],
      ['Account security', 'You are responsible for your account, password, and any API keys you add. Do not share login details or keys. Qalvero may restrict accounts involved in abuse or clear policy violations.'],
      ['Acceptable use', 'Use Qalvero AI lawfully and respectfully. Do not use the platform to harm others, violate privacy, evade rules, publish abusive content, or break applicable law or provider terms.'],
      ['AI outputs', 'AI outputs can be wrong or incomplete. Review results before using them for important decisions, especially medical, legal, financial, academic, or commercial work.'],
      ['Data and privacy', 'The platform may store basic account data, settings, usage, and compact memory when enabled. Local chat history is stored as text only on your device, while cloud account history is retained for one month when account history is enabled.'],
      ['Personal API keys', 'If you add a personal AI API key, it is used for requests you choose. You are responsible for provider costs, limits, and terms. Qalvero does not guarantee external keys if they are invalid, limited, or expired.'],
      ['Plans and billing', 'The platform may offer free and paid plans with different limits. Pricing, limits, and features may change with reasonable notice in-product or on the pricing page. Payments are subject to the terms of the selected payment provider.'],
      ['Intellectual property', 'The Qalvero AI name, product design, interface, text, and brand assets belong to the project owner or are licensed to them. You keep rights to your input while granting the platform permission to process it to provide the service.'],
      ['Availability and changes', 'The service may be interrupted for maintenance, usage limits, or technical issues. Qalvero may modify or remove features to improve safety, performance, quality, or compliance.'],
      ['Liability limits', 'The service is provided as-is. To the maximum extent allowed by law, Qalvero is not responsible for indirect losses or decisions made from unreviewed AI output.'],
      ['Contact', `For support or official questions, contact: ${companyEmail}.`]
    ]
  }
} as const;

export default function Legal() {
  const { lang } = useApp();
  const c = lang === 'ar' ? data.ar : data.en;
  return (
    <div className="qlo-legal-page mx-auto max-w-5xl pb-10">
      <section className="qlo-legal-hero">
        <div className="qlo-legal-badge"><ShieldCheck size={14} /> {c.badge}</div>
        <p className="qlo-legal-kicker"><Sparkles size={16} /> {c.kicker}</p>
        <h1>{c.title}</h1>
        <p className="qlo-legal-subtitle">{c.subtitle}</p>
        <div className="qlo-legal-summary">
          {c.summary.map((item) => <div key={item}><CheckIcon /> <span>{item}</span></div>)}
        </div>
      </section>

      <section className="qlo-legal-contact">
        <div><Mail size={20} /><div><b>{c.contact}</b><p>{c.contactText}</p></div></div>
        <Link to="/login" className="btn btn-primary"><LogIn size={17} /> {c.login}</Link>
      </section>

      <div className="qlo-legal-grid">
        {c.sections.map(([title, body], index) => (
          <section key={title} className="qlo-legal-card">
            <div className="qlo-legal-icon">{index % 3 === 0 ? <Scale size={19} /> : index % 3 === 1 ? <FileText size={19} /> : <LockKeyhole size={19} />}</div>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="qlo-legal-bottom">
        <Link to="/login" className="btn btn-primary"><LogIn size={17} /> {c.login}</Link>
        <Link to="/" className="btn"><ArrowLeft size={17} /> {c.back}</Link>
      </div>
    </div>
  );
}

function CheckIcon() {
  return <span className="qlo-legal-check">✓</span>;
}
