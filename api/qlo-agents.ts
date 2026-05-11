import { createClient } from '@supabase/supabase-js';
import { qloMcpPrompts, qloMcpResources, qloMcpTools } from './_mcp';
import { checkApiRateLimit, logApiError, logUsageEvent, estimateTokens } from './_observability';

type ChatRole = 'system' | 'user' | 'assistant';
type ChatMessage = { role: ChatRole; content: string };
type AgentId = 'architect' | 'developer' | 'analyst' | 'writer';
type UserPlan = 'Free' | 'Standard' | 'Premium' | 'Max';
type WorkspaceFile = { name: string; type: string; size: number; kind: 'text' | 'image' | 'binary'; content?: string; dataUrl?: string };
type UserAiProvider = 'gemini' | 'openrouter' | 'groq' | 'deepseek';
type UserAiConfig = { enabled?: boolean; provider?: UserAiProvider; apiKey?: string; model?: string; test?: boolean };

const agentNames: Record<AgentId, { en: string; ar: string }> = {
  architect: { en: 'Architect', ar: 'المهندس' },
  developer: { en: 'Developer', ar: 'المطور' },
  analyst: { en: 'Analyst', ar: 'المحلل' },
  writer: { en: 'Writer', ar: 'الكاتب' }
};

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getUserPlan(req: any): Promise<UserPlan> {
  const admin = getSupabaseAdmin();
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!admin || !token) return 'Free';
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return 'Free';
  const { data: sub } = await admin.from('qv_subscriptions').select('plan,status').eq('user_id', user.id).in('status', ['active', 'trialing']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: profile } = await admin.from('qv_profiles').select('plan').eq('id', user.id).maybeSingle();
  const plan = String(sub?.plan || profile?.plan || 'Free');
  return ['Free', 'Standard', 'Premium', 'Max'].includes(plan) ? plan as UserPlan : 'Free';
}

function isArabic(value = '') {
  return /[\u0600-\u06FF]/.test(value);
}

type OutputLang = 'ar' | 'ar-EG' | 'en' | 'fr' | 'es' | 'de' | 'tr' | 'ja';

function detectRequestedLanguage(prompt: string, fallback = 'en'): OutputLang {
  const text = String(prompt || '').toLowerCase();
  if (/(عامية مصرية|مصري|بالعامية|egyptian arabic|arabic egyptian|in egyptian)/i.test(text)) return 'ar-EG';
  if (/(بالعربي|لغة عربية|arabic|in arabic|فصحى|الفصحى)/i.test(text) || isArabic(prompt)) return 'ar';
  if (/(بالفرنسي|فرنساوي|french|in french|français)/i.test(text)) return 'fr';
  if (/(بالاسباني|بالإسباني|spanish|in spanish|español)/i.test(text)) return 'es';
  if (/(بالالماني|بالألماني|german|in german|deutsch)/i.test(text)) return 'de';
  if (/(بالتركي|turkish|in turkish|türkçe)/i.test(text)) return 'tr';
  if (/(بالياباني|japanese|in japanese|日本語)/i.test(text)) return 'ja';
  if (/(بالانجليزي|بالإنجليزي|english|in english)/i.test(text)) return 'en';
  const f = String(fallback || 'en');
  if (['ar', 'en', 'fr', 'es', 'de', 'tr', 'ja'].includes(f)) return f as OutputLang;
  return 'en';
}

function languageCopy(outputLang: OutputLang) {
  const map: Record<OutputLang, { dir: 'rtl' | 'ltr'; htmlLang: string; defaultBrand: string; readyBadge: string; subtitle: string; cta: string; secondary: string; cardText: string; cardTextJsx: string; overview: string; template: string; style: string; run: string; footer: string; rawUsed: string; rawCustomized: string; defaultItems: string[] }> = {
    ar: { dir: 'rtl', htmlLang: 'ar', defaultBrand: 'مشروعك', readyBadge: '✦ Qalvero Build Ready', subtitle: 'تم تجهيز المشروع داخل Qalvero حسب طلبك مع واجهة قابلة للتشغيل والتحميل والطباعة PDF.', cta: 'ابدأ الآن', secondary: 'معاينة التفاصيل', cardText: 'قسم قابل للتعديل حسب اسم المشروع والمحتوى المطلوب.', cardTextJsx: 'قسم قابل للتعديل حسب طلبك.', overview: 'نظرة سريعة', template: 'نوع المشروع', style: 'النمط', run: 'التشغيل', footer: 'جاهز للتحميل والتعديل والرفع على أي استضافة تدعم Vite أو HTML.', rawUsed: 'تم تجهيز المشروع بكفاءة وبشكل مخصص', rawCustomized: 'تم تخصيص الاسم والمظهر واللغة والنصوص حسب طلبك، مع الحفاظ على التشغيل والتصدير.', defaultItems: ['القسم الرئيسي', 'المميزات', 'المعرض', 'التصدير'] },
    'ar-EG': { dir: 'rtl', htmlLang: 'ar-EG', defaultBrand: 'مشروعك', readyBadge: '✦ Qalvero Build Ready', subtitle: 'تم تجهيز المشروع داخل Qalvero حسب طلبك، ويشتغل محلي ويتحمّل ويتطبع PDF.', cta: 'ابدأ دلوقتي', secondary: 'شوف التفاصيل', cardText: 'قسم جاهز يتعدل على اسم المشروع والكلام اللي المستخدم طلبه.', cardTextJsx: 'قسم جاهز يتعدل حسب طلبك.', overview: 'نظرة سريعة', template: 'نوع المشروع', style: 'الستايل', run: 'التشغيل', footer: 'جاهز للتحميل والتعديل والرفع على أي استضافة تدعم Vite أو HTML.', rawUsed: 'تم تجهيز المشروع بكفاءة وبشكل مخصص', rawCustomized: 'اتخصص الاسم والشكل واللغة والكلام حسب طلبك مع الحفاظ على التشغيل والتصدير.', defaultItems: ['الرئيسية', 'المميزات', 'المعرض', 'تحميل'] },
    en: { dir: 'ltr', htmlLang: 'en', defaultBrand: 'Your Project', readyBadge: '✦ Qalvero Build Ready', subtitle: 'A Qalvero project prepared from your request with a runnable, downloadable, PDF-printable interface.', cta: 'Get started', secondary: 'View details', cardText: 'Section customized around the project name and requested content.', cardTextJsx: 'Section customized for your request.', overview: 'Quick overview', template: 'Project type', style: 'Style', run: 'Run', footer: 'Ready to download, customize, and upload to any host that supports Vite or HTML.', rawUsed: 'Prepared efficiently with a customized build flow', rawCustomized: 'Name, visual style, language, and copy were customized from your request while preserving runtime and export behavior.', defaultItems: ['Main Section', 'Features', 'Gallery', 'Export'] },
    fr: { dir: 'ltr', htmlLang: 'fr', defaultBrand: 'Votre Projet', readyBadge: '✦ Qalvero Build Ready', subtitle: 'Un projet Qalvero préparé selon votre demande avec une interface exécutable, téléchargeable et imprimable en PDF.', cta: 'Commencer', secondary: 'Voir les détails', cardText: 'Section, adaptée au nom du projet et au contenu demandé.', cardTextJsx: 'Section adaptée à votre demande.', overview: 'Aperçu rapide', template: 'Type de projet', style: 'Style', run: 'Exécution', footer: 'Prêt à télécharger, modifier et publier sur tout hébergement compatible Vite ou HTML.', rawUsed: 'Projet préparé efficacement et personnalisé', rawCustomized: 'Le nom, le style visuel, la langue et les textes ont été personnalisés selon votre demande, tout en conservant l’exécution et l’export.', defaultItems: ['Section principale', 'Fonctionnalités', 'Galerie', 'Export'] },
    es: { dir: 'ltr', htmlLang: 'es', defaultBrand: 'Tu Proyecto', readyBadge: '✦ Qalvero Build Ready', subtitle: 'Un proyecto Qalvero preparado según tu solicitud con una interfaz ejecutable, descargable e imprimible en PDF.', cta: 'Empezar', secondary: 'Ver detalles', cardText: 'Sección adaptada al nombre del proyecto y al contenido solicitado.', cardTextJsx: 'Sección adaptada a tu solicitud.', overview: 'Vista rápida', template: 'Tipo de proyecto', style: 'Estilo', run: 'Ejecución', footer: 'Lista para descargar, editar y subir a cualquier hosting compatible con Vite o HTML.', rawUsed: 'Proyecto preparado eficientemente y personalizado', rawCustomized: 'El nombre, el estilo visual, el idioma y los textos se personalizaron según tu solicitud, preservando ejecución y exportación.', defaultItems: ['Sección principal', 'Funciones', 'Galería', 'Exportar'] },
    de: { dir: 'ltr', htmlLang: 'de', defaultBrand: 'Ihr Projekt', readyBadge: '✦ Qalvero Build Ready', subtitle: 'Ein Qalvero-Projekt, angepasst an Ihre Anfrage, mit lauffähiger, herunterladbarer und PDF-druckbarer Oberfläche.', cta: 'Starten', secondary: 'Details ansehen', cardText: 'Abschnitt, angepasst an Projektname und gewünschten Inhalt.', cardTextJsx: 'Abschnitt passend zur Anfrage.', overview: 'Kurzübersicht', template: 'Projekttyp', style: 'Stil', run: 'Start', footer: 'Bereit zum Herunterladen, Anpassen und Hochladen auf jedes Vite- oder HTML-Hosting.', rawUsed: 'Effizient und individuell vorbereitet', rawCustomized: 'Name, visueller Stil, Sprache und Texte wurden angepasst, während Laufzeit und Export erhalten bleiben.', defaultItems: ['Hauptbereich', 'Funktionen', 'Galerie', 'Export'] },
    tr: { dir: 'ltr', htmlLang: 'tr', defaultBrand: 'Projeniz', readyBadge: '✦ Qalvero Build Ready', subtitle: 'İsteğinize göre hazırlanmış, çalıştırılabilir, indirilebilir ve PDF olarak yazdırılabilir bir Qalvero projesi.', cta: 'Başla', secondary: 'Detayları gör', cardText: 'Proje adına ve istenen içeriğe göre uyarlanmış bölüm.', cardTextJsx: 'İsteğinize göre uyarlanmış bölüm.', overview: 'Hızlı bakış', template: 'Proje türü', style: 'Stil', run: 'Çalıştırma', footer: 'Vite veya HTML destekleyen herhangi bir hostinge yüklemek için hazır.', rawUsed: 'Verimli ve özel şekilde hazırlandı', rawCustomized: 'Ad, görsel stil, dil ve metinler isteğinize göre özelleştirildi; çalışma ve dışa aktarma korunur.', defaultItems: ['Ana bölüm', 'Özellikler', 'Galeri', 'Dışa aktar'] },
    ja: { dir: 'ltr', htmlLang: 'ja', defaultBrand: 'あなたのプロジェクト', readyBadge: '✦ Qalvero Build Ready', subtitle: '依頼内容に合わせて作成された実行・ダウンロード・PDF印刷対応のQalveroプロジェクトです。', cta: '開始する', secondary: '詳細を見る', cardText: 'プロジェクト名と要求内容に合わせて調整されたセクションです。', cardTextJsx: '依頼内容に合わせて調整されたセクションです。', overview: '概要', template: 'プロジェクト種別', style: 'スタイル', run: '実行', footer: 'Vite または HTML 対応ホスティングへアップロードできる状態です。', rawUsed: '効率的かつカスタムに準備されました', rawCustomized: '名称、デザイン、言語、文章を依頼内容に合わせて調整し、実行とエクスポートを維持しました。', defaultItems: ['メイン', '機能', 'ギャラリー', 'エクスポート'] }
  };
  return map[outputLang] || map.en;
}

function localizedTemplateName(template: TemplateId, outputLang: OutputLang) {
  const meta = getTemplateMeta(template);
  if (!meta) return languageCopy(outputLang).template;
  if (outputLang === 'ar' || outputLang === 'ar-EG') return meta.ar;
  const names: Partial<Record<OutputLang, Partial<Record<TemplateId, string>>>> = {
    fr: { ecommerce: 'Boutique en ligne', landing: 'Page d’atterrissage', dashboard: 'Tableau de bord', portfolio: 'Portfolio', restaurant: 'Restaurant / Café', school: 'Académie', invoice: 'Facture', tool: 'Outil interactif', chatbot: 'Interface Chatbot' },
    es: { ecommerce: 'Tienda online', landing: 'Página de aterrizaje', dashboard: 'Panel', portfolio: 'Portafolio', restaurant: 'Restaurante / Café', school: 'Academia', invoice: 'Factura', tool: 'Herramienta interactiva', chatbot: 'Interfaz de chatbot' },
    de: { ecommerce: 'Online-Shop', landing: 'Landingpage', dashboard: 'Dashboard', portfolio: 'Portfolio', restaurant: 'Restaurant / Café', school: 'Akademie', invoice: 'Rechnung', tool: 'Interaktives Tool', chatbot: 'Chatbot-Oberfläche' },
    tr: { ecommerce: 'E-ticaret Mağazası', landing: 'Açılış Sayfası', dashboard: 'Panel', portfolio: 'Portföy', restaurant: 'Restoran / Kafe', school: 'Akademi', invoice: 'Fatura', tool: 'Etkileşimli Araç', chatbot: 'Chatbot Arayüzü' },
    ja: { ecommerce: 'ECストア', landing: 'ランディングページ', dashboard: 'ダッシュボード', portfolio: 'ポートフォリオ', restaurant: 'レストラン / カフェ', school: 'アカデミー', invoice: '請求書', tool: 'インタラクティブツール', chatbot: 'チャットボットUI' }
  };
  return names[outputLang]?.[template] || meta.en;
}


type TemplateId = string;


type TemplateMeta = {
  id: TemplateId;
  ar: string;
  en: string;
  patterns: RegExp[];
  sections: string[];
  tools: string[];
};

const templateCatalog: TemplateMeta[] = [
  { id: 'ecommerce', ar: 'متجر إلكتروني', en: 'E-commerce Store', patterns: [/متجر|بيع|منتجات|سلة|شراء|checkout|cart|products|shop|store|e-?commerce/i], sections: ['hero', 'product grid', 'filters', 'cart summary', 'features', 'FAQ'], tools: ['Product cards', 'Mock cart', 'LocalStorage cart', 'Exportable Vite app'] },
  { id: 'marketplace', ar: 'سوق متعدد البائعين', en: 'Marketplace', patterns: [/marketplace|multi vendor|vendor|سوق|بائعين|مزاد|auction/i], sections: ['hero search', 'vendor cards', 'listing grid', 'trust badges', 'checkout mock'], tools: ['Vendor cards', 'Listings', 'Local filters', 'Saved items'] },
  { id: 'landing', ar: 'صفحة هبوط', en: 'Landing Page', patterns: [/landing|صفحة هبوط|startup|saas|hero|pricing|اشتراك/i], sections: ['hero', 'trust badges', 'features', 'pricing', 'testimonials', 'CTA'], tools: ['Pricing blocks', 'Conversion copy', 'Responsive sections'] },
  { id: 'saas', ar: 'منصة SaaS', en: 'SaaS Product', patterns: [/saas|subscription app|منصة اشتراك|نظام اشتراك|startup product/i], sections: ['hero', 'features', 'use cases', 'pricing', 'FAQ', 'account CTA'], tools: ['Pricing UI', 'Feature matrix', 'Plan comparison'] },
  { id: 'dashboard', ar: 'لوحة تحكم', en: 'Dashboard', patterns: [/dashboard|لوحة|admin|analytics|chart|stats|احصائيات|تحكم/i], sections: ['sidebar', 'KPI cards', 'charts', 'table', 'activity feed'], tools: ['Mock analytics', 'Tables', 'Filters', 'Local state'] },
  { id: 'analytics', ar: 'تحليلات وتقارير', en: 'Analytics', patterns: [/analytics|reports|reporting|metrics|تحليلات|تقارير|مؤشرات/i], sections: ['KPI cards', 'trend chart mock', 'segments', 'export actions'], tools: ['Mock metrics', 'Date filters', 'CSV export text'] },
  { id: 'portfolio', ar: 'بورتفوليو', en: 'Portfolio', patterns: [/portfolio|بورتفوليو|cv|resume|personal site|سيرة|اعمالي|أعمالي/i], sections: ['hero', 'skills', 'projects', 'timeline', 'contact'], tools: ['Project cards', 'Skill tags', 'Contact CTA'] },
  { id: 'resume', ar: 'سيرة ذاتية', en: 'Resume Builder', patterns: [/resume builder|cv builder|سيرة ذاتية|سي في|cv/i], sections: ['profile', 'experience', 'skills', 'projects', 'print section'], tools: ['Print CSS', 'Editable sections', 'PDF-ready layout'] },
  { id: 'blog', ar: 'مدونة/أخبار', en: 'Blog / News', patterns: [/blog|news|magazine|مقالات|اخبار|أخبار|مدونة/i], sections: ['featured article', 'categories', 'article cards', 'newsletter'], tools: ['Article list', 'Search UI', 'Newsletter mock'] },
  { id: 'newsletter', ar: 'نشرة بريدية', en: 'Newsletter', patterns: [/newsletter|mailing list|نشرة|قائمة بريدية|ايميلات/i], sections: ['hero', 'signup card', 'issue list', 'audience benefits'], tools: ['Email capture mock', 'Issue cards', 'Copy sections'] },
  { id: 'auth', ar: 'نظام حسابات', en: 'Auth UI', patterns: [/login|signup|auth|تسجيل|دخول|حساب|register/i], sections: ['login card', 'signup card', 'profile preview', 'mock protected area'], tools: ['LocalStorage auth mock', 'Validation states'] },
  { id: 'document', ar: 'مستند/PDF', en: 'Document / PDF', patterns: [/pdf|invoice|report|document|تقرير|فاتورة|ملف|مستند|proposal/i], sections: ['cover', 'summary', 'sections', 'table', 'signature', 'print styles'], tools: ['Print CSS', 'PDF-ready layout', 'Export HTML'] },
  { id: 'office', ar: 'حزمة Office كاملة', en: 'Office Suite Pack', patterns: [/office suite|microsoft office|word excel powerpoint|اوفيس|أوفيس|مكتبة اوفيس|وورد.*اكسل|وورد.*بوربوينت|word.*excel|word.*powerpoint/i], sections: ['Word document', 'Excel workbook', 'PowerPoint deck', 'PDF/print layout', 'README'], tools: ['DOCX-ready outline', 'XLSX-style tables', 'PPTX slide plan', 'CSV exports', 'Print CSS'] },
  { id: 'word', ar: 'مستند Word', en: 'Word Document', patterns: [/word|docx|doc|وورد|ملف وورد|مستند وورد/i], sections: ['cover', 'headings', 'body sections', 'tables', 'references'], tools: ['DOCX export', 'RTF/HTML fallback', 'Print styles'] },
  { id: 'spreadsheet', ar: 'جدول Excel', en: 'Excel Spreadsheet', patterns: [/excel|xlsx|xls|spreadsheet|sheet|اكسل|إكسل|جدول بيانات|شيت/i], sections: ['sheets', 'tables', 'formulas', 'charts mock', 'CSV export'], tools: ['XLSX export', 'CSV export', 'Formula notes', 'Data validation plan'] },
  { id: 'presentation', ar: 'عرض PowerPoint', en: 'PowerPoint Presentation', patterns: [/powerpoint|pptx|ppt|presentation|slides|بوربوينت|باوربوينت|عرض تقديمي|سلايدات/i], sections: ['cover slide', 'problem', 'solution', 'features', 'roadmap', 'closing'], tools: ['PPTX export', 'Slide outline', 'Speaker notes', 'Print/PDF layout'] },
  { id: 'mailmerge', ar: 'دمج مراسلات', en: 'Mail Merge', patterns: [/mail merge|merge fields|مراسلات|دمج مراسلات|خطابات متعددة/i], sections: ['data fields', 'letter template', 'preview records', 'export notes'], tools: ['CSV fields', 'Template variables', 'Batch document plan'] },
  { id: 'invoice', ar: 'فاتورة', en: 'Invoice', patterns: [/invoice|receipt|فاتورة|ايصال|إيصال|billing/i], sections: ['seller info', 'client info', 'items table', 'totals', 'print actions'], tools: ['Invoice table', 'Tax mock', 'Print styles'] },
  { id: 'tool', ar: 'أداة تفاعلية', en: 'Interactive Tool', patterns: [/tool|calculator|converter|مولد|اداة|أداة|حاسبة|محول|generator/i], sections: ['inputs', 'output panel', 'history', 'export actions'], tools: ['Validation', 'LocalStorage history', 'Copy/export buttons'] },
  { id: 'mcp', ar: 'تكامل MCP', en: 'MCP Integration', patterns: [/\bmcp\b|model context protocol|mcp server|mcp client|tools\/list|tools\/call|موصلات mcp|بروتوكول mcp|سيرفر mcp|عميل mcp/i], sections: ['MCP overview', 'tool registry', 'resources', 'prompts', 'secure bridge', 'testing panel'], tools: ['JSON-RPC endpoint', 'tools/list', 'tools/call', 'resources/read', 'prompts/get', 'allowlisted remote bridge', 'secret-safe config'] },
  { id: 'fileconverter', ar: 'محول ملفات', en: 'File Converter', patterns: [/file converter|convert files|محول ملفات|تحويل ملفات|csv to json|json to csv/i], sections: ['upload area', 'conversion options', 'output preview', 'download'], tools: ['File input', 'Text conversion', 'Download result'] },
  { id: 'todo', ar: 'مهام وإنتاجية', en: 'Todo / Productivity', patterns: [/todo|tasks|pomodoro|مهام|تاسكات|انتاجية|إنتاجية|خطة يوم/i], sections: ['task input', 'task list', 'focus timer', 'daily progress'], tools: ['LocalStorage tasks', 'Filters', 'Progress mock'] },
  { id: 'notes', ar: 'ملاحظات', en: 'Notes App', patterns: [/notes|notebook|ملاحظات|نوتس|دفتر/i], sections: ['note editor', 'note cards', 'search', 'tags'], tools: ['LocalStorage notes', 'Search/filter', 'Export text'] },
  { id: 'chatbot', ar: 'واجهة شات بوت', en: 'Chatbot UI', patterns: [/chatbot|chat bot|ai chat|شات بوت|بوت|محادثة ai/i], sections: ['chat shell', 'message bubbles', 'tools panel', 'empty state'], tools: ['Mock messages', 'Composer', 'Copy buttons'] },
  { id: 'restaurant', ar: 'مطعم/كافيه', en: 'Restaurant / Cafe', patterns: [/restaurant|cafe|مطعم|كافيه|منيو|menu|food|قهوة/i], sections: ['hero', 'menu', 'offers', 'booking CTA', 'location'], tools: ['Menu cards', 'Reservation mock', 'Gallery'] },
  { id: 'delivery', ar: 'توصيل طلبات', en: 'Delivery App', patterns: [/delivery|orders|توصيل|طلبات|دليفري/i], sections: ['order cards', 'tracking timeline', 'driver mock', 'status filters'], tools: ['Order tracker', 'Status badges', 'Local mock data'] },
  { id: 'school', ar: 'مدرسة/أكاديمية', en: 'School / Academy', patterns: [/school|academy|مدرسة|اكاديمية|أكاديمية|تعليم|students|courses/i], sections: ['hero', 'programs', 'teachers', 'schedule', 'enroll CTA'], tools: ['Course cards', 'Schedule table', 'FAQ'] },
  { id: 'clinic', ar: 'عيادة/طبي', en: 'Clinic / Medical', patterns: [/clinic|medical|doctor|عيادة|طبيب|دكتور|صحة|health/i], sections: ['hero', 'services', 'doctors', 'appointments', 'trust'], tools: ['Booking mock', 'Service cards', 'Safety copy'] },
  { id: 'booking', ar: 'حجز مواعيد', en: 'Booking System', patterns: [/booking|appointment|reservation|حجز|مواعيد|موعد|جدولة/i], sections: ['calendar mock', 'service selector', 'time slots', 'confirmation card'], tools: ['Slot picker', 'Local booking state', 'Confirmation UI'] },
  { id: 'realestate', ar: 'عقارات', en: 'Real Estate', patterns: [/real estate|property|عقار|عقارات|شقة|فيلا|rent|sale|إيجار|بيع عقار/i], sections: ['hero search', 'listing cards', 'filters', 'neighborhoods', 'contact'], tools: ['Listing cards', 'Filter UI', 'Map placeholder'] },
  { id: 'travel', ar: 'سفر/رحلات', en: 'Travel', patterns: [/travel|trip|tour|رحلة|سفر|سياحة|hotel|booking/i], sections: ['hero', 'packages', 'itinerary', 'reviews', 'booking CTA'], tools: ['Trip cards', 'Itinerary timeline', 'Budget table'] },
  { id: 'gym', ar: 'جيم/رياضة', en: 'Gym / Fitness', patterns: [/gym|fitness|workout|جيم|رياضة|تمرين|مدرب/i], sections: ['hero', 'programs', 'trainers', 'plans', 'schedule'], tools: ['Program cards', 'Schedule', 'Progress mock'] },
  { id: 'agency', ar: 'شركة خدمات', en: 'Agency / Services', patterns: [/agency|company|services|شركة|خدمات|تسويق|تصميم|برمجة/i], sections: ['hero', 'services', 'process', 'case studies', 'contact'], tools: ['Service cards', 'Process steps', 'Case studies'] },
  { id: 'course', ar: 'كورس/تعليم', en: 'Course / Learning', patterns: [/course|learn|lesson|كورس|دورة|درس|تعلم|تعليم/i], sections: ['hero', 'curriculum', 'progress', 'quiz', 'enroll'], tools: ['Curriculum list', 'Quiz mock', 'Progress bar'] },
  { id: 'video', ar: 'فيديو/منصة مشاهدة', en: 'Video Platform', patterns: [/video|stream|watch|فيديو|مشاهدة|افلام|أفلام|مسلسلات/i], sections: ['hero player', 'video grid', 'categories', 'watchlist'], tools: ['Video cards', 'Watchlist mock', 'Player shell'] },
  { id: 'music', ar: 'موسيقى/مشغل', en: 'Music Player', patterns: [/music|audio|song|موسيقى|اغاني|أغاني|مشغل/i], sections: ['player', 'playlist', 'album cards', 'queue'], tools: ['Player mock', 'Playlist', 'Queue UI'] },
  { id: 'gallery', ar: 'معرض صور', en: 'Image Gallery', patterns: [/gallery|images|photos|معرض صور|صور|البوم/i], sections: ['hero', 'gallery grid', 'filters', 'lightbox mock'], tools: ['Image cards', 'Filter chips', 'Lightbox state'] },
  { id: 'crm', ar: 'CRM/إدارة عملاء', en: 'CRM', patterns: [/crm|customers|clients|leads|عملاء|زبائن|مبيعات|sales/i], sections: ['pipeline', 'contacts', 'tasks', 'notes'], tools: ['Kanban mock', 'Contacts table', 'Task list'] }
  ,{ id: 'inventory', ar: 'إدارة مخزون', en: 'Inventory', patterns: [/inventory|stock|warehouse|مخزون|مستودع|منتجات/i], sections: ['stock table', 'alerts', 'categories', 'movement log'], tools: ['Inventory table', 'Low stock badges', 'CSV-ready data'] }
  ,{ id: 'social', ar: 'تطبيق اجتماعي', en: 'Social App', patterns: [/social app|community|feed|تواصل|اجتماعي|منشورات|بوستات/i], sections: ['feed', 'composer', 'profiles', 'trending topics'], tools: ['Mock feed', 'Like/save state', 'Profile cards'] }
  ,{ id: 'forum', ar: 'منتدى/مجتمع', en: 'Forum / Community', patterns: [/forum|community|discussion|منتدى|مجتمع|نقاشات/i], sections: ['topic list', 'categories', 'post view', 'reply composer'], tools: ['Mock threads', 'Search UI', 'Tag filters'] }
  ,{ id: 'game', ar: 'لعبة/صفحة لعبة', en: 'Game UI', patterns: [/game|gaming|لعبة|العاب|ألعاب|score|leaderboard/i], sections: ['game shell', 'scoreboard', 'controls', 'leaderboard'], tools: ['Interactive state', 'Keyboard hints', 'Score mock'] }
  ,{ id: 'helpdesk', ar: 'مركز دعم', en: 'Helpdesk', patterns: [/helpdesk|support center|tickets|دعم|تذاكر|مساعدة|faq/i], sections: ['ticket cards', 'FAQ', 'status filters', 'contact form'], tools: ['Ticket mock', 'FAQ accordion', 'Status badges'] }
  ,{ id: 'codeassistant', ar: 'مساعد كود متقدم', en: 'Code Workspace Assistant', patterns: [/claude code|code assistant|agentic coding|codebase|repo|repository|refactor|terminal|diff|patch|مساعد كود|تعديل مشروع|ريبو|مستودع|ريفكتور|باتش|ترمينال/i], sections: ['repo analysis', 'edit plan', 'patch summary', 'commands', 'tests', 'rollback notes'], tools: ['Codebase map', 'Diff plan', 'Safe terminal commands', 'Test plan', 'README updates'] }
  ,{ id: 'desktopapp', ar: 'تطبيق سطح مكتب', en: 'Desktop App', patterns: [/desktop app|windows app|linux app|mac app|tauri|electron|سطح المكتب|ويندوز|لينكس|ماك|برنامج كمبيوتر/i], sections: ['app shell', 'local storage', 'file access plan', 'desktop packaging', 'installer notes'], tools: ['Tauri/Electron notes', 'Offline state', 'Cross-platform checklist'] }
  ,{ id: 'mobileapp', ar: 'تطبيق موبايل/PWA', en: 'Mobile / PWA App', patterns: [/mobile app|pwa|ios app|تطبيق موبايل|ايفون|تطبيق يتحمل|installable app/i], sections: ['mobile shell', 'install prompt', 'offline cache', 'touch UI', 'packaging notes'], tools: ['PWA manifest', 'Capacitor-ready config', 'Responsive mobile UI'] }
  ,{ id: 'apkapp', ar: 'تطبيق Android APK', en: 'Android APK Project', patterns: [/apk|android app|android sdk|jdk|gradle|capacitor android|تصدير apk|ملف apk|اندرويد|أندرويد|جافا sdk|java sdk|android studio/i], sections: ['mobile app shell', 'Capacitor config', 'Android build scripts', 'JDK/SDK guide', 'GitHub Actions APK workflow'], tools: ['Capacitor Android', 'JDK 17 notes', 'Android SDK guide', 'Gradle build commands', 'APK CI workflow'] }
  ,{ id: 'nativeandroid', ar: 'مشروع Android Native', en: 'Native Android Starter', patterns: [/kotlin android|java android|native android|android native|kotlin app|java app|تطبيق كوتلن|تطبيق جافا|مشروع اندرويد native/i], sections: ['native app structure', 'MainActivity', 'Gradle config', 'manifest notes', 'build guide'], tools: ['Kotlin/Java structure notes', 'Gradle commands', 'Android Studio guide', 'APK output path'] }
  ,{ id: 'weatherapp', ar: 'تطبيق طقس', en: 'Weather App', patterns: [/weather app|forecast|طقس|الجو|درجة الحرارة|توقعات/i], sections: ['search city', 'current card', 'daily forecast', 'weather alerts'], tools: ['Mock weather data', 'Responsive cards', 'Unit toggle', 'Offline fallback'] }
  ,{ id: 'budget', ar: 'ميزانية شخصية', en: 'Budget Planner', patterns: [/budget|personal finance|ميزانية|مصروف|دخل|ادخار/i], sections: ['income card', 'expense categories', 'monthly summary', 'saving goal'], tools: ['Local calculator', 'Category chart mock', 'CSV export'] }
  ,{ id: 'expense', ar: 'تتبع المصاريف', en: 'Expense Tracker', patterns: [/expense tracker|expenses|spending|مصاريف|مصروفات|تتبع المصاريف/i], sections: ['add expense', 'category list', 'monthly total', 'export'], tools: ['LocalStorage expenses', 'Filters', 'CSV export'] }
  ,{ id: 'calendar', ar: 'تقويم وجدولة', en: 'Calendar / Scheduler', patterns: [/calendar|scheduler|agenda|تقويم|جدول|جدولة|مواعيد يومية/i], sections: ['month view', 'event cards', 'quick add', 'reminders'], tools: ['Local events', 'Date grouping', 'ICS notes'] }
  ,{ id: 'ecommerceadmin', ar: 'لوحة إدارة متجر', en: 'E-commerce Admin', patterns: [/store admin|ecommerce admin|ادارة متجر|إدارة متجر|منتجات ومبيعات/i], sections: ['orders', 'products', 'customers', 'revenue'], tools: ['Mock orders', 'Inventory badges', 'CSV-ready tables'] }
  ,{ id: 'restaurantpos', ar: 'نظام كاشير مطعم', en: 'Restaurant POS', patterns: [/pos|cashier|point of sale|كاشير|نقطة بيع|طلبات مطعم/i], sections: ['menu grid', 'order cart', 'table status', 'receipt'], tools: ['Local order cart', 'Receipt print', 'Table mock'] }
  ,{ id: 'lms', ar: 'منصة تعليم LMS', en: 'Learning Management System', patterns: [/lms|learning management|منصة تعليم|منصة كورسات|تعلم اونلاين/i], sections: ['courses', 'lessons', 'student progress', 'assignments'], tools: ['Progress mock', 'Course cards', 'Quiz section'] }
  ,{ id: 'quiz', ar: 'اختبار تفاعلي', en: 'Quiz App', patterns: [/quiz app|quiz|test app|اختبار تفاعلي|امتحان|أسئلة اختيار/i], sections: ['question card', 'answers', 'score', 'review'], tools: ['Local quiz state', 'Score calculation', 'Result screen'] }
  ,{ id: 'flashcards', ar: 'بطاقات مذاكرة', en: 'Flashcards', patterns: [/flashcards|study cards|بطاقات|كروت مذاكرة|حفظ كلمات/i], sections: ['card deck', 'flip state', 'progress', 'review list'], tools: ['LocalStorage deck', 'Flip animation', 'Study progress'] }
  ,{ id: 'dictionary', ar: 'قاموس مصغر', en: 'Dictionary', patterns: [/dictionary|glossary|قاموس|معجم|مصطلحات/i], sections: ['search input', 'term cards', 'examples', 'favorites'], tools: ['Local glossary', 'Search/filter', 'Favorite terms'] }
  ,{ id: 'translator', ar: 'مترجم واجهة', en: 'Translator UI', patterns: [/translator|translate app|مترجم|ترجمة|ترجمة واجهة/i], sections: ['input text', 'language selector', 'output panel', 'history'], tools: ['Mock translate flow', 'Copy button', 'History list'] }
  ,{ id: 'promptlibrary', ar: 'مكتبة برومبتات', en: 'Prompt Library', patterns: [/prompt library|prompts|برومبت|برومبتات|مكتبة أوامر/i], sections: ['prompt cards', 'categories', 'copy action', 'favorites'], tools: ['Copy prompts', 'Category filters', 'Local favorites'] }
  ,{ id: 'linktree', ar: 'صفحة روابط شخصية', en: 'Link-in-bio Page', patterns: [/linktree|link in bio|bio links|روابط شخصية|صفحة روابط/i], sections: ['profile card', 'social links', 'featured link', 'contact'], tools: ['Link cards', 'Theme variants', 'Mobile-first layout'] }
  ,{ id: 'jobboard', ar: 'لوحة وظائف', en: 'Job Board', patterns: [/job board|jobs|careers|وظائف|فرص عمل|توظيف/i], sections: ['job filters', 'job cards', 'company badges', 'apply CTA'], tools: ['Mock jobs', 'Filters', 'Saved jobs'] }
  ,{ id: 'eventsite', ar: 'موقع فعالية', en: 'Event Website', patterns: [/event website|conference|webinar|فعالية|مؤتمر|ندوة/i], sections: ['event hero', 'schedule', 'speakers', 'tickets'], tools: ['Schedule table', 'Speaker cards', 'Ticket CTA'] }
  ,{ id: 'donation', ar: 'صفحة تبرعات', en: 'Donation Page', patterns: [/donation|fundraising|تبرع|تبرعات|حملة خيرية/i], sections: ['cause hero', 'progress bar', 'donation tiers', 'impact cards'], tools: ['Progress mock', 'Tier cards', 'Receipt notes'] }
  ,{ id: 'mapdirectory', ar: 'دليل أماكن', en: 'Map Directory', patterns: [/map directory|places directory|locations|دليل أماكن|خريطة|أماكن/i], sections: ['search places', 'location cards', 'map placeholder', 'filters'], tools: ['Local listings', 'Map placeholder', 'Distance chips'] }
  ,{ id: 'fleet', ar: 'إدارة أسطول', en: 'Fleet Dashboard', patterns: [/fleet|vehicles|drivers|اسطول|أسطول|سائقين|مركبات/i], sections: ['vehicle cards', 'driver status', 'route log', 'maintenance alerts'], tools: ['Mock fleet data', 'Status badges', 'Alert list'] }
  ,{ id: 'hr', ar: 'موارد بشرية HR', en: 'HR Portal', patterns: [/hr portal|human resources|employees|موارد بشرية|موظفين|إجازات/i], sections: ['employee table', 'leave requests', 'announcements', 'documents'], tools: ['Employee table', 'Request cards', 'Search filters'] }
  ,{ id: 'payroll', ar: 'رواتب', en: 'Payroll Sheet', patterns: [/payroll|salary sheet|رواتب|مرتب|أجور/i], sections: ['employee rows', 'salary columns', 'deductions', 'summary'], tools: ['Spreadsheet-style layout', 'CSV export', 'Print view'] }
  ,{ id: 'accounting', ar: 'محاسبة مبسطة', en: 'Accounting Dashboard', patterns: [/accounting|ledger|invoices dashboard|محاسبة|دفتر حسابات|إيرادات ومصروفات/i], sections: ['income', 'expenses', 'ledger table', 'monthly summary'], tools: ['Local ledger', 'Totals', 'CSV-ready table'] }
  ,{ id: 'projectmanagement', ar: 'إدارة مشاريع', en: 'Project Management', patterns: [/project management|project tracker|ادارة مشاريع|إدارة مشاريع|مشروع وفريق/i], sections: ['project overview', 'milestones', 'team tasks', 'status board'], tools: ['Milestone cards', 'Task table', 'Status filters'] }
  ,{ id: 'kanban', ar: 'لوحة Kanban', en: 'Kanban Board', patterns: [/kanban|trello|scrum board|كانبان|لوحة مهام/i], sections: ['todo column', 'doing column', 'done column', 'task cards'], tools: ['Local task cards', 'Drag-ready structure', 'Status columns'] }
  ,{ id: 'habit', ar: 'تتبع عادات', en: 'Habit Tracker', patterns: [/habit tracker|habits|عادات|تتبع عادة|روتين/i], sections: ['habit list', 'weekly grid', 'streaks', 'progress'], tools: ['Local habit state', 'Streak mock', 'Progress UI'] }
  ,{ id: 'fitness', ar: 'تطبيق لياقة', en: 'Fitness App', patterns: [/fitness app|workout app|gym tracker|لياقة|تمارين|رياضة/i], sections: ['workout cards', 'weekly plan', 'progress stats', 'coach notes'], tools: ['Workout planner', 'Progress mock', 'Timer UI'] }
  ,{ id: 'mealplanner', ar: 'مخطط وجبات', en: 'Meal Planner', patterns: [/meal planner|nutrition planner|وجبات|خطة أكل|مخطط وجبات/i], sections: ['week meals', 'shopping list', 'nutrition notes', 'favorites'], tools: ['Meal cards', 'Shopping list', 'Print view'] }
  ,{ id: 'recipe', ar: 'موقع وصفات', en: 'Recipe Website', patterns: [/recipe|recipes|cooking|وصفات|طبخ|مطبخ/i], sections: ['recipe hero', 'ingredients', 'steps', 'related recipes'], tools: ['Ingredient list', 'Step cards', 'Print recipe'] }
  ,{ id: 'library', ar: 'مكتبة رقمية', en: 'Digital Library', patterns: [/digital library|library app|مكتبة|كتب|مكتبة رقمية/i], sections: ['book grid', 'categories', 'reading list', 'search'], tools: ['Book cards', 'Search/filter', 'Saved list'] }
  ,{ id: 'booktracker', ar: 'تتبع قراءة', en: 'Book Tracker', patterns: [/book tracker|reading tracker|تتبع قراءة|قراءة كتب|قائمة كتب/i], sections: ['currently reading', 'book list', 'progress', 'notes'], tools: ['Local book state', 'Progress bars', 'Notes'] }
  ,{ id: 'schoolportal', ar: 'بوابة مدرسة', en: 'School Portal', patterns: [/school portal|student portal|بوابة مدرسة|بوابة طالب|درجات/i], sections: ['student dashboard', 'grades', 'attendance', 'announcements'], tools: ['Grade table', 'Attendance cards', 'Announcements'] }
  ,{ id: 'hospitaldashboard', ar: 'لوحة مستشفى', en: 'Hospital Dashboard', patterns: [/hospital dashboard|hospital admin|لوحة مستشفى|مرضى|أقسام/i], sections: ['patient queue', 'departments', 'appointments', 'status cards'], tools: ['Queue mock', 'Department cards', 'Schedule table'] }
  ,{ id: 'pharmacy', ar: 'صيدلية', en: 'Pharmacy System', patterns: [/pharmacy|pharmacy system|صيدلية|أدوية|دواء/i], sections: ['product table', 'stock alerts', 'orders', 'receipt'], tools: ['Inventory table', 'Low stock', 'Print receipt'] }
  ,{ id: 'labreport', ar: 'تقرير معمل', en: 'Lab Report', patterns: [/lab report|lab results|تقرير معمل|تحاليل|نتائج تحليل/i], sections: ['patient info', 'results table', 'reference ranges', 'notes'], tools: ['PDF print', 'Result table', 'Signature area'] }
  ,{ id: 'legalpage', ar: 'صفحات قانونية', en: 'Legal Pages', patterns: [/terms page|legal pages|صفحات قانونية|شروط الاستخدام|سياسة/i], sections: ['terms', 'privacy', 'refund', 'contact'], tools: ['Policy layout', 'Print view', 'Section anchors'] }
  ,{ id: 'privacycenter', ar: 'مركز الخصوصية', en: 'Privacy Center', patterns: [/privacy center|data settings|مركز الخصوصية|إعدادات البيانات|حذف بياناتي/i], sections: ['data controls', 'consent cards', 'export data', 'delete request'], tools: ['Consent UI', 'Data export notes', 'Request cards'] }
  ,{ id: 'statuspage', ar: 'صفحة حالة الخدمة', en: 'Status Page', patterns: [/status page|uptime|incident|حالة الخدمة|الأعطال|تشغيل الخدمة/i], sections: ['overall status', 'service list', 'incident timeline', 'subscribe'], tools: ['Status badges', 'Timeline', 'Uptime mock'] }
  ,{ id: 'changelog', ar: 'سجل التحديثات', en: 'Changelog', patterns: [/changelog|release notes|سجل التحديثات|تحديثات|إصدارات/i], sections: ['latest release', 'version cards', 'filters', 'subscribe'], tools: ['Version timeline', 'Tags', 'Search'] }
  ,{ id: 'roadmap', ar: 'خارطة طريق', en: 'Roadmap', patterns: [/roadmap|product roadmap|خارطة طريق|خطة تطوير|مراحل قادمة/i], sections: ['now', 'next', 'later', 'feedback CTA'], tools: ['Roadmap columns', 'Priority tags', 'Voting mock'] }
  ,{ id: 'apidocs', ar: 'توثيق API', en: 'API Docs', patterns: [/api docs|api documentation|توثيق api|واجهة برمجية|endpoints/i], sections: ['overview', 'authentication', 'endpoints', 'examples'], tools: ['Endpoint cards', 'Code blocks', 'Copy buttons'] }
  ,{ id: 'documentation', ar: 'مركز توثيق', en: 'Documentation Hub', patterns: [/docs hub|documentation site|توثيق|مستندات المشروع|docs/i], sections: ['sidebar', 'articles', 'search', 'quick start'], tools: ['Docs layout', 'Search UI', 'Copy blocks'] }
  ,{ id: 'devportal', ar: 'بوابة مطورين', en: 'Developer Portal', patterns: [/developer portal|dev portal|بوابة مطورين|مطورين|sdk/i], sections: ['SDK cards', 'API keys', 'examples', 'support'], tools: ['SDK cards', 'API key UI mock', 'Docs links'] }
  ,{ id: 'componentlibrary', ar: 'مكتبة مكونات', en: 'Component Library', patterns: [/component library|ui kit|مكتبة مكونات|مكونات واجهة|ui components/i], sections: ['buttons', 'cards', 'forms', 'navigation'], tools: ['Component previews', 'Props notes', 'Copy snippets'] }
  ,{ id: 'designsystem', ar: 'نظام تصميم', en: 'Design System', patterns: [/design system|brand system|نظام تصميم|هوية واجهة|design tokens/i], sections: ['colors', 'typography', 'spacing', 'components'], tools: ['Token cards', 'Style guide', 'Usage notes'] }
  ,{ id: 'colorpalette', ar: 'مولد ألوان', en: 'Color Palette Generator', patterns: [/color palette|palette generator|ألوان|مولد ألوان|لوحة ألوان/i], sections: ['palette preview', 'color cards', 'copy hex', 'theme examples'], tools: ['Copy hex', 'Theme preview', 'Local palettes'] }
  ,{ id: 'formbuilder', ar: 'منشئ نماذج', en: 'Form Builder', patterns: [/form builder|survey builder|منشئ نماذج|فورم|نماذج/i], sections: ['field list', 'form preview', 'settings', 'submissions'], tools: ['Field cards', 'Validation notes', 'Submission table'] }
  ,{ id: 'survey', ar: 'استبيان', en: 'Survey App', patterns: [/survey|poll|استبيان|تصويت|استطلاع/i], sections: ['question list', 'answer choices', 'results', 'export'], tools: ['Result bars', 'Local votes', 'CSV export'] }
  ,{ id: 'fashionstore', ar: 'متجر ملابس', en: 'Fashion Store', patterns: [/fashion store|clothing store|apparel|متجر ملابس|هدوم|أزياء|تيشيرتات|ملابس/i], sections: ['lookbook hero', 'category grid', 'product cards', 'size guide', 'cart drawer'], tools: ['Size chips', 'Color variants', 'Mock cart', 'Collection filters'] }
  ,{ id: 'animestore', ar: 'متجر أنمي', en: 'Anime Merch Store', patterns: [/anime store|anime merch|manga shop|متجر انمي|متجر أنمي|ملابس انمي|أنمي/i], sections: ['anime hero', 'drop collection', 'character-inspired cards', 'size chart', 'cart'], tools: ['Collection badges', 'Variant cards', 'Cart state', 'Mobile-first layout'] }
  ,{ id: 'electronicsstore', ar: 'متجر إلكترونيات', en: 'Electronics Store', patterns: [/electronics store|gadgets|phones store|متجر إلكترونيات|موبايلات|لابتوبات|أجهزة/i], sections: ['deal hero', 'spec filters', 'product comparison', 'warranty badges'], tools: ['Spec table', 'Compare cards', 'Filter chips', 'Cart mock'] }
  ,{ id: 'grocerystore', ar: 'سوبر ماركت', en: 'Grocery Store', patterns: [/grocery|supermarket|سوبر ماركت|بقالة|خضار|مواد غذائية/i], sections: ['fresh deals', 'aisles', 'basket', 'delivery slot'], tools: ['Basket state', 'Category aisles', 'Delivery slot mock', 'Receipt'] }
  ,{ id: 'digitalproducts', ar: 'متجر منتجات رقمية', en: 'Digital Products Store', patterns: [/digital products|templates store|assets store|منتجات رقمية|قوالب رقمية|ملفات رقمية/i], sections: ['product hero', 'license cards', 'download area', 'FAQ'], tools: ['License badges', 'Download mock', 'Pricing cards', 'Instant delivery UI'] }
  ,{ id: 'subscriptionbox', ar: 'اشتراكات شهرية', en: 'Subscription Box', patterns: [/subscription box|monthly box|اشتراك شهري|صندوق اشتراك|باقة شهرية/i], sections: ['box hero', 'plans', 'what is inside', 'reviews', 'delivery'], tools: ['Plan cards', 'Feature comparison', 'Delivery timeline'] }
  ,{ id: 'foodtruck', ar: 'عربة طعام', en: 'Food Truck Site', patterns: [/food truck|street food|عربة طعام|فود ترك|أكل شارع/i], sections: ['location hero', 'menu cards', 'weekly route', 'order CTA'], tools: ['Route cards', 'Menu grid', 'Location badges'] }
  ,{ id: 'beautysalon', ar: 'صالون تجميل', en: 'Beauty Salon', patterns: [/beauty salon|barber|spa|صالون|حلاق|تجميل|سبا/i], sections: ['services', 'stylists', 'booking slots', 'before after'], tools: ['Service menu', 'Booking mock', 'Gallery cards'] }
  ,{ id: 'barbershop', ar: 'محل حلاقة', en: 'Barbershop', patterns: [/barbershop|barber shop|حلاقة رجالي|محل حلاقة|باربر/i], sections: ['hero', 'services', 'barbers', 'booking', 'prices'], tools: ['Price cards', 'Appointment mock', 'Gallery'] }
  ,{ id: 'carwash', ar: 'مغسلة سيارات', en: 'Car Wash', patterns: [/car wash|detailing|مغسلة سيارات|غسيل سيارات|تلميع/i], sections: ['service packages', 'booking', 'before after', 'membership'], tools: ['Package cards', 'Booking slots', 'Membership badge'] }
  ,{ id: 'autorepair', ar: 'ورشة سيارات', en: 'Auto Repair', patterns: [/auto repair|garage|mechanic|ورشة سيارات|ميكانيكي|صيانة سيارات/i], sections: ['services', 'diagnostics', 'booking', 'parts table'], tools: ['Service cards', 'Job status mock', 'Invoice preview'] }
  ,{ id: 'logistics', ar: 'شركة شحن', en: 'Logistics Platform', patterns: [/logistics|shipping company|shipment|شركة شحن|شحن|تتبع شحنة/i], sections: ['tracking search', 'shipment cards', 'route timeline', 'pricing'], tools: ['Tracking mock', 'Route timeline', 'Status badges'] }
  ,{ id: 'warehouse', ar: 'مخزن ومستودع', en: 'Warehouse System', patterns: [/warehouse|stockroom|مستودع|مخزن|إدارة مخزن/i], sections: ['stock levels', 'zones', 'pick list', 'alerts'], tools: ['Inventory table', 'Zone cards', 'Low stock alerts'] }
  ,{ id: 'construction', ar: 'شركة مقاولات', en: 'Construction Company', patterns: [/construction|contractor|مقاولات|شركة مقاولات|تشطيبات|بناء/i], sections: ['project hero', 'services', 'project timeline', 'quote CTA'], tools: ['Project cards', 'Timeline', 'Quote form mock'] }
  ,{ id: 'architecture', ar: 'مكتب هندسي', en: 'Architecture Studio', patterns: [/architecture|architect|interior design|مكتب هندسي|معماري|تصميم داخلي/i], sections: ['portfolio hero', 'projects', 'process', 'consultation'], tools: ['Project gallery', 'Process steps', 'Consultation CTA'] }
  ,{ id: 'lawfirm', ar: 'مكتب محاماة', en: 'Law Firm', patterns: [/law firm|lawyer|attorney|مكتب محاماة|محامي|استشارة قانونية/i], sections: ['practice areas', 'lawyers', 'case process', 'consultation'], tools: ['Practice cards', 'Consultation form', 'Trust badges'] }
  ,{ id: 'consulting', ar: 'استشارات أعمال', en: 'Consulting Website', patterns: [/consulting|business consulting|استشارات|استشاري|استشارات أعمال/i], sections: ['hero', 'services', 'process', 'case studies', 'CTA'], tools: ['Service cards', 'Case study layout', 'Lead form'] }
  ,{ id: 'financialadvisor', ar: 'مستشار مالي', en: 'Financial Advisor', patterns: [/financial advisor|investment advisor|مستشار مالي|استثمار|تخطيط مالي/i], sections: ['services', 'risk profile', 'plans', 'calculator'], tools: ['Plan cards', 'Risk mock', 'Calculator block'] }
  ,{ id: 'bankingapp', ar: 'واجهة بنك رقمي', en: 'Digital Banking UI', patterns: [/banking app|digital bank|بنك رقمي|محفظة|حساب بنكي|bank dashboard/i], sections: ['balance card', 'transactions', 'cards', 'goals'], tools: ['Transaction table', 'Card mock', 'Security UI'] }
  ,{ id: 'walletapp', ar: 'محفظة إلكترونية', en: 'Wallet App', patterns: [/wallet app|e-wallet|محفظة إلكترونية|محفظة رقمية|مدفوعات/i], sections: ['wallet balance', 'quick actions', 'transactions', 'cards'], tools: ['Wallet cards', 'Transfer mock', 'Transaction list'] }
  ,{ id: 'cryptoportfolio', ar: 'محفظة كريبتو', en: 'Crypto Portfolio', patterns: [/crypto portfolio|crypto tracker|كريبتو|عملات رقمية|محفظة كريبتو/i], sections: ['asset cards', 'portfolio value', 'watchlist', 'risk notes'], tools: ['Mock prices', 'Watchlist', 'Portfolio cards'] }
  ,{ id: 'nftgallery', ar: 'معرض NFT', en: 'NFT Gallery', patterns: [/nft gallery|nft marketplace|معرض nft|ان اف تي|NFT/i], sections: ['collection hero', 'asset grid', 'traits', 'owner cards'], tools: ['Trait chips', 'Asset cards', 'Collection stats'] }
  ,{ id: 'aiimageapp', ar: 'تطبيق صور AI', en: 'AI Image App UI', patterns: [/ai image|image generator|مولد صور|صور ai|توليد صور/i], sections: ['prompt input', 'style presets', 'gallery', 'download actions'], tools: ['Prompt box', 'Style chips', 'Gallery mock'] }
  ,{ id: 'aitoolsdirectory', ar: 'دليل أدوات AI', en: 'AI Tools Directory', patterns: [/ai tools directory|tools directory|دليل أدوات ai|أدوات ذكاء|ai directory/i], sections: ['tool search', 'categories', 'tool cards', 'pricing filter'], tools: ['Tool cards', 'Filter chips', 'Saved tools'] }
  ,{ id: 'promptgenerator', ar: 'مولد برومبتات', en: 'Prompt Generator', patterns: [/prompt generator|generate prompts|مولد برومبت|مولد أوامر|برومبت جاهز/i], sections: ['goal input', 'style options', 'generated prompt', 'history'], tools: ['Prompt builder', 'Copy action', 'History state'] }
  ,{ id: 'resumeanalyzer', ar: 'محلل CV', en: 'Resume Analyzer UI', patterns: [/resume analyzer|cv analyzer|تحليل cv|تحليل سيرة|مراجعة cv/i], sections: ['upload card', 'score', 'improvements', 'keyword match'], tools: ['Score mock', 'Checklist', 'PDF-ready report'] }
  ,{ id: 'coverletter', ar: 'خطاب تقديم', en: 'Cover Letter Builder', patterns: [/cover letter|job letter|خطاب تقديم|رسالة توظيف|جواب وظيفة/i], sections: ['job details', 'letter preview', 'tone controls', 'export'], tools: ['Letter preview', 'Tone chips', 'Copy/print'] }
  ,{ id: 'emailcampaign', ar: 'حملة بريدية', en: 'Email Campaign', patterns: [/email campaign|cold email|حملة بريدية|إيميل تسويقي|رسائل بريد/i], sections: ['audience', 'sequence', 'email preview', 'metrics'], tools: ['Sequence cards', 'Preview panes', 'Metrics mock'] }
  ,{ id: 'crmmini', ar: 'CRM مصغر', en: 'Mini CRM', patterns: [/mini crm|simple crm|crm بسيط|إدارة زبائن بسيطة/i], sections: ['lead form', 'contact list', 'pipeline', 'notes'], tools: ['Local contacts', 'Pipeline badges', 'CSV export'] }
  ,{ id: 'saasinvoice', ar: 'فواتير SaaS', en: 'SaaS Billing UI', patterns: [/saas billing|subscription billing|فواتير اشتراك|دفع اشتراك|billing portal/i], sections: ['plans', 'invoices', 'payment status', 'usage'], tools: ['Billing table', 'Plan cards', 'Usage bars'] }
  ,{ id: 'pricingpage', ar: 'صفحة أسعار', en: 'Pricing Page', patterns: [/pricing page|plans page|صفحة أسعار|خطط اشتراك|أسعار/i], sections: ['plan cards', 'feature matrix', 'FAQ', 'CTA'], tools: ['Comparison table', 'Plan highlight', 'FAQ accordion'] }
  ,{ id: 'faqcenter', ar: 'مركز أسئلة', en: 'FAQ Center', patterns: [/faq center|help articles|مركز اسئلة|مركز أسئلة|أسئلة شائعة/i], sections: ['search', 'categories', 'accordion', 'contact CTA'], tools: ['Search UI', 'Accordion', 'Category cards'] }
  ,{ id: 'knowledgebase', ar: 'قاعدة معرفة', en: 'Knowledge Base', patterns: [/knowledge base|kb site|قاعدة معرفة|مركز معرفة|مقالات دعم/i], sections: ['sidebar', 'article list', 'search', 'popular articles'], tools: ['Article cards', 'Search mock', 'Breadcrumbs'] }
  ,{ id: 'ticketing', ar: 'نظام تذاكر', en: 'Ticketing System', patterns: [/ticketing system|support tickets|نظام تذاكر|تذاكر دعم|فتح تذكرة/i], sections: ['ticket form', 'ticket list', 'status columns', 'SLA cards'], tools: ['Ticket cards', 'Status filters', 'Priority badges'] }
  ,{ id: 'community', ar: 'مجتمع إلكتروني', en: 'Community Platform', patterns: [/community platform|online community|مجتمع إلكتروني|كوميونيتي|أعضاء/i], sections: ['feed', 'groups', 'members', 'events'], tools: ['Member cards', 'Post mock', 'Group filters'] }
  ,{ id: 'datingapp', ar: 'واجهة تعارف', en: 'Matching App UI', patterns: [/matching app|dating ui|تعارف|مطابقة|سوايب/i], sections: ['profile cards', 'match queue', 'interests', 'chat preview'], tools: ['Swipe-style cards', 'Match mock', 'Chat preview'] }
  ,{ id: 'messenger', ar: 'تطبيق رسائل', en: 'Messenger UI', patterns: [/messenger|messaging app|تطبيق رسائل|ماسنجر|محادثات/i], sections: ['conversation list', 'chat panel', 'contacts', 'composer'], tools: ['Message mock', 'Unread badges', 'Responsive shell'] }
  ,{ id: 'videocall', ar: 'واجهة مكالمات فيديو', en: 'Video Call UI', patterns: [/video call|meeting app|مكالمة فيديو|اجتماعات|meeting ui/i], sections: ['call stage', 'participants', 'controls', 'chat'], tools: ['Call controls', 'Participant tiles', 'Chat panel'] }
  ,{ id: 'podcastsite', ar: 'موقع بودكاست', en: 'Podcast Website', patterns: [/podcast site|podcast|بودكاست|حلقات صوتية/i], sections: ['show hero', 'episode list', 'host cards', 'subscribe'], tools: ['Episode cards', 'Audio mock', 'Subscribe badges'] }
  ,{ id: 'radioapp', ar: 'راديو أونلاين', en: 'Radio App', patterns: [/radio app|online radio|راديو|إذاعة|محطة صوت/i], sections: ['player', 'station list', 'schedule', 'favorites'], tools: ['Player mock', 'Station cards', 'Schedule table'] }
  ,{ id: 'streaminglanding', ar: 'منصة بث', en: 'Streaming Landing', patterns: [/streaming landing|ott platform|منصة بث|مشاهدة اونلاين|نتفلكس/i], sections: ['hero', 'content rows', 'plans', 'devices'], tools: ['Content rows', 'Plan cards', 'Device badges'] }
  ,{ id: 'newsportal', ar: 'بوابة أخبار', en: 'News Portal', patterns: [/news portal|newspaper|بوابة أخبار|جريدة|موقع أخبار/i], sections: ['top stories', 'categories', 'article grid', 'newsletter'], tools: ['Article cards', 'Category tabs', 'Breaking badge'] }
  ,{ id: 'sportsclub', ar: 'نادي رياضي', en: 'Sports Club Site', patterns: [/sports club|football club|نادي رياضي|نادي كورة|فريق كرة/i], sections: ['club hero', 'fixtures', 'players', 'news'], tools: ['Fixture cards', 'Player grid', 'Standings mock'] }
  ,{ id: 'tournament', ar: 'بطولة وجدول مباريات', en: 'Tournament Bracket', patterns: [/tournament|bracket|بطولة|جدول مباريات|تصفيات/i], sections: ['teams', 'bracket', 'fixtures', 'leaderboard'], tools: ['Bracket mock', 'Match cards', 'Leaderboard'] }
  ,{ id: 'restaurantmenuqr', ar: 'منيو QR', en: 'QR Menu', patterns: [/qr menu|digital menu|منيو qr|منيو ديجيتال|قائمة رقمية/i], sections: ['restaurant header', 'categories', 'menu items', 'QR section'], tools: ['Menu cards', 'QR placeholder', 'Print menu'] }
  ,{ id: 'qrgenerator', ar: 'مولد QR', en: 'QR Generator', patterns: [/qr generator|qr code|مولد qr|كيو ار|رمز qr/i], sections: ['input', 'QR preview', 'style options', 'download'], tools: ['QR placeholder', 'Copy text', 'Download notes'] }
  ,{ id: 'barcodeinventory', ar: 'باركود مخزون', en: 'Barcode Inventory', patterns: [/barcode inventory|barcode|باركود|مخزون باركود|ماسح/i], sections: ['scan input', 'item table', 'stock status', 'export'], tools: ['Barcode field', 'Inventory table', 'CSV export'] }
  ,{ id: 'passwordmanager', ar: 'مدير كلمات مرور', en: 'Password Manager UI', patterns: [/password manager|vault ui|مدير كلمات مرور|خزنة كلمات|باسورد/i], sections: ['vault list', 'generator', 'security score', 'categories'], tools: ['Password generator', 'Masked fields', 'Local-only warning'] }
  ,{ id: 'passwordgenerator', ar: 'مولد كلمات مرور', en: 'Password Generator', patterns: [/password generator|generate password|مولد كلمة مرور|توليد باسورد/i], sections: ['length options', 'rules', 'generated password', 'history'], tools: ['Random generator UI', 'Copy button', 'Strength meter'] }
  ,{ id: 'unitconverter', ar: 'محول وحدات', en: 'Unit Converter', patterns: [/unit converter|convert units|محول وحدات|تحويل وحدات|طول وزن/i], sections: ['unit type', 'from input', 'to output', 'history'], tools: ['Conversion table', 'Local history', 'Copy result'] }
  ,{ id: 'currencyconverter', ar: 'محول عملات', en: 'Currency Converter UI', patterns: [/currency converter|exchange rate|محول عملات|سعر صرف|تحويل عملة/i], sections: ['amount input', 'currency selector', 'result', 'rate notes'], tools: ['Mock rate UI', 'Swap button', 'History'] }
  ,{ id: 'imagecompressor', ar: 'ضغط صور', en: 'Image Compressor UI', patterns: [/image compressor|compress images|ضغط صور|تصغير صور|image optimizer/i], sections: ['upload', 'quality slider', 'preview', 'download'], tools: ['File input', 'Canvas-ready plan', 'Download button'] }
  ,{ id: 'markdowneditor', ar: 'محرر Markdown', en: 'Markdown Editor', patterns: [/markdown editor|md editor|محرر markdown|ماركداون|محرر نصوص/i], sections: ['editor', 'preview', 'toolbar', 'export'], tools: ['Live preview', 'Copy markdown', 'Local draft'] }
  ,{ id: 'richtexteditor', ar: 'محرر نصوص غني', en: 'Rich Text Editor', patterns: [/rich text editor|wysiwyg|محرر نصوص غني|محرر مقالات/i], sections: ['toolbar', 'editor canvas', 'format controls', 'export'], tools: ['Toolbar mock', 'Formatting states', 'HTML export'] }
  ,{ id: 'whiteboard', ar: 'سبورة رقمية', en: 'Whiteboard UI', patterns: [/whiteboard|drawing board|سبورة رقمية|لوحة رسم|رسم/i], sections: ['canvas area', 'tools', 'layers', 'export'], tools: ['Canvas shell', 'Tool buttons', 'Export notes'] }
  ,{ id: 'mindmap', ar: 'خريطة ذهنية', en: 'Mind Map', patterns: [/mind map|mindmap|خريطة ذهنية|مخطط أفكار/i], sections: ['center node', 'branches', 'notes', 'export'], tools: ['Node cards', 'Branch layout', 'Print view'] }
  ,{ id: 'flowchart', ar: 'مخطط تدفق', en: 'Flowchart Builder', patterns: [/flowchart|process map|مخطط تدفق|فلو تشارت|خريطة عملية/i], sections: ['nodes', 'connectors', 'steps', 'export'], tools: ['Node layout', 'Connector hints', 'Print diagram'] }
  ,{ id: 'databaseadmin', ar: 'لوحة قاعدة بيانات', en: 'Database Admin UI', patterns: [/database admin|db admin|لوحة قاعدة بيانات|إدارة قاعدة|جداول بيانات/i], sections: ['tables', 'rows', 'query box', 'activity'], tools: ['Table browser', 'Query mock', 'Row details'] }
  ,{ id: 'apiclient', ar: 'عميل API', en: 'API Client', patterns: [/api client|postman clone|عميل api|اختبار api|requests/i], sections: ['request builder', 'headers', 'response panel', 'history'], tools: ['Request UI', 'Response mock', 'History'] }
  ,{ id: 'webhooktester', ar: 'اختبار Webhook', en: 'Webhook Tester', patterns: [/webhook tester|webhook|اختبار webhook|ويب هوك|تلقي أحداث/i], sections: ['endpoint card', 'event list', 'payload viewer', 'logs'], tools: ['Payload viewer', 'Event cards', 'Copy endpoint'] }
  ,{ id: 'monitoring', ar: 'مراقبة خدمات', en: 'Monitoring Dashboard', patterns: [/monitoring dashboard|observability|مراقبة خدمات|لوجات|metrics dashboard/i], sections: ['health cards', 'logs', 'latency chart', 'alerts'], tools: ['Status cards', 'Logs mock', 'Alert list'] }
  ,{ id: 'securitydashboard', ar: 'لوحة أمنية', en: 'Security Dashboard', patterns: [/security dashboard|cyber dashboard|لوحة أمنية|أمن سيبراني|حماية/i], sections: ['risk score', 'alerts', 'devices', 'audit log'], tools: ['Risk cards', 'Alert feed', 'Audit table'] }
  ,{ id: 'iotdashboard', ar: 'لوحة IoT', en: 'IoT Dashboard', patterns: [/iot dashboard|smart devices|لوحة iot|أجهزة ذكية|حساسات/i], sections: ['device grid', 'sensor readings', 'automation rules', 'alerts'], tools: ['Device cards', 'Sensor metrics', 'Rule list'] }
  ,{ id: 'smarthome', ar: 'بيت ذكي', en: 'Smart Home UI', patterns: [/smart home|home automation|بيت ذكي|منزل ذكي|تحكم أجهزة/i], sections: ['rooms', 'devices', 'energy usage', 'automation'], tools: ['Room cards', 'Device toggles', 'Energy mock'] }
  ,{ id: 'carshowroom', ar: 'معرض سيارات', en: 'Car Showroom', patterns: [/car showroom|cars marketplace|معرض سيارات|بيع سيارات|سيارات/i], sections: ['featured cars', 'filters', 'spec cards', 'contact dealer'], tools: ['Spec cards', 'Filter chips', 'Comparison table'] }
  ,{ id: 'rentalapp', ar: 'تأجير معدات/سيارات', en: 'Rental App', patterns: [/rental app|equipment rental|تأجير|ايجار معدات|إيجار سيارات/i], sections: ['availability', 'item cards', 'booking dates', 'pricing'], tools: ['Availability mock', 'Date picker UI', 'Price cards'] }
  ,{ id: 'hotelsite', ar: 'فندق/حجز غرف', en: 'Hotel Website', patterns: [/hotel website|hotel booking|فندق|حجز فندق|غرف/i], sections: ['rooms', 'amenities', 'booking widget', 'reviews'], tools: ['Room cards', 'Booking widget', 'Review cards'] }
  ,{ id: 'tourguide', ar: 'مرشد سياحي', en: 'Tour Guide App', patterns: [/tour guide|city guide|مرشد سياحي|دليل مدينة|أماكن سياحية/i], sections: ['city hero', 'places', 'routes', 'tips'], tools: ['Place cards', 'Route timeline', 'Tip cards'] }
  ,{ id: 'languagelearning', ar: 'تعلم لغات', en: 'Language Learning App', patterns: [/language learning|learn english|تعلم لغة|تعليم انجليزي|دولينجو/i], sections: ['lesson path', 'practice cards', 'progress', 'review'], tools: ['Lesson cards', 'Flashcards', 'Progress mock'] }
  ,{ id: 'examplanner', ar: 'مخطط امتحانات', en: 'Exam Planner', patterns: [/exam planner|study planner|مخطط امتحانات|جدول مذاكرة|خطة امتحان/i], sections: ['subjects', 'study schedule', 'progress', 'exam countdown'], tools: ['Schedule table', 'Progress bars', 'Countdown'] }
  ,{ id: 'universityportal', ar: 'بوابة جامعة', en: 'University Portal', patterns: [/university portal|campus portal|بوابة جامعة|جامعة|مواد جامعية/i], sections: ['student dashboard', 'courses', 'grades', 'announcements'], tools: ['Course cards', 'Grade table', 'Announcements'] }
  ,{ id: 'researchpaper', ar: 'بحث علمي/PDF', en: 'Research Paper', patterns: [/research paper|academic report|بحث علمي|بحث جامعي|مراجع علمية|مصادر/i], sections: ['abstract', 'introduction', 'method', 'discussion', 'references'], tools: ['PDF print layout', 'Citation sections', 'Source list'] }
  ,{ id: 'thesisoutline', ar: 'خطة رسالة', en: 'Thesis Outline', patterns: [/thesis outline|dissertation|خطة رسالة|رسالة ماجستير|أطروحة/i], sections: ['title', 'problem statement', 'objectives', 'methodology', 'timeline'], tools: ['Academic layout', 'Timeline', 'Reference placeholders'] }
  ,{ id: 'kidssite', ar: 'موقع أطفال', en: 'Kids Learning Site', patterns: [/kids learning|children site|موقع أطفال|تعليم أطفال|ألعاب أطفال/i], sections: ['friendly hero', 'learning cards', 'mini games', 'parent notes'], tools: ['Large cards', 'Colorful UI', 'Simple progress'] }
  ,{ id: 'nonprofit', ar: 'منظمة غير ربحية', en: 'Nonprofit Website', patterns: [/nonprofit|ngo|منظمة غير ربحية|جمعية خيرية|مبادرة/i], sections: ['mission', 'impact stats', 'programs', 'donation CTA'], tools: ['Impact cards', 'Program grid', 'Donation block'] }
  ,{ id: 'religioussite', ar: 'موقع ديني/مجتمعي', en: 'Community / Religious Site', patterns: [/mosque website|church website|community center|مسجد|كنيسة|مركز مجتمعي/i], sections: ['schedule', 'events', 'announcements', 'donation'], tools: ['Schedule cards', 'Event list', 'Announcement bar'] }
  ,{ id: 'weddingsite', ar: 'موقع زفاف', en: 'Wedding Website', patterns: [/wedding website|wedding invitation|موقع زفاف|دعوة فرح|زفاف/i], sections: ['couple hero', 'event details', 'gallery', 'RSVP'], tools: ['RSVP form mock', 'Gallery', 'Timeline'] }
  ,{ id: 'invitation', ar: 'دعوة رقمية', en: 'Digital Invitation', patterns: [/digital invitation|invite page|دعوة رقمية|دعوة مناسبة|كارت دعوة/i], sections: ['event title', 'details', 'location', 'RSVP'], tools: ['Share card', 'RSVP mock', 'Print view'] }
  ,{ id: 'restaurantdashboard', ar: 'لوحة مطعم', en: 'Restaurant Admin', patterns: [/restaurant dashboard|restaurant admin|لوحة مطعم|إدارة مطعم/i], sections: ['orders', 'tables', 'menu items', 'sales'], tools: ['Order cards', 'Table status', 'Sales mock'] }
  ,{ id: 'doctorportfolio', ar: 'موقع طبيب', en: 'Doctor Portfolio', patterns: [/doctor website|doctor portfolio|موقع طبيب|دكتور شخصي|عيادة شخصية/i], sections: ['doctor hero', 'services', 'schedule', 'patient notes'], tools: ['Service cards', 'Appointment CTA', 'Trust sections'] }
  ,{ id: 'dentalclinic', ar: 'عيادة أسنان', en: 'Dental Clinic', patterns: [/dental clinic|dentist|عيادة أسنان|طبيب أسنان|أسنان/i], sections: ['services', 'before after', 'booking', 'care tips'], tools: ['Treatment cards', 'Booking mock', 'Gallery'] }
  ,{ id: 'petclinic', ar: 'عيادة بيطرية', en: 'Pet Clinic', patterns: [/pet clinic|veterinary|عيادة بيطرية|حيوانات أليفة|بيطري/i], sections: ['pet services', 'appointments', 'pet records', 'tips'], tools: ['Pet cards', 'Appointment mock', 'Care notes'] }
  ,{ id: 'realestatedashboard', ar: 'لوحة عقارات', en: 'Real Estate CRM', patterns: [/real estate crm|property dashboard|لوحة عقارات|إدارة عقارات/i], sections: ['properties', 'leads', 'viewings', 'contracts'], tools: ['Property table', 'Lead pipeline', 'Viewing calendar'] }
  ,{ id: 'coursemarketplace', ar: 'سوق كورسات', en: 'Course Marketplace', patterns: [/course marketplace|courses marketplace|سوق كورسات|بيع كورسات|منصة دورات/i], sections: ['course search', 'instructors', 'course cards', 'cart'], tools: ['Course cards', 'Instructor badges', 'Cart mock'] }
  ,{ id: 'microlearning', ar: 'تعلم قصير', en: 'Microlearning App', patterns: [/microlearning|short lessons|تعلم قصير|دروس قصيرة|تعليم سريع/i], sections: ['daily lesson', 'streak', 'cards', 'review'], tools: ['Lesson cards', 'Streak badge', 'Review queue'] }
  ,{ id: 'gamehub', ar: 'مركز ألعاب', en: 'Game Hub', patterns: [/game hub|arcade hub|مركز ألعاب|بوابة ألعاب|العاب كثيرة/i], sections: ['game cards', 'leaderboard', 'categories', 'play preview'], tools: ['Game cards', 'Leaderboard', 'Local stats'] }
  ,{ id: 'snakegame', ar: 'لعبة الثعبان', en: 'Snake Game', patterns: [/snake game|لعبة الثعبان|لعبة التعبان|ثعبان/i], sections: ['canvas game', 'scoreboard', 'controls', 'high score'], tools: ['Canvas loop', 'Keyboard/touch controls', 'Local high score'] }
  ,{ id: 'ponggame', ar: 'لعبة Pong', en: 'Pong Game', patterns: [/pong game|لعبة pong|بونج|بينج بونج/i], sections: ['canvas game', 'scoreboard', 'AI paddle', 'controls'], tools: ['Canvas loop', 'Keyboard controls', 'Score state'] }
  ,{ id: 'breakoutgame', ar: 'لعبة Breakout', en: 'Breakout Game', patterns: [/breakout game|brick game|لعبة كسر الطوب|كسر الطوب/i], sections: ['canvas game', 'bricks', 'lives', 'score'], tools: ['Collision logic', 'Score state', 'Restart control'] }
  ,{ id: 'flappygame', ar: 'لعبة طائر', en: 'Flappy Game', patterns: [/flappy game|flappy bird|لعبة الطائر|عصفور/i], sections: ['canvas game', 'pipes', 'score', 'tap controls'], tools: ['Gravity loop', 'Tap/space control', 'High score'] }
  ,{ id: 'shootergame', ar: 'لعبة تصويب فضاء', en: 'Shooter Game', patterns: [/shooter game|space shooter game|لعبة فضاء|لعبة سفينة|تصويب فضاء/i], sections: ['canvas game', 'player ship', 'enemies', 'bullets'], tools: ['Bullet loop', 'Enemy waves', 'Score state'] }
  ,{ id: 'memorygame', ar: 'لعبة ذاكرة', en: 'Memory Game', patterns: [/memory game|card match|لعبة ذاكرة|تطابق كروت/i], sections: ['card grid', 'moves', 'timer', 'win state'], tools: ['Flip state', 'Match logic', 'Local score'] }
  ,{ id: 'xogame', ar: 'لعبة X/O', en: 'Tic Tac Toe Game', patterns: [/tic tac toe game|xo game|لعبة x o|اكس او|إكس أو/i], sections: ['game grid', 'turn state', 'winner', 'restart'], tools: ['Win logic', 'Local state', 'Restart'] }
  ,{ id: 'calculator', ar: 'آلة حاسبة', en: 'Calculator App', patterns: [/calculator app|simple calculator|آلة حاسبة|حاسبة|كالكوليتر/i], sections: ['display', 'keypad', 'history', 'copy'], tools: ['Calculator logic', 'Local history', 'Keyboard support'] }
  ,{ id: 'timer', ar: 'مؤقت/Stopwatch', en: 'Timer / Stopwatch', patterns: [/timer app|stopwatch|pomodoro timer|مؤقت|ستوب ووتش|بومودورو/i], sections: ['timer display', 'controls', 'presets', 'history'], tools: ['Timer state', 'Presets', 'Local history'] }
  ,{ id: 'habitmobile', ar: 'عادات موبايل', en: 'Mobile Habit App', patterns: [/mobile habit|habit apk|تطبيق عادات apk|عادات موبايل/i], sections: ['mobile cards', 'streaks', 'daily check', 'APK notes'], tools: ['Mobile UI', 'Local storage', 'Capacitor-ready'] }
  ,{ id: 'offlinefirstapp', ar: 'تطبيق Offline', en: 'Offline-first App', patterns: [/offline first|offline app|تطبيق بدون نت|offline|يشتغل بدون نت/i], sections: ['offline shell', 'local data', 'sync notes', 'install'], tools: ['LocalStorage/IndexedDB plan', 'PWA cache', 'Sync notes'] }
  ,{ id: 'apkbuilderui', ar: 'واجهة بناء APK', en: 'APK Builder UI', patterns: [/apk builder|build apk ui|واجهة بناء apk|محرك apk|بناء تطبيق/i], sections: ['project input', 'build status', 'logs', 'download apk'], tools: ['Cloud build status', 'Log panel', 'Download states'] }


];

function detectTemplate(prompt: string): TemplateId {
  const t = prompt.toLowerCase();
  for (const item of templateCatalog) {
    if (item.patterns.some((pattern) => pattern.test(t))) return item.id;
  }
  return 'custom';
}

function getTemplateMeta(template: TemplateId) {
  return templateCatalog.find((item) => item.id === template);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pick<T>(items: T[], seed: number) {
  return items[seed % items.length];
}

function escapeHtml(value: string) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inferBrand(prompt: string, language: string) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  const quoted = clean.match(/["“”']([^"“”']{2,40})["“”']/)?.[1];
  const named = clean.match(/(?:اسم(?:ه|ها)?|called|named|brand|اسم البراند)\s*[:：-]?\s*([\p{L}\p{N}][\p{L}\p{N}\s&-]{1,40})/iu)?.[1];
  const result = quoted || named;
  if (result) return result.trim().slice(0, 34);
  return languageCopy(detectRequestedLanguage(prompt, language)).defaultBrand;
}

function styleVariant(prompt: string) {
  const seed = hashText(prompt || 'qalvero');
  const palettes = [
    { name: 'Aurora', bg: '#070914', surface: 'rgba(255,255,255,.08)', a: '#ff8a3d', b: '#ff4d8d', text: '#f8fafc' },
    { name: 'Ocean', bg: '#04111f', surface: 'rgba(255,255,255,.075)', a: '#38bdf8', b: '#818cf8', text: '#f8fafc' },
    { name: 'Emerald', bg: '#04140f', surface: 'rgba(255,255,255,.075)', a: '#22c55e', b: '#14b8a6', text: '#f8fafc' },
    { name: 'Violet', bg: '#0b0718', surface: 'rgba(255,255,255,.08)', a: '#8b7bff', b: '#ff69c6', text: '#f8fafc' },
    { name: 'Light Premium', bg: '#f7f8fc', surface: '#ffffff', a: '#2563eb', b: '#f97316', text: '#0f172a' }
  ];
  const layouts = ['split hero', 'center hero', 'sidebar shell', 'card grid', 'editorial'];
  return { seed, palette: pick(palettes, seed), layout: pick(layouts, Math.floor(seed / 7)) };
}

function templateInstruction(template: string, language: string) {
  const outputLang = detectRequestedLanguage('', language);
  const ar = outputLang === 'ar' || outputLang === 'ar-EG';
  const meta = getTemplateMeta(template as TemplateId);
  if (!meta) {
    return ar
      ? 'لو مفيش نمط تنفيذ داخلي مناسب، ابنِ أبسط هيكل احترافي يوفر الكريدت ويركز على المطلوب فقط.'
      : 'If no internal implementation pattern fits, build the simplest professional structure that saves credits and focuses only on the request.';
  }
  const label = localizedTemplateName(template as TemplateId, outputLang);
  const sections = meta.sections.join(', ');
  const tools = meta.tools.join(', ');
  return ar
    ? `استخدم نمط تنفيذ داخلي من Qalvero بدون إخبار المستخدم أنه قالب. نوع المشروع: ${label}. الهيكل المقترح: ${sections}. الأدوات المدمجة: ${tools}. عدّل فقط عبر طبقة تخصيص آمنة: الاسم، الألوان، النصوص، بيانات العرض، ترتيب الأقسام الثانوية، وحالات الواجهة. لا تكسر الوظائف الأساسية أو event handlers أو localStorage أو Canvas loop أو إعدادات التصدير. لو الطلب خارج الأنماط الداخلية، ابنِه عادي. لا تذكر كلمة قالب أو جاهز للمستخدم.`
    : `Use a Qalvero internal implementation pattern without telling the user it is a template. Project type: ${label}. Suggested structure: ${sections}. Built-in tools: ${tools}. Customize only through the safe customization layer: name, colors, copy, mock data, secondary section order, and UI states. Do not break core functions, event handlers, localStorage, Canvas loops, or export settings. If the request is outside internal patterns, build it normally. Never mention templates or ready-template usage to the user.`;
}

function wantsCustomBuild(prompt: string) {
  return /من الصفر|فكرة جديدة|مش قالب|custom|from scratch|unique|not template|غير موجود/i.test(prompt);
}

function shouldUseLocalTemplate(prompt: string, files: WorkspaceFile[]) {
  const template = detectTemplate(prompt);
  if (template === 'custom') return false;
  if (wantsCustomBuild(prompt)) return false;
  if (Array.isArray(files) && files.some((f) => f.kind === 'text' && String(f.content || '').trim().length > 600)) return false;
  return true;
}

function templateItems(template: TemplateId, language: string) {
  const outputLang = detectRequestedLanguage('', language);
  const ar = outputLang === 'ar' || outputLang === 'ar-EG';
  if (!ar && outputLang !== 'en') return languageCopy(outputLang).defaultItems;
  const map: Partial<Record<TemplateId, string[]>> = {
    ecommerce: ar ? ['منتج أساسي', 'باقة مميزة', 'عرض محدود', 'منتج جديد'] : ['Core Product', 'Premium Pack', 'Limited Offer', 'New Arrival'],
    marketplace: ar ? ['بائع مميز', 'منتج رائج', 'مزاد نشط', 'طلب سريع'] : ['Featured Vendor', 'Trending Listing', 'Active Auction', 'Quick Order'],
    landing: ar ? ['سرعة الإطلاق', 'واجهة نظيفة', 'نظام قابل للتوسع', 'دعم ذكي'] : ['Fast launch', 'Clean UI', 'Scalable system', 'Smart support'],
    saas: ar ? ['إدارة الحساب', 'خطط مرنة', 'تكاملات', 'تحليلات'] : ['Account Control', 'Flexible Plans', 'Integrations', 'Analytics'],
    dashboard: ar ? ['المستخدمون', 'الإيرادات', 'المهام', 'النمو'] : ['Users', 'Revenue', 'Tasks', 'Growth'],
    analytics: ar ? ['زيارات', 'تحويلات', 'تقارير', 'تصدير'] : ['Visits', 'Conversions', 'Reports', 'Export'],
    portfolio: ar ? ['واجهة متجر', 'تطبيق مهام', 'منصة تعليم', 'هوية رقمية'] : ['Store UI', 'Task App', 'Learning Platform', 'Digital Identity'],
    resume: ar ? ['الخبرات', 'المهارات', 'المشاريع', 'طباعة PDF'] : ['Experience', 'Skills', 'Projects', 'Print PDF'],
    blog: ar ? ['دليل سريع', 'تحليل عميق', 'قصة نجاح', 'أخبار المنتج'] : ['Quick Guide', 'Deep Analysis', 'Success Story', 'Product News'],
    newsletter: ar ? ['عدد جديد', 'اشتراك', 'جمهورك', 'أرشيف'] : ['New Issue', 'Subscribe', 'Audience', 'Archive'],
    auth: ar ? ['تسجيل دخول', 'إنشاء حساب', 'استعادة كلمة المرور', 'لوحة حساب'] : ['Login', 'Signup', 'Password reset', 'Account dashboard'],
    document: ar ? ['ملخص تنفيذي', 'الأهداف', 'الجدول', 'التوقيع'] : ['Executive summary', 'Goals', 'Table', 'Signature'],
    invoice: ar ? ['بيانات العميل', 'جدول البنود', 'الضريبة', 'الإجمالي'] : ['Client Info', 'Line Items', 'Tax', 'Total'],
    tool: ar ? ['إدخال البيانات', 'النتيجة', 'السجل', 'التصدير'] : ['Input', 'Result', 'History', 'Export'],
    fileconverter: ar ? ['رفع ملف', 'اختيار التحويل', 'معاينة', 'تحميل'] : ['Upload', 'Conversion', 'Preview', 'Download'],
    todo: ar ? ['مهام اليوم', 'أولوية', 'تركيز', 'إنجاز'] : ['Today Tasks', 'Priority', 'Focus', 'Progress'],
    notes: ar ? ['ملاحظة جديدة', 'وسوم', 'بحث', 'تصدير'] : ['New Note', 'Tags', 'Search', 'Export'],
    chatbot: ar ? ['رسائل', 'أدوات', 'ملفات', 'نسخ'] : ['Messages', 'Tools', 'Files', 'Copy'],
    restaurant: ar ? ['قهوة مختصة', 'وجبات خفيفة', 'عروض اليوم', 'حجز طاولة'] : ['Specialty Coffee', 'Small Bites', 'Today Offers', 'Reserve Table'],
    delivery: ar ? ['طلب جديد', 'قيد التحضير', 'في الطريق', 'تم التسليم'] : ['New Order', 'Preparing', 'On the Way', 'Delivered'],
    school: ar ? ['برامج تعليمية', 'مدرسون', 'جدول الدروس', 'تسجيل طالب'] : ['Programs', 'Teachers', 'Schedule', 'Enroll Student'],
    clinic: ar ? ['كشف عام', 'متابعة', 'تحاليل', 'حجز موعد'] : ['General Checkup', 'Follow-up', 'Labs', 'Book Appointment'],
    booking: ar ? ['الخدمة', 'الموعد', 'البيانات', 'التأكيد'] : ['Service', 'Time Slot', 'Details', 'Confirmation'],
    realestate: ar ? ['شقق', 'فيلات', 'إيجار', 'بيع'] : ['Apartments', 'Villas', 'Rentals', 'For Sale'],
    travel: ar ? ['رحلة قصيرة', 'باقة عائلية', 'برنامج يومي', 'حجز'] : ['Short Trip', 'Family Package', 'Daily Plan', 'Booking'],
    gym: ar ? ['تمارين قوة', 'كارديو', 'مدرب خاص', 'جدول أسبوعي'] : ['Strength', 'Cardio', 'Personal Coach', 'Weekly Schedule'],
    agency: ar ? ['تصميم مواقع', 'هوية بصرية', 'تسويق', 'استشارات'] : ['Web Design', 'Brand Identity', 'Marketing', 'Consulting'],
    course: ar ? ['الوحدة الأولى', 'تطبيق عملي', 'اختبار قصير', 'شهادة'] : ['Module One', 'Practice', 'Quick Quiz', 'Certificate'],
    video: ar ? ['الأكثر مشاهدة', 'أكشن', 'كرتون', 'قائمتي'] : ['Trending', 'Action', 'Cartoon', 'My List'],
    music: ar ? ['المفضلة', 'قائمة تشغيل', 'ألبوم جديد', 'تشغيل لاحق'] : ['Favorites', 'Playlist', 'New Album', 'Queue'],
    gallery: ar ? ['صور مميزة', 'تصنيفات', 'معاينة', 'تحميل'] : ['Featured Photos', 'Categories', 'Preview', 'Download'],
    crm: ar ? ['Lead جديد', 'متابعة', 'عرض سعر', 'تم البيع'] : ['New Lead', 'Follow-up', 'Proposal', 'Won'],
    inventory: ar ? ['المخزون', 'منخفض', 'حركة', 'تصنيفات'] : ['Stock', 'Low Items', 'Movement', 'Categories'],
    social: ar ? ['المنشورات', 'الملف الشخصي', 'الإعجابات', 'المواضيع'] : ['Feed', 'Profile', 'Likes', 'Topics'],
    forum: ar ? ['موضوع جديد', 'تصنيفات', 'ردود', 'أعضاء'] : ['New Topic', 'Categories', 'Replies', 'Members'],
    game: ar ? ['اللعب', 'النقاط', 'المراحل', 'الترتيب'] : ['Play', 'Score', 'Levels', 'Leaderboard'],
    helpdesk: ar ? ['تذاكر', 'أسئلة شائعة', 'حالة الطلب', 'دعم'] : ['Tickets', 'FAQ', 'Status', 'Support'],
    office: ar ? ['مستند Word', 'جدول Excel', 'عرض PowerPoint', 'PDF'] : ['Word Document', 'Excel Sheet', 'PowerPoint Deck', 'PDF'],
    word: ar ? ['غلاف', 'عناوين', 'جداول', 'مراجع'] : ['Cover', 'Headings', 'Tables', 'References'],
    spreadsheet: ar ? ['جداول', 'معادلات', 'رسوم', 'CSV'] : ['Tables', 'Formulas', 'Charts', 'CSV'],
    presentation: ar ? ['غلاف', 'سلايدات', 'ملاحظات', 'خاتمة'] : ['Cover', 'Slides', 'Speaker Notes', 'Closing'],
    mailmerge: ar ? ['حقول', 'قالب خطاب', 'سجلات', 'تصدير'] : ['Fields', 'Letter Template', 'Records', 'Export'],
    codeassistant: ar ? ['تحليل مشروع', 'خطة تعديل', 'Patch', 'اختبارات'] : ['Repo Analysis', 'Edit Plan', 'Patch', 'Tests'],
    desktopapp: ar ? ['واجهة', 'تخزين محلي', 'تغليف', 'Linux/Windows'] : ['Shell', 'Local Storage', 'Packaging', 'Linux/Windows'],
    mobileapp: ar ? ['PWA', 'موبايل', 'Offline', 'تحميل'] : ['PWA', 'Mobile UI', 'Offline', 'Install'],
    apkapp: ar ? ['واجهة موبايل', 'Capacitor', 'JDK 17', 'Android SDK'] : ['Mobile UI', 'Capacitor', 'JDK 17', 'Android SDK'],
    nativeandroid: ar ? ['Gradle', 'MainActivity', 'AndroidManifest', 'APK'] : ['Gradle', 'MainActivity', 'AndroidManifest', 'APK'],
    custom: ar ? ['قسم رئيسي', 'ميزة', 'تفاصيل', 'تصدير'] : ['Main', 'Feature', 'Details', 'Export']
  };
  const fallback = getTemplateMeta(template)?.sections || map.custom || ['Main', 'Feature', 'Details', 'Export'];
  return map[template] || fallback;
}



type GameKind = 'arcade' | 'snake' | 'pong' | 'breakout' | 'flappy' | 'dodge' | 'shooter' | 'clicker' | 'memory' | 'tictactoe';

function detectGameKind(prompt: string): GameKind {
  const text = String(prompt || '').toLowerCase();
  if (/snake|ثعبان|التعبان|الحية/.test(text)) return 'snake';
  if (/pong|بينج|بونج/.test(text)) return 'pong';
  if (/breakout|brick|bricks|طوب|كسر الطوب|بلوك/.test(text)) return 'breakout';
  if (/flappy|bird|طائر|عصفور/.test(text)) return 'flappy';
  if (/dodge|avoid|تفادي|تجنب|اهرب/.test(text)) return 'dodge';
  if (/shooter|space|shoot|رصاص|اضرب|فضاء|سفينة/.test(text)) return 'shooter';
  if (/clicker|target|aim|اضغط|نشن|هدف/.test(text)) return 'clicker';
  if (/memory|cards|ذاكرة|كروت|بطاقات/.test(text)) return 'memory';
  if (/tic tac toe|tictactoe|xo|x o|اكس او|إكس أو/.test(text)) return 'tictactoe';
  return 'arcade';
}

function gameTitle(kind: GameKind, outputLang: OutputLang) {
  const ar = outputLang === 'ar' || outputLang === 'ar-EG';
  const map: Record<GameKind, { en: string; ar: string }> = {
    arcade: { en: '2D Arcade Pack', ar: 'حزمة ألعاب 2D' },
    snake: { en: 'Snake Game', ar: 'لعبة الثعبان' },
    pong: { en: 'Pong Game', ar: 'لعبة Pong' },
    breakout: { en: 'Breakout Bricks', ar: 'لعبة كسر الطوب' },
    flappy: { en: 'Flappy Flight', ar: 'لعبة الطائر' },
    dodge: { en: 'Dodge Blocks', ar: 'لعبة تفادي المربعات' },
    shooter: { en: 'Space Shooter', ar: 'لعبة سفينة الفضاء' },
    clicker: { en: 'Target Clicker', ar: 'لعبة صيد الأهداف' },
    memory: { en: 'Memory Cards', ar: 'لعبة الذاكرة' },
    tictactoe: { en: 'Tic Tac Toe', ar: 'لعبة إكس أو' }
  };
  return ar ? map[kind].ar : map[kind].en;
}

function buildGameHtml(prompt: string, language: string, brand: string, style: ReturnType<typeof styleVariant>) {
  const outputLang = detectRequestedLanguage(prompt, language);
  const c = languageCopy(outputLang);
  const kind = detectGameKind(prompt);
  const p = style.palette;
  const ar = c.dir === 'rtl';
  const gameName = gameTitle(kind, outputLang);
  const copy = ar ? {
    badge: '✦ Qalvero 2D Game Engine',
    subtitle: 'تجربة ألعاب 2D قابلة للتشغيل محليًا، مع اسم ومظهر ونصوص مخصصة حسب طلبك.',
    choose: 'اختار لعبة', score: 'النقاط', best: 'الأفضل', lives: 'المحاولات', status: 'الحالة',
    restart: 'إعادة تشغيل', pause: 'إيقاف مؤقت', resume: 'تشغيل',
    controls: 'التحكم: الأسهم أو WASD، زر Space للقفز/الضرب، واللمس من الموبايل.',
    ready: 'جاهز', gameOver: 'انتهت اللعبة', paused: 'متوقف مؤقتًا', win: 'فوز', draw: 'تعادل',
    games: { arcade: 'كل الألعاب', snake: 'الثعبان', pong: 'Pong', breakout: 'كسر الطوب', flappy: 'الطائر', dodge: 'تفادي', shooter: 'فضاء', clicker: 'أهداف', memory: 'ذاكرة', tictactoe: 'إكس أو' }
  } : {
    badge: '✦ Qalvero 2D Game Engine',
    subtitle: 'A playable local 2D game experience with customized name, style, and copy from your request.',
    choose: 'Choose game', score: 'Score', best: 'Best', lives: 'Lives', status: 'Status',
    restart: 'Restart', pause: 'Pause', resume: 'Resume',
    controls: 'Controls: Arrow keys or WASD, Space to jump/shoot, and touch buttons on mobile.',
    ready: 'Ready', gameOver: 'Game over', paused: 'Paused', win: 'Win', draw: 'Draw',
    games: { arcade: 'All Games', snake: 'Snake', pong: 'Pong', breakout: 'Breakout', flappy: 'Flappy', dodge: 'Dodge', shooter: 'Shooter', clicker: 'Clicker', memory: 'Memory', tictactoe: 'Tic Tac Toe' }
  };
  const gameButtons = (['snake','pong','breakout','flappy','dodge','shooter','clicker','memory','tictactoe'] as GameKind[])
    .map((g) => `<button class="game-tab" data-game="${g}">${escapeHtml(copy.games[g])}</button>`).join('');
  return `<!doctype html>
<html lang="${c.htmlLang}" dir="${c.dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(brand)} — ${escapeHtml(gameName)}</title>
<style>
:root{--bg:${p.bg};--surface:${p.surface};--a:${p.a};--b:${p.b};--text:${p.text};--muted:${p.name === 'Light Premium' ? '#526070' : '#a7b0c0'}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top ${ar ? 'right' : 'left'},color-mix(in srgb,var(--a) 30%,transparent),transparent 32%),linear-gradient(135deg,var(--bg),#090b18);color:var(--text);font-family:Inter,Tahoma,Arial,sans-serif}.shell{width:min(1180px,100%);margin:auto;padding:24px}.top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.brand{font-size:22px;font-weight:950}.pill{border:1px solid color-mix(in srgb,var(--text) 15%,transparent);background:color-mix(in srgb,var(--surface) 88%,transparent);border-radius:999px;padding:10px 14px;color:var(--muted);font-weight:850}.hero{display:grid;grid-template-columns:1fr .82fr;gap:18px;align-items:stretch}.panel,.game-card{border:1px solid color-mix(in srgb,var(--text) 12%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 92%,transparent),color-mix(in srgb,var(--surface) 58%,transparent));border-radius:30px;box-shadow:0 24px 80px rgba(0,0,0,.28);backdrop-filter:blur(16px)}.panel{padding:24px}.eyebrow{color:var(--a);font-weight:950;margin-bottom:12px}.panel h1{font-size:clamp(34px,6vw,66px);line-height:1;margin:0 0 14px}.panel p{color:var(--muted);font-size:16px;line-height:1.8;margin:0}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.stat{border-radius:20px;background:rgba(255,255,255,.06);padding:14px}.stat span{display:block;color:var(--muted);font-size:12px}.stat b{font-size:22px}.game-card{padding:16px}.tabs{display:flex;gap:8px;overflow:auto;padding:4px 0 12px}.game-tab{white-space:nowrap;border:1px solid color-mix(in srgb,var(--text) 14%,transparent);background:rgba(255,255,255,.055);color:var(--text);border-radius:999px;padding:10px 12px;font-weight:900;cursor:pointer}.game-tab.active{background:linear-gradient(135deg,var(--a),var(--b));border-color:transparent;color:#fff}.canvas-wrap{position:relative;border-radius:24px;overflow:hidden;background:#030512;border:1px solid color-mix(in srgb,var(--text) 12%,transparent)}canvas{display:block;width:100%;height:auto;aspect-ratio:16/10;touch-action:none}.overlay{position:absolute;inset:auto 14px 14px;display:flex;justify-content:space-between;gap:10px;pointer-events:none}.tag{padding:8px 10px;border-radius:999px;background:rgba(0,0,0,.46);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:12px}.controls{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.btn{border:0;border-radius:999px;padding:12px 15px;font-weight:950;cursor:pointer}.primary{color:white;background:linear-gradient(135deg,var(--a),var(--b))}.ghost{background:rgba(255,255,255,.08);color:var(--text);border:1px solid color-mix(in srgb,var(--text) 13%,transparent)}.mobile{display:grid;grid-template-columns:repeat(3,56px);gap:8px;justify-content:center;margin-top:12px}.pad{height:46px;border-radius:16px;border:1px solid color-mix(in srgb,var(--text) 14%,transparent);background:rgba(255,255,255,.07);color:var(--text);font-weight:900}.pad.fire{grid-column:1/4;background:linear-gradient(135deg,var(--a),var(--b));color:white}.hint{margin-top:14px;color:var(--muted);line-height:1.7}.foot{margin-top:18px;text-align:center;color:var(--muted);font-size:13px}@media(max-width:900px){.hero{grid-template-columns:1fr}.shell{padding:16px}.stats{grid-template-columns:repeat(3,1fr)}}@media(max-width:520px){.top{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:1fr}.panel{padding:20px}.game-card{padding:12px}.mobile{display:grid}}
</style>
</head>
<body>
<div class="shell">
  <header class="top"><div class="brand">${escapeHtml(brand)}</div><div class="pill">${escapeHtml(gameName)} · HTML / JSX / ZIP</div></header>
  <main class="hero">
    <section class="panel"><div class="eyebrow">${escapeHtml(copy.badge)}</div><h1>${escapeHtml(gameName)}</h1><p>${escapeHtml(copy.subtitle)}</p><div class="stats"><div class="stat"><span>${escapeHtml(copy.score)}</span><b id="score">0</b></div><div class="stat"><span>${escapeHtml(copy.best)}</span><b id="best">0</b></div><div class="stat"><span>${escapeHtml(copy.lives)}</span><b id="lives">3</b></div></div><p class="hint">${escapeHtml(copy.controls)}</p></section>
    <section class="game-card"><div class="tabs" aria-label="${escapeHtml(copy.choose)}">${gameButtons}</div><div class="canvas-wrap"><canvas id="game" width="800" height="500"></canvas><div class="overlay"><span class="tag" id="gameName">${escapeHtml(gameName)}</span><span class="tag" id="status">${escapeHtml(copy.ready)}</span></div></div><div class="controls"><button class="btn primary" id="restart">${escapeHtml(copy.restart)}</button><button class="btn ghost" id="pause">${escapeHtml(copy.pause)}</button></div><div class="mobile"><button class="pad" data-key="ArrowUp">▲</button><button class="pad" data-key="ArrowLeft">◀</button><button class="pad" data-key="ArrowRight">▶</button><button class="pad" data-key="ArrowDown">▼</button><button class="pad fire" data-key=" ">SPACE</button></div></section>
  </main>
  <div class="foot">Built by Qalvero AI · runs locally without external libraries · localStorage high score enabled.</div>
</div>
<script>
(function(){
const DEFAULT_GAME='${kind === 'arcade' ? 'snake' : kind}';
const L={ready:${JSON.stringify(copy.ready)},gameOver:${JSON.stringify(copy.gameOver)},paused:${JSON.stringify(copy.paused)},win:${JSON.stringify(copy.win)},draw:${JSON.stringify(copy.draw)},games:${JSON.stringify(copy.games)}};
const C=document.getElementById('game'),ctx=C.getContext('2d'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),livesEl=document.getElementById('lives'),statusEl=document.getElementById('status'),nameEl=document.getElementById('gameName');
let game=DEFAULT_GAME,score=0,lives=3,best=Number(localStorage.getItem('qv_best_'+game)||0),paused=false,over=false,last=0,acc=0,keys={};
let snake,food,dir,nextDir,pong,breakout,flappy,dodge,shooter,clicker,memory,ttt;
function rand(a,b){return Math.random()*(b-a)+a} function irand(a,b){return Math.floor(rand(a,b))} function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function setStatus(t){statusEl.textContent=t} function updateHUD(){scoreEl.textContent=score;bestEl.textContent=best;livesEl.textContent=lives;nameEl.textContent=L.games[game]||game;document.querySelectorAll('.game-tab').forEach(b=>b.classList.toggle('active',b.dataset.game===game));}
function saveBest(){if(score>best){best=score;localStorage.setItem('qv_best_'+game,best)}}
function resetBase(){score=0;lives=3;paused=false;over=false;acc=0;best=Number(localStorage.getItem('qv_best_'+game)||0);setStatus(L.ready);updateHUD()}
function setup(){resetBase(); if(game==='snake'){snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];dir={x:1,y:0};nextDir={x:1,y:0};food={x:irand(1,38),y:irand(1,23)};} if(game==='pong'){pong={py:210,ay:210,bx:400,by:250,bvx:260,bvy:160};lives=5;} if(game==='breakout'){let bricks=[];for(let r=0;r<5;r++)for(let c=0;c<10;c++)bricks.push({x:55+c*70,y:45+r*26,w:58,h:16,hit:false});breakout={px:350,bx:400,by:420,bvx:180,bvy:-220,bricks};} if(game==='flappy'){flappy={y:240,vy:0,pipes:[],timer:0};lives=1;} if(game==='dodge'){dodge={x:380,y:430,blocks:[],timer:0};} if(game==='shooter'){shooter={x:380,bullets:[],enemies:[],timer:0};} if(game==='clicker'){clicker={x:400,y:250,r:34,time:30};lives=30;} if(game==='memory'){let vals=['Q','L','O','A','I','X'];let deck=vals.concat(vals).sort(()=>Math.random()-.5).map((v,i)=>({v,i,open:false,done:false}));memory={deck,first:null,lock:false};} if(game==='tictactoe'){ttt={board:Array(9).fill(''),turn:'X',winner:''};lives=0;} updateHUD();}
function hitRect(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function drawBg(){ctx.clearRect(0,0,800,500);let g=ctx.createLinearGradient(0,0,800,500);g.addColorStop(0,'#0c1024');g.addColorStop(1,'#050712');ctx.fillStyle=g;ctx.fillRect(0,0,800,500);ctx.strokeStyle='rgba(255,255,255,.06)';for(let x=0;x<800;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,500);ctx.stroke()}for(let y=0;y<500;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(800,y);ctx.stroke()}}
function pill(x,y,w,h,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill()}
function end(){over=true;setStatus(L.gameOver);saveBest();updateHUD()}
function updateSnake(dt){acc+=dt;if(keys.ArrowUp||keys.w)nextDir={x:0,y:-1};if(keys.ArrowDown||keys.s)nextDir={x:0,y:1};if(keys.ArrowLeft||keys.a)nextDir={x:-1,y:0};if(keys.ArrowRight||keys.d)nextDir={x:1,y:0};if(acc<105)return;acc=0;if(nextDir.x!==-dir.x||nextDir.y!==-dir.y)dir=nextDir;let head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(head.x<0||head.y<0||head.x>=40||head.y>=25||snake.some(s=>s.x===head.x&&s.y===head.y))return end();snake.unshift(head);if(head.x===food.x&&head.y===food.y){score+=10;food={x:irand(1,38),y:irand(1,23)}}else snake.pop();saveBest();updateHUD()}
function drawSnake(){drawBg();ctx.fillStyle='#22c55e';snake.forEach((s,i)=>{ctx.globalAlpha=i?0.82:1;ctx.fillRect(s.x*20+2,s.y*20+2,16,16)});ctx.globalAlpha=1;ctx.fillStyle='#ff4d8d';ctx.beginPath();ctx.arc(food.x*20+10,food.y*20+10,8,0,7);ctx.fill()}
function updatePong(dt){let p=pong;if(keys.ArrowUp||keys.w)p.py-=360*dt/1000;if(keys.ArrowDown||keys.s)p.py+=360*dt/1000;p.py=clamp(p.py,15,405);p.ay+=((p.by-40)-p.ay)*0.055;p.ay=clamp(p.ay,15,405);p.bx+=p.bvx*dt/1000;p.by+=p.bvy*dt/1000;if(p.by<10||p.by>490)p.bvy*=-1;if(p.bx<35&&p.by>p.py&&p.by<p.py+80){p.bvx=Math.abs(p.bvx)*1.04;score+=5}if(p.bx>765&&p.by>p.ay&&p.by<p.ay+80){p.bvx=-Math.abs(p.bvx)*1.04}if(p.bx<0){lives--;p.bx=400;p.by=250;p.bvx=260;if(lives<=0)end()}if(p.bx>820){score+=20;p.bx=400;p.by=250;p.bvx=-260}saveBest();updateHUD()}
function drawPong(){drawBg();pill(18,pong.py,14,80,'#8b5cf6');pill(768,pong.ay,14,80,'#ff8a3d');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(pong.bx,pong.by,9,0,7);ctx.fill()}
function updateBreakout(dt){let b=breakout;if(keys.ArrowLeft||keys.a)b.px-=420*dt/1000;if(keys.ArrowRight||keys.d)b.px+=420*dt/1000;b.px=clamp(b.px,20,660);b.bx+=b.bvx*dt/1000;b.by+=b.bvy*dt/1000;if(b.bx<8||b.bx>792)b.bvx*=-1;if(b.by<8)b.bvy*=-1;if(b.by>500){lives--;b.bx=400;b.by=420;b.bvy=-220;if(lives<=0)end()}if(hitRect({x:b.bx-8,y:b.by-8,w:16,h:16},{x:b.px,y:462,w:120,h:15})){b.bvy=-Math.abs(b.bvy);b.bvx+=(b.bx-(b.px+60))*3}b.bricks.forEach(br=>{if(!br.hit&&hitRect({x:b.bx-8,y:b.by-8,w:16,h:16},br)){br.hit=true;b.bvy*=-1;score+=10}});if(b.bricks.every(br=>br.hit)){setStatus(L.win);over=true}saveBest();updateHUD()}
function drawBreakout(){drawBg();breakout.bricks.forEach((br,i)=>{if(!br.hit)pill(br.x,br.y,br.w,br.h,i%2?'#ff4d8d':'#ff8a3d')});pill(breakout.px,462,120,15,'#8b5cf6');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(breakout.bx,breakout.by,8,0,7);ctx.fill()}
function updateFlappy(dt){let f=flappy;if(keys[' ']||keys.ArrowUp||keys.w){f.vy=-270;keys[' ']=false;keys.ArrowUp=false;keys.w=false}f.vy+=620*dt/1000;f.y+=f.vy*dt/1000;f.timer+=dt;if(f.timer>1550){f.timer=0;let gapY=rand(120,360);f.pipes.push({x:820,gapY,w:64,gap:142,passed:false})}f.pipes.forEach(p=>p.x-=180*dt/1000);f.pipes=f.pipes.filter(p=>p.x>-90);f.pipes.forEach(p=>{if(!p.passed&&p.x<120){p.passed=true;score+=10}if(120>p.x&&120<p.x+p.w&&(f.y<p.gapY-p.gap/2||f.y>p.gapY+p.gap/2))end()});if(f.y<0||f.y>500)end();saveBest();updateHUD()}
function drawFlappy(){drawBg();ctx.fillStyle='#facc15';ctx.beginPath();ctx.arc(120,flappy.y,16,0,7);ctx.fill();flappy.pipes.forEach(p=>{pill(p.x,0,p.w,p.gapY-p.gap/2,'#22c55e');pill(p.x,p.gapY+p.gap/2,p.w,500,'#22c55e')})}
function updateDodge(dt){let d=dodge;if(keys.ArrowLeft||keys.a)d.x-=360*dt/1000;if(keys.ArrowRight||keys.d)d.x+=360*dt/1000;d.x=clamp(d.x,20,740);d.timer+=dt;if(d.timer>550){d.timer=0;d.blocks.push({x:rand(20,760),y:-30,w:rand(22,60),h:rand(22,60),v:rand(140,260)})}d.blocks.forEach(o=>o.y+=o.v*dt/1000);d.blocks=d.blocks.filter(o=>o.y<540);score+=Math.floor(dt/100);d.blocks.forEach(o=>{if(hitRect({x:d.x,y:d.y,w:40,h:40},o))end()});saveBest();updateHUD()}
function drawDodge(){drawBg();pill(dodge.x,dodge.y,40,40,'#8b5cf6');dodge.blocks.forEach(o=>pill(o.x,o.y,o.w,o.h,'#ff4d8d'))}
function updateShooter(dt){let s=shooter;if(keys.ArrowLeft||keys.a)s.x-=420*dt/1000;if(keys.ArrowRight||keys.d)s.x+=420*dt/1000;s.x=clamp(s.x,20,740);if(keys[' ']){if(!s.lastShot||performance.now()-s.lastShot>220){s.bullets.push({x:s.x+20,y:420});s.lastShot=performance.now()}keys[' ']=false}s.timer+=dt;if(s.timer>700){s.timer=0;s.enemies.push({x:rand(30,740),y:-30,w:36,h:26,v:rand(90,190)})}s.bullets.forEach(b=>b.y-=480*dt/1000);s.enemies.forEach(e=>e.y+=e.v*dt/1000);s.enemies.forEach(e=>{s.bullets.forEach(b=>{if(!e.hit&&b.x>e.x&&b.x<e.x+e.w&&b.y>e.y&&b.y<e.y+e.h){e.hit=true;b.dead=true;score+=15}});if(e.y>500){lives--;e.hit=true;if(lives<=0)end()}});s.bullets=s.bullets.filter(b=>!b.dead&&b.y>-20);s.enemies=s.enemies.filter(e=>!e.hit);saveBest();updateHUD()}
function drawShooter(){drawBg();ctx.fillStyle='#8b5cf6';ctx.beginPath();ctx.moveTo(shooter.x+20,420);ctx.lineTo(shooter.x,460);ctx.lineTo(shooter.x+40,460);ctx.fill();ctx.fillStyle='#fff';shooter.bullets.forEach(b=>ctx.fillRect(b.x-2,b.y,4,14));shooter.enemies.forEach(e=>pill(e.x,e.y,e.w,e.h,'#ff4d8d'))}
function updateClicker(dt){clicker.time-=dt/1000;lives=Math.max(0,Math.ceil(clicker.time));if(clicker.time<=0)end();updateHUD()}
function drawClicker(){drawBg();ctx.fillStyle='#ff8a3d';ctx.beginPath();ctx.arc(clicker.x,clicker.y,clicker.r,0,7);ctx.fill();ctx.fillStyle='white';ctx.font='700 18px Arial';ctx.textAlign='center';ctx.fillText('+',clicker.x,clicker.y+6)}
function drawMemory(){drawBg();let w=150,h=92,ox=85,oy=70;memory.deck.forEach((card,i)=>{let x=ox+(i%4)*165,y=oy+Math.floor(i/4)*120;card.x=x;card.y=y;card.w=w;card.h=h;pill(x,y,w,h,card.done?'#22c55e':(card.open?'#8b5cf6':'#1f2937'));ctx.fillStyle='white';ctx.font='900 34px Arial';ctx.textAlign='center';ctx.fillText(card.open||card.done?card.v:'?',x+w/2,y+h/2+12)});if(memory.deck.every(c=>c.done)){setStatus(L.win);over=true;saveBest()}}
function drawTtt(){drawBg();ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=5;for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(250+i*100,100);ctx.lineTo(250+i*100,400);ctx.stroke();ctx.beginPath();ctx.moveTo(250,100+i*100);ctx.lineTo(550,100+i*100);ctx.stroke()}ctx.font='900 64px Arial';ctx.textAlign='center';ttt.board.forEach((v,i)=>{ctx.fillStyle=v==='X'?'#ff8a3d':'#8b5cf6';ctx.fillText(v,300+(i%3)*100,168+Math.floor(i/3)*100)})}
function winner(b){let wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(let w of wins){if(b[w[0]]&&b[w[0]]===b[w[1]]&&b[w[1]]===b[w[2]])return b[w[0]]}return b.every(Boolean)?'draw':''}
function aiMove(){let empty=ttt.board.map((v,i)=>v?null:i).filter(v=>v!==null);if(empty.length){ttt.board[empty[Math.floor(Math.random()*empty.length)]]='O'}}
function update(dt){if(paused||over)return;if(game==='snake')updateSnake(dt);else if(game==='pong')updatePong(dt);else if(game==='breakout')updateBreakout(dt);else if(game==='flappy')updateFlappy(dt);else if(game==='dodge')updateDodge(dt);else if(game==='shooter')updateShooter(dt);else if(game==='clicker')updateClicker(dt)}
function draw(){if(game==='snake')drawSnake();else if(game==='pong')drawPong();else if(game==='breakout')drawBreakout();else if(game==='flappy')drawFlappy();else if(game==='dodge')drawDodge();else if(game==='shooter')drawShooter();else if(game==='clicker')drawClicker();else if(game==='memory')drawMemory();else if(game==='tictactoe')drawTtt()}
function loop(t){let dt=Math.min(32,t-last||16);last=t;update(dt);draw();requestAnimationFrame(loop)}
window.addEventListener('keydown',e=>{keys[e.key]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault()});window.addEventListener('keyup',e=>keys[e.key]=false);
C.addEventListener('pointerdown',e=>{let r=C.getBoundingClientRect(),x=(e.clientX-r.left)*800/r.width,y=(e.clientY-r.top)*500/r.height;if(game==='clicker'&&!over){let d=Math.hypot(x-clicker.x,y-clicker.y);if(d<clicker.r){score+=10;clicker.x=rand(60,740);clicker.y=rand(60,430);saveBest();updateHUD()}}if(game==='memory'&&!memory.lock&&!over){let card=memory.deck.find(c=>!c.done&&!c.open&&x>c.x&&x<c.x+c.w&&y>c.y&&y<c.y+c.h);if(card){card.open=true;if(memory.first===null)memory.first=card.i;else{let first=memory.deck.find(c=>c.i===memory.first);if(first&&first.v===card.v){first.done=card.done=true;score+=20;memory.first=null;saveBest();updateHUD()}else{memory.lock=true;setTimeout(()=>{first.open=false;card.open=false;memory.first=null;memory.lock=false},650)}}}}if(game==='tictactoe'&&!over){let cx=Math.floor((x-250)/100),cy=Math.floor((y-100)/100),i=cy*3+cx;if(cx>=0&&cx<3&&cy>=0&&cy<3&&!ttt.board[i]){ttt.board[i]='X';let w=winner(ttt.board);if(!w){aiMove();w=winner(ttt.board)}if(w){over=true;setStatus(w==='draw'?L.draw:(w+' '+L.win));if(w==='X')score=100;saveBest();updateHUD()}}}});
document.querySelectorAll('.game-tab').forEach(b=>b.addEventListener('click',()=>{game=b.dataset.game;setup()}));document.getElementById('restart').onclick=setup;document.getElementById('pause').onclick=()=>{paused=!paused;setStatus(paused?L.paused:L.ready);document.getElementById('pause').textContent=paused?${JSON.stringify(copy.resume)}:${JSON.stringify(copy.pause)}};document.querySelectorAll('.pad').forEach(b=>{let k=b.dataset.key;b.addEventListener('pointerdown',()=>{keys[k]=true;if(k===' ')setTimeout(()=>keys[k]=false,80)});b.addEventListener('pointerup',()=>keys[k]=false);b.addEventListener('pointerleave',()=>keys[k]=false)});
setup();requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;
}

function buildGameTemplate(prompt: string, language: string) {
  const outputLang = detectRequestedLanguage(prompt, language);
  const brand = inferBrand(prompt, outputLang);
  const style = styleVariant(prompt);
  const kind = detectGameKind(prompt);
  const html = buildGameHtml(prompt, language, brand, style);
  const jsx = `export default function App() {
  const gameHtml = ${JSON.stringify(html)};
  return (
    <main style={{ minHeight: '100vh', background: '#070914', padding: 0 }}>
      <iframe
        title="Qalvero 2D Game"
        srcDoc={gameHtml}
        style={{ width: '100%', minHeight: '100vh', border: 0, display: 'block' }}
      />
    </main>
  );
}`;
  const ar = outputLang === 'ar' || outputLang === 'ar-EG';
  const rawText = ar
    ? `تم إنشاء لعبة 2D شغالة فعليًا: ${gameTitle(kind, outputLang)}.

الموجود في المشروع:
- محرك Canvas محلي بدون مكتبات خارجية.
- أوضاع لعب متعددة عند الطلب: Snake, Pong, Breakout, Flappy, Dodge, Space Shooter, Target Clicker, Memory Cards, Tic Tac Toe.
- تحكم كيبورد ولمس للموبايل.
- نقاط ومحاولات وحفظ أفضل نتيجة في localStorage.
- HTML وJSX وZIP جاهزين للتشغيل والتحميل.

تم تخصيص اللعبة حسب طلبك مع الحفاظ على منطق التشغيل والتصدير.`
    : `Created a real playable 2D game: ${gameTitle(kind, outputLang)}.\n\nIncluded:\n- Local Canvas engine with no external libraries.\n- Ready games: Snake, Pong, Breakout, Flappy, Dodge, Space Shooter, Target Clicker, Memory Cards, Tic Tac Toe.\n- Keyboard and mobile touch controls.\n- Score, lives, and localStorage high score.\n- HTML, JSX, and ZIP-ready output.\n\nThe game was prepared efficiently and customized from your request. If the requested game is new, QLO 1.3 Agent will build it normally.`;
  return { rawText, html, jsx, template: 'game' as TemplateId, variant: `${style.palette.name} / ${kind}`, outputLanguage: outputLang };
}

function buildLocalTemplate(prompt: string, language: string) {
  const template = detectTemplate(prompt);
  if (template === 'game') return buildGameTemplate(prompt, language);
  if (template === 'custom') return null;
  const outputLang = detectRequestedLanguage(prompt, language);
  const c = languageCopy(outputLang);
  const ar = c.dir === 'rtl';
  const brand = inferBrand(prompt, outputLang);
  const style = styleVariant(prompt);
  const p = style.palette;
  const dir = c.dir;
  const label = localizedTemplateName(template, outputLang);
  const items = templateItems(template, outputLang);
  const title = `${brand} — ${label}`;
  const subtitle = c.subtitle;
  const cta = c.cta;
  const secondary = c.secondary;
  const itemCards = items.map((item, idx) => `<article class="card"><span>0${idx + 1}</span><h3>${escapeHtml(item)}</h3><p>${escapeHtml(c.cardText)}</p></article>`).join('');
  const html = `<!doctype html>
<html lang="${c.htmlLang}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
:root{--bg:${p.bg};--surface:${p.surface};--a:${p.a};--b:${p.b};--text:${p.text};--muted:${p.name === 'Light Premium' ? '#526070' : '#a7b0c0'}}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top ${ar ? 'right' : 'left'},color-mix(in srgb,var(--a) 25%,transparent),transparent 28%),var(--bg);color:var(--text);font-family:Inter,Tahoma,Arial,sans-serif}a{text-decoration:none;color:inherit}.shell{min-height:100vh;padding:28px}.nav{display:flex;justify-content:space-between;align-items:center;gap:16px;max-width:1120px;margin:auto}.logo{font-weight:900;font-size:22px}.pill{border:1px solid color-mix(in srgb,var(--text) 15%,transparent);background:var(--surface);border-radius:999px;padding:10px 14px;color:var(--muted);font-weight:800}.hero{max-width:1120px;margin:56px auto 0;display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center}.hero-card,.panel,.card{border:1px solid color-mix(in srgb,var(--text) 13%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 85%,transparent),color-mix(in srgb,var(--surface) 55%,transparent));box-shadow:0 24px 70px rgba(0,0,0,.24);backdrop-filter:blur(16px);border-radius:30px}.hero-card{padding:34px}.eyebrow{display:inline-flex;gap:8px;align-items:center;color:var(--a);font-weight:900;margin-bottom:14px}.hero h1{font-size:clamp(38px,7vw,76px);line-height:1;margin:0 0 16px}.hero p{font-size:18px;line-height:1.8;color:var(--muted);margin:0 0 24px}.actions{display:flex;flex-wrap:wrap;gap:12px}.btn{border:0;border-radius:999px;padding:13px 18px;font-weight:900;cursor:pointer}.primary{color:white;background:linear-gradient(135deg,var(--a),var(--b));box-shadow:0 16px 36px color-mix(in srgb,var(--a) 25%,transparent)}.ghost{background:var(--surface);color:var(--text);border:1px solid color-mix(in srgb,var(--text) 13%,transparent)}.panel{padding:22px}.metric{display:flex;justify-content:space-between;margin:12px 0;padding:14px;border-radius:18px;background:color-mix(in srgb,var(--surface) 80%,transparent)}.grid{max-width:1120px;margin:26px auto;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{padding:20px}.card span{color:var(--a);font-weight:900}.card h3{margin:12px 0 8px}.card p{margin:0;color:var(--muted);line-height:1.6}.footer{max-width:1120px;margin:26px auto;color:var(--muted);text-align:center}@media(max-width:820px){.hero{grid-template-columns:1fr;margin-top:28px}.grid{grid-template-columns:1fr 1fr}.shell{padding:18px}.hero-card{padding:24px}}@media(max-width:520px){.grid{grid-template-columns:1fr}.actions .btn{width:100%}}
@media print{body{background:white;color:#111}.shell{padding:0}.nav,.actions{display:none}.hero,.grid{display:block}.hero-card,.panel,.card{box-shadow:none;border:1px solid #ddd;margin:12px 0}}
</style>
</head>
<body>
<div class="shell">
  <nav class="nav"><div class="logo">${escapeHtml(brand)}</div><div class="pill">${escapeHtml(label)} · ${escapeHtml(style.layout)}</div></nav>
  <main class="hero">
    <section class="hero-card"><div class="eyebrow">${escapeHtml(c.readyBadge)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><div class="actions"><button class="btn primary">${escapeHtml(cta)}</button><button class="btn ghost">${escapeHtml(secondary)}</button></div></section>
    <aside class="panel"><h2>${escapeHtml(c.overview)}</h2><div class="metric"><b>${escapeHtml(c.template)}</b><span>${escapeHtml(label)}</span></div><div class="metric"><b>${escapeHtml(c.style)}</b><span>${escapeHtml(style.palette.name)}</span></div><div class="metric"><b>${escapeHtml(c.run)}</b><span>HTML / JSX / ZIP / PDF</span></div></aside>
  </main>
  <section class="grid">${itemCards}</section>
  <footer class="footer">${escapeHtml(c.footer)}</footer>
</div>
</body>
</html>`;
  const jsxItems = items.map((item) => `{ title: ${JSON.stringify(item)}, text: ${JSON.stringify(c.cardTextJsx)} }`).join(',');
  const jsx = `export default function App() {
  const items = [${jsxItems}];
  return (
    <main className="qv-app" dir="${dir}">
      <style>{\`
        .qv-app{min-height:100vh;padding:28px;background:radial-gradient(circle at top ${ar ? 'right' : 'left'},${p.a}33,transparent 28%),${p.bg};color:${p.text};font-family:Inter,Tahoma,Arial,sans-serif}.qv-nav{display:flex;justify-content:space-between;align-items:center;max-width:1120px;margin:auto}.qv-logo{font-size:22px;font-weight:900}.qv-pill{border:1px solid rgba(255,255,255,.14);background:${p.surface};border-radius:999px;padding:10px 14px;color:#a7b0c0;font-weight:800}.qv-hero{max-width:1120px;margin:56px auto 0;display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center}.qv-card,.qv-panel,.qv-item{border:1px solid rgba(255,255,255,.13);background:${p.surface};box-shadow:0 24px 70px rgba(0,0,0,.24);backdrop-filter:blur(16px);border-radius:30px}.qv-card{padding:34px}.qv-card h1{font-size:clamp(38px,7vw,76px);line-height:1;margin:0 0 16px}.qv-card p{font-size:18px;line-height:1.8;color:#a7b0c0}.qv-actions{display:flex;gap:12px;flex-wrap:wrap}.qv-btn{border:0;border-radius:999px;padding:13px 18px;font-weight:900}.qv-primary{color:white;background:linear-gradient(135deg,${p.a},${p.b})}.qv-ghost{background:${p.surface};color:${p.text};border:1px solid rgba(255,255,255,.13)}.qv-panel{padding:22px}.qv-metric{display:flex;justify-content:space-between;margin:12px 0;padding:14px;border-radius:18px;background:rgba(255,255,255,.06)}.qv-grid{max-width:1120px;margin:26px auto;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.qv-item{padding:20px}.qv-item span{color:${p.a};font-weight:900}.qv-item p{color:#a7b0c0;line-height:1.6}@media(max-width:820px){.qv-hero{grid-template-columns:1fr;margin-top:28px}.qv-grid{grid-template-columns:1fr 1fr}.qv-app{padding:18px}.qv-card{padding:24px}}@media(max-width:520px){.qv-grid{grid-template-columns:1fr}.qv-btn{width:100%}}
      \`}</style>
      <nav className="qv-nav"><div className="qv-logo">${escapeHtml(brand)}</div><div className="qv-pill">${escapeHtml(label)} · ${escapeHtml(style.layout)}</div></nav>
      <section className="qv-hero">
        <div className="qv-card"><strong style={{color:'${p.a}'}}>${escapeHtml(c.readyBadge)}</strong><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><div className="qv-actions"><button className="qv-btn qv-primary">${escapeHtml(cta)}</button><button className="qv-btn qv-ghost">${escapeHtml(secondary)}</button></div></div>
        <aside className="qv-panel"><h2>${escapeHtml(c.overview)}</h2><div className="qv-metric"><b>${escapeHtml(c.template)}</b><span>${escapeHtml(label)}</span></div><div className="qv-metric"><b>${escapeHtml(c.style)}</b><span>${escapeHtml(style.palette.name)}</span></div><div className="qv-metric"><b>${escapeHtml(c.run)}</b><span>HTML / JSX / ZIP / PDF</span></div></aside>
      </section>
      <section className="qv-grid">{items.map((item, index) => <article className="qv-item" key={item.title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</section>
    </main>
  );
}`;
  const rawText = `${c.rawUsed}: ${label}.\n${c.rawCustomized}`;
  return { rawText, html, jsx, template, variant: style.palette.name, outputLanguage: outputLang };
}


function agentToolInstruction(language: string) {
  const outputLang = detectRequestedLanguage('', language);
  const ar = outputLang === 'ar' || outputLang === 'ar-EG';
  return ar
    ? [
      'أدوات Agent الجاهزة لتوفير الكريدت:',
      '- Project Builder: لو الطلب موقع أو تطبيق، ابنِ JSX واحد export default App وقابل للتشغيل على Vite.',
      '- Local Preview: لو فيه JSX، اجعله بدون import خارجي قدر الإمكان عشان المعاينة المحلية تشتغل.',
      '- Download Ready: اكتب الكود كملف واحد منظم، واستعمل بيانات mock و localStorage بدل backend غير مطلوب.',
      '- PDF Tool: لو الطلب مستند أو تقرير، أضف print styles واضحة داخل HTML/CSS.',
      '- Export Tool: جهّز الناتج عشان يتحمّل كـ HTML/JSX/ZIP، واكتب أسماء ملفات منطقية.',
      '- Asset Tool: لو المستخدم رفع صور أو SVG، استخدم أسماء الملفات كأصول محلية بدل تجاهلها.',
      '- Offline Tool: أي مشروع ناتج لازم يشتغل ببيانات mock و localStorage بدون سيرفر إلا لو المستخدم طلب Backend صراحة.',
      '- README Tool: اكتب خطوات تشغيل قصيرة وواقعية.',
      '- Office Tool: ادعم Word وExcel وPowerPoint وCSV وPDF. لو الطلب مستند/جدول/عرض، جهّز هيكل قابل للتصدير Office مع عناوين وجداول وسلايدات وملاحظات.',
      '- Qalvero Code Tool: وفّر تجربة شبيهة بمساعدات الكود المتقدمة بهوية Qalvero AI: تحليل مشروع، خطة تعديل، diff/patch واضح، أوامر terminal آمنة، اختبارات، rollback، وتوثيق.',
      '- Game Dev Tool: ادعم ألعاب 2D حقيقية شغالة محليًا بمحرك Canvas جاهز: Snake, Pong, Breakout, Flappy, Dodge, Space Shooter, Clicker, Memory, Tic Tac Toe. استخدم القالب الجاهز أولًا لتوفير الكريدت ثم عدّل الشكل والنصوص حسب الطلب.',
      '- Cross Platform Tool: لو المستخدم طلب نسخة تتحمل، جهّز المشروع كـ PWA للموبايل، ومع ملاحظات Tauri/Electron للكمبيوتر وWindows/Linux/macOS بدون كسر نسخة الويب.',
      '- SDK/JDK APK Tool: لو المستخدم طلب APK أو Android، جهّز مشروع Capacitor Android حقيقي: package scripts، capacitor.config.ts، تعليمات JDK 17، Android SDK، Android Studio، Gradle، ومسار إخراج APK. لا تدّعي أن المتصفح يبني APK مباشرة؛ جهّز مشروع وCI يقدر يبنيه.',
      `- MCP Tool: ادعم MCP الحقيقي بشكل صارم: أدوات tools/list وtools/call، موارد resources/list وresources/read، prompts/list وprompts/get، JSON-RPC endpoint، Remote MCP allowlist فقط، بدون STDIO أو أوامر محلية من الشات، وبدون كشف مفاتيح. الأدوات المحلية المتاحة: ${qloMcpTools.map((t) => t.name).join(', ')}.`,
      '- Safe Customization Tool: غيّر الاسم واللون والنصوص والبيانات فقط عبر متغيرات/arrays واضحة. لا تزيل وظائف اللعبة أو handlers أو التخزين المحلي أو build scripts لمجرد تعديل الشكل.',
      '- Credit Saver: استخدم أنماط تنفيذ Qalvero الداخلية أولًا بدون ذكر كلمة قالب للمستخدم، ثم عدّل الاسم واللغة والهوية والألوان والأقسام والنصوص حسب طلب المستخدم. لو مفيش نمط مناسب، ابنِ المطلوب عادي بالـAI.',
      '- Tool Hub: عند أي طلب برمجة/ملفات/Office/APK/نشر/قواعد بيانات/تصميم/تدريب، اختَر الأداة الداخلية المناسبة من Qalvero Tool Hub تلقائيًا قبل تشغيل AI ثقيل: code.patch, code.tests, github.workflow, apk.cloudbuild, office.export.manifest, file.convert, file.analyze, database.schema, supabase.rls, design.theme, deploy.check, training.dataset.clean, training.export.plan, build.env.check.',
      '- Real Tool Rule: الأدوات لازم ترجع manifest أو YAML أو SQL أو خطة تشغيل قابلة للتطبيق، مش كلام عام. لو الأداة تحتاج GitHub/Google Cloud/Supabase secrets، وضّح الإعدادات المطلوبة بدون كشف أسرار.',
      '- Quality Tool: راجع responsive، accessibility labels، empty states، error states، ولا تترك placeholders سخيفة.'
    ].join('\n')
    : [
      'Ready Agent tools for credit saving:',
      '- Project Builder: for sites/apps, produce one JSX file with export default App and Vite-compatible code.',
      '- Local Preview: avoid external imports when possible so the built-in preview can run.',
      '- Download Ready: keep code organized as a single file, with mock data and localStorage instead of unnecessary backend.',
      '- PDF Tool: for reports/documents, include clear print styles in HTML/CSS.',
      '- Export Tool: prepare output for HTML/JSX/ZIP download with sensible file names.',
      '- Asset Tool: if the user uploads images or SVG, use file names as local assets instead of ignoring them.',
      '- Offline Tool: generated projects must run with mock data and localStorage without a server unless backend is explicitly requested.',
      '- README Tool: include short realistic run steps.',
      '- Office Tool: support Word, Excel, PowerPoint, CSV, and PDF-ready outputs. For document/sheet/deck requests, prepare Office-exportable structure with headings, tables, slides, and notes.',
      '- Qalvero Code Tool: provide advanced code-assistant behavior under Qalvero AI identity: repo analysis, edit plan, clear diff/patch, safe terminal commands, tests, rollback notes, and documentation.',
      '- Game Dev Tool: support real playable local 2D games with a Canvas engine: Snake, Pong, Breakout, Flappy, Dodge, Space Shooter, Clicker, Memory, and Tic Tac Toe. Use internal implementation patterns first to save credits without mentioning templates to the user, then customize style and copy from the request.',
      '- Cross Platform Tool: when the user asks for downloadable apps, prepare the project as a mobile PWA plus Tauri/Electron notes for desktop, Windows, Linux, and macOS without breaking the web build.',
      '- SDK/JDK APK Tool: when the user asks for APK or Android, prepare a real Capacitor Android project path: package scripts, capacitor.config.ts, JDK 17 notes, Android SDK, Android Studio, Gradle, and APK output path. Do not claim the browser builds the APK directly; generate a project and CI workflow that can build it.',
      `- MCP Tool: support strict real MCP: tools/list, tools/call, resources/list, resources/read, prompts/list, prompts/get, JSON-RPC endpoint, remote MCP allowlist only, no chat-triggered STDIO/local commands, and no secret exposure. Local tools available: ${qloMcpTools.map((t) => t.name).join(', ')}.`,
      '- Safe Customization Tool: change names, colors, copy, and mock data through clear variables/arrays only. Do not remove game logic, handlers, localStorage, or build scripts just to change the look.',
      '- Credit Saver: use Qalvero internal implementation patterns first without mentioning templates to the user, then customize name, language, identity, colors, sections, and copy from the request. If no internal pattern fits, build normally with AI.',
      '- Tool Hub: for coding/files/Office/APK/deploy/database/design/training requests, select the right internal Qalvero Tool Hub capability before using heavy AI: code.patch, code.tests, github.workflow, apk.cloudbuild, office.export.manifest, file.convert, file.analyze, database.schema, supabase.rls, design.theme, deploy.check, training.dataset.clean, training.export.plan, build.env.check.',
      '- Real Tool Rule: tools must return a usable manifest, YAML, SQL, export map, or actionable build plan, not vague advice. If a tool requires GitHub/Google Cloud/Supabase secrets, state required setup without exposing secrets.',
      '- Quality Tool: check responsive behavior, accessibility labels, empty states, error states, and avoid lazy placeholders.'
    ].join('\n');
}

function fileContext(files: WorkspaceFile[]) {
  const safeFiles = Array.isArray(files) ? files.slice(0, 8) : [];
  return safeFiles.map((file, index) => {
    const header = `FILE ${index + 1}: ${file.name} | ${file.kind} | ${file.type || 'unknown'} | ${file.size} bytes`;
    if (file.kind === 'text') return `${header}\n${String(file.content || '').slice(0, 12000)}`;
    if (file.kind === 'image') return `${header}\nImage asset is attached locally. Use it as an asset reference if building HTML, but do not claim visual analysis unless content is described by the user.`;
    return `${header}\nBinary file attached locally. Use filename and metadata only.`;
  }).join('\n\n---\n\n');
}

function systemPrompt(language: string, plan: UserPlan) {
  const outputLang = detectRequestedLanguage('', language);
  const arabic = outputLang === 'ar' || outputLang === 'ar-EG';
  return [
    'You are QLO Agents inside Qalvero AI.',
    'Identity rules: QLO is Qalvero AI’s branded AI experience, not a fully trained model from scratch. It is powered by advanced AI providers and smart backend routing. Never mention provider names, internal routing, API keys, or hidden infrastructure to users.',
    'Model-name language rule: Always write QLO product and model names in English exactly, in every language. Use only: QLO, Qalvero AI, QLO 1.2 Flash, QLO 1.2 Study, QLO 1.2 Pro, QLO 1.3 Flash, QLO 1.3 Pro, and QLO 1.3 Agent. Never translate, transliterate, localize, spell phonetically, or rewrite these names in Arabic or any other script.',
    'Company: Qalvero AI helps users write, code, summarize, brainstorm, solve problems, and complete digital tasks through a clean AI chat experience.',
    'Founder: Ahmed Ashraf Hamza Mohamed, founder of Qalvero AI, focused on building modern digital products, AI platforms, websites, and mobile apps.',
    'Tone: modern, professional, trustworthy, premium startup style. Do not exaggerate. Do not claim funding, employees, awards, custom training, or provider ownership.',
    'Single-answer rule: Return one organized Qalvero AI Agent result only. Do not output multiple provider answers, do not duplicate the same solution, and do not mention internal model routing.',
    'Credit-saving rule: Prefer Qalvero internal implementation patterns, compact project plans, and focused outputs. Do not tell the user that an internal pattern or template was used. Use AI generation only when no internal pattern fits or when the user explicitly requests a custom build. Expand only when the user requests full code, full Office pack, ZIP/APK-ready project, or detailed documentation.',
    'Qalvero Code behavior: emulate professional code-agent workflows using Qalvero AI identity only: understand files, propose edits, generate patches, create runnable projects, include tests, explain commands, support Office exports, and prepare mobile/desktop/Linux/APK packaging. For APK requests, generate a web-first Capacitor Android project path with JDK 17, Android SDK, Gradle, Android Studio, and GitHub Actions APK build instructions. Do not claim to produce a signed production APK inside the browser; produce an APK-ready project and build workflow. Do not claim to be Claude Code or copy competitor branding.',
    `MCP behavior: Qalvero supports a strict MCP-compatible layer and Qalvero Tool Hub. When the user asks for tools, code automation, GitHub, Office, APK, file conversion, database, design, deploy, or training workflows, use tool-first reasoning and produce strict manifests. Do not suggest arbitrary STDIO execution from user input. Local MCP tool count: ${qloMcpTools.length}; resources: ${qloMcpResources.length}; prompts: ${qloMcpPrompts.length}.`,
    `User plan: ${plan}.`,
    arabic ? 'اكتب بالعربي المناسب للطلب: فصحى واضحة للبحث/التعليم/المستندات، وعامية مصرية طبيعية للشات والواجهات اليومية. خلّي النبرة احترافية حديثة.' : `Use the requested output language (${outputLang}) across UI copy, PDFs, HTML, JSX text, README, and export labels unless the user explicitly asks otherwise.`,
    'Return practical output that can be used directly. Avoid vague filler.'
  ].join('\n');
}

function canonicalizeQloNames(value: string) {
  return String(value || '')
    .replace(/كيو\s*[-–— ]*\s*(?:إل|ال|ل)\s*[-–— ]*\s*(?:أو|او|و)/g, 'QLO')
    .replace(/كيو\s*لو/g, 'QLO')
    .replace(/QLO\s*١\s*[\.,]\s*٢/g, 'QLO 1.2')
    .replace(/QLO\s*١\s*[\.,]\s*٣/g, 'QLO 1.3')
    .replace(/QLO\s*1\s*,\s*2/g, 'QLO 1.2')
    .replace(/QLO\s*1\s*,\s*3/g, 'QLO 1.3');
}

function agentPrompt(agent: AgentId, userPrompt: string, files: WorkspaceFile[], language: string) {
  const filesBlock = fileContext(files);
  const template = detectTemplate(userPrompt);
  const outputLang = detectRequestedLanguage(userPrompt, language);
  const arabic = outputLang === 'ar' || outputLang === 'ar-EG';
  const common = `USER REQUEST:
${userPrompt}

REQUESTED OUTPUT LANGUAGE: ${outputLang}

CREDIT SAVER TEMPLATE:
${templateInstruction(template, language)}

${agentToolInstruction(language)}

ATTACHED FILES:
${filesBlock || 'No files attached.'}`;
  const map: Record<AgentId, string> = {
    architect: arabic
      ? `أنت المهندس. صمم بنية المشروع والصفحات والمكونات وتدفق البيانات وخطة التنفيذ. اجعل الكلام محدد وقابل للتنفيذ.\n\n${common}`
      : `You are the Architect. Design the project structure, pages, components, data flow, and execution plan. Be specific and implementation-ready.\n\n${common}`,
    developer: arabic
      ? `أنت المطور. اكتب كود جاهز. لو الطلب موقع/واجهة، رجّع ملف React JSX واحد داخل code block باسم jsx، وضمّن أيضًا HTML preview كامل يبدأ بـ <!doctype html>. ركز على تنفيذ عملي وقابل للتشغيل محليًا.\n\n${common}`
      : `You are the Developer. Write ready-to-use code. For websites/UIs, return one single-file React JSX component inside a jsx code block, and also include a full HTML preview starting with <!doctype html>. Focus on practical local execution.\n\n${common}`,
    analyst: arabic
      ? `أنت المحلل. حلل المتطلبات، المشاكل، المخاطر، النواقص، افتراضات التنفيذ، واختبارات الجودة المطلوبة.\n\n${common}`
      : `You are the Analyst. Analyze requirements, issues, risks, missing details, assumptions, and quality checks.\n\n${common}`,
    writer: arabic
      ? `أنت الكاتب. اكتب README وتوثيق مختصر وطريقة تشغيل واستخدام واضحة للمشروع الناتج.\n\n${common}`
      : `You are the Writer. Create a clear README, concise documentation, setup notes, and usage instructions for the generated project.\n\n${common}`
  };
  return map[agent];
}


function combinedAgentPrompt(userPrompt: string, files: WorkspaceFile[], language: string) {
  const filesBlock = fileContext(files);
  const template = detectTemplate(userPrompt);
  const outputLang = detectRequestedLanguage(userPrompt, language);
  const arabic = outputLang === 'ar' || outputLang === 'ar-EG';
  return arabic
    ? `شغّل QLO 1.3 Agent بوضع توفير الكريدت. نفّذ الأربع أدوار في رد واحد منظم بعناوين واضحة:

## المهندس
## المطور
## المحلل
## الكاتب

لا تضيع كريدت في كلام عام. ${templateInstruction(template, language)}
لغة الناتج المطلوبة: ${outputLang}

${agentToolInstruction(language)}

مطلوب من المطور: لو الطلب واجهة أو موقع، رجّع ملف React JSX واحد داخل code block يبدأ بـ \`\`\`jsx، وHTML preview كامل يبدأ بـ <!doctype html> داخل code block.

USER REQUEST:
${userPrompt}

ATTACHED FILES:
${filesBlock || 'No files attached.'}`
    : `Run QLO 1.3 Agent in credit-saving mode. Execute all four roles in one organized answer with clear headings:

## Architect
## Developer
## Analyst
## Writer

Avoid filler. ${templateInstruction(template, language)}
Requested output language: ${outputLang}

${agentToolInstruction(language)}

Developer requirement: if the request is a UI or website, return one single-file React JSX component inside a \`\`\`jsx code block, and a complete HTML preview starting with <!doctype html> inside a code block.

USER REQUEST:
${userPrompt}

ATTACHED FILES:
${filesBlock || 'No files attached.'}`;
}


function latestUserText(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === 'user')?.content || '';
}

function agentTokenBudget(messages: ChatMessage[]) {
  const text = latestUserText(messages);
  if (/office|word|excel|powerpoint|docx|xlsx|pptx|zip|jsx|html|مشروع كامل|كود كامل|حزمة|اوفيس|أوفيس|وورد|اكسل|بوربوينت|تحميل|تغليف|desktop|linux|windows|pwa/i.test(text)) return 3600;
  if (/full|complete|detailed|بالتفصيل|تفصيلي|كامل|كل الملفات/i.test(text)) return 3200;
  return 2200;
}

async function callGemini(key: string, messages: ChatMessage[], model: string, maxOutputTokens = 2400) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const body = messages.filter((m) => m.role !== 'system').map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `${system}\n\n${body}` }] }], generationConfig: { temperature: 0.42, topP: 0.86, maxOutputTokens } }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'QLO provider failed');
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  if (!text) throw new Error('QLO returned an empty response');
  return text;
}

async function callOpenAICompatible(endpoint: string, key: string, model: string, messages: ChatMessage[], extraHeaders: Record<string, string> = {}, maxTokens = 2400) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders }, body: JSON.stringify({ model, messages, temperature: 0.42, max_tokens: maxTokens }) });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || data?.message || 'QLO provider failed');
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('QLO returned an empty response');
  return text;
}

async function callCloudflare(model: string, messages: ChatMessage[]) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_WORKERS_AI_TOKEN;
  if (!accountId || !token) throw new Error('QLO cloud route is not configured');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages }) });
  const data = await r.json();
  if (!r.ok || data?.success === false) throw new Error(data?.errors?.[0]?.message || 'QLO provider failed');
  const text = data?.result?.response || data?.result?.text || data?.response || '';
  if (!text) throw new Error('QLO returned an empty response');
  return text;
}


const USER_AI_PROVIDERS = new Set(['gemini', 'openrouter', 'groq', 'deepseek']);
function canUsePersonalAgentKey(plan: UserPlan) { return ['Standard', 'Premium', 'Max'].includes(plan); }
function sanitizeUserAiConfig(input: any, plan: UserPlan): UserAiConfig | null {
  if (!input?.enabled) return null;
  if (process.env.QLO_USER_API_KEYS_ENABLED === 'false') throw new Error('Personal AI keys are disabled on this deployment.');
  if (!canUsePersonalAgentKey(plan)) throw new Error('Personal AI keys require a signed-in Standard, Premium, or Max account.');
  const provider = String(input.provider || '').toLowerCase() as UserAiProvider;
  if (!USER_AI_PROVIDERS.has(provider)) throw new Error('Unsupported personal AI provider.');
  const apiKey = String(input.apiKey || '').trim();
  if (apiKey.length < 12 || apiKey.length > 600) throw new Error('Invalid personal AI key.');
  const model = String(input.model || '').trim();
  if (model && !/^[A-Za-z0-9._:/@+\-]{2,90}$/.test(model)) throw new Error('Invalid personal AI model name.');
  return { enabled: true, provider, apiKey, model };
}
function defaultUserAiModel(provider: UserAiProvider) {
  if (provider === 'gemini') return process.env.USER_GEMINI_AGENT_MODEL || 'gemini-2.5-flash';
  if (provider === 'openrouter') return process.env.USER_OPENROUTER_AGENT_MODEL || 'openrouter/auto';
  if (provider === 'groq') return process.env.USER_GROQ_AGENT_MODEL || 'llama-3.3-70b-versatile';
  return process.env.USER_DEEPSEEK_AGENT_MODEL || 'deepseek-chat';
}
async function callUserAiProvider(config: UserAiConfig, messages: ChatMessage[], maxTokens: number) {
  const provider = config.provider as UserAiProvider;
  const model = (config.model || defaultUserAiModel(provider)).trim();
  if (provider === 'gemini') return callGemini(config.apiKey!, messages, model, maxTokens);
  if (provider === 'openrouter') return callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', config.apiKey!, model, messages, { 'HTTP-Referer': process.env.PUBLIC_SITE_URL || 'https://qalvero.com', 'X-Title': 'Qalvero AI Personal Agent Key' }, maxTokens);
  if (provider === 'groq') return callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', config.apiKey!, model, messages, {}, maxTokens);
  if (provider === 'deepseek') return callOpenAICompatible('https://api.deepseek.com/chat/completions', config.apiKey!, model, messages, {}, maxTokens);
  throw new Error('Unsupported personal AI provider.');
}

const dedupe = (items: string[]) => [...new Set(items.map((v) => v.trim()).filter(Boolean))];
const csv = (value?: string) => value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];
function envAny(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}
function envList(names: string[], fallback: string[] = []) {
  const values: string[] = [];
  for (const name of names) {
    const raw = process.env[name];
    if (raw) values.push(...csv(raw));
  }
  values.push(...fallback);
  return dedupe(values);
}

async function runMessages(messages: ChatMessage[], userAi?: UserAiConfig | null) {
  const dedicatedKey = envAny('QLO_AGENTS_API_KEY', 'AGENTS_API_KEY');
  const dedicatedProvider = (process.env.QLO_AGENTS_PROVIDER || process.env.AGENTS_PROVIDER || 'gemini').toLowerCase();
  const geminiKey = envAny('AGENTS_GEMINI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY');
  const openrouterKey = envAny('AGENTS_OPENROUTER_API_KEY', 'OPENROUTER_API_KEY');
  const groqKey = envAny('AGENTS_GROQ_API_KEY', 'GROQ_API_KEY');
  const deepseekKey = envAny('AGENTS_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY');
  const cfModel = process.env.CLOUDFLARE_AGENT_MODEL || process.env.CLOUDFLARE_PRO_MODEL || '';
  const agentGeminiModels = envList(['QLO_AGENTS_MODEL', 'GEMINI_AGENT_MODEL', 'GEMINI_PRO_MODEL', 'GEMINI_FLASH_MODEL', 'GEMINI_MODEL', 'GOOGLE_GENERATIVE_AI_MODEL'], ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash']);
  const agentGroqModels = envList(['QLO_AGENTS_MODEL', 'GROQ_AGENT_MODEL', 'GROQ_DEEPSEEK_MODEL', 'GROQ_PRO_MODEL', 'GROQ_MODEL'], ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'deepseek-r1-distill-llama-70b']);
  const maxTokens = agentTokenBudget(messages);
  const attempts: Array<() => Promise<string>> = [];
  if (userAi?.enabled) attempts.push(() => callUserAiProvider(userAi, messages, maxTokens));
  if (dedicatedKey && dedicatedProvider === 'gemini') agentGeminiModels.forEach((m) => attempts.push(() => callGemini(dedicatedKey, messages, m, maxTokens)));
  if (dedicatedKey && dedicatedProvider === 'openrouter') attempts.push(() => callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', dedicatedKey, process.env.QLO_AGENTS_MODEL || 'deepseek/deepseek-chat', messages, { 'HTTP-Referer': process.env.PUBLIC_SITE_URL || 'https://qalvero.com', 'X-Title': 'Qalvero AI Agents' }, maxTokens));
  if (dedicatedKey && dedicatedProvider === 'groq') agentGroqModels.forEach((m) => attempts.push(() => callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', dedicatedKey, m, messages, {}, maxTokens)));
  if (dedicatedKey && dedicatedProvider === 'deepseek') attempts.push(() => callOpenAICompatible('https://api.deepseek.com/chat/completions', dedicatedKey, process.env.QLO_AGENTS_MODEL || 'deepseek-chat', messages, {}, maxTokens));
  // If the independent agent key is not set, fall back to the normal configured AI keys so the Agent does not appear broken.
  if (geminiKey) agentGeminiModels.forEach((m) => attempts.push(() => callGemini(geminiKey, messages, m, maxTokens)));
  if (openrouterKey) attempts.push(() => callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', openrouterKey, process.env.OPENROUTER_AGENT_MODEL || process.env.OPENROUTER_PRO_MODEL || 'deepseek/deepseek-chat', messages, { 'HTTP-Referer': process.env.PUBLIC_SITE_URL || 'https://qalvero.com', 'X-Title': 'Qalvero AI' }, maxTokens));
  if (groqKey) agentGroqModels.forEach((m) => attempts.push(() => callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', groqKey, m, messages, {}, maxTokens)));
  if (deepseekKey) attempts.push(() => callOpenAICompatible('https://api.deepseek.com/chat/completions', deepseekKey, process.env.DEEPSEEK_AGENT_MODEL || process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat', messages, {}, maxTokens));
  if (cfModel) attempts.push(() => callCloudflare(cfModel, messages));
  const errors: string[] = [];
  for (const attempt of attempts) {
    try { return await attempt(); }
    catch (err: any) { errors.push(err?.message || 'route failed'); }
  }
  throw new Error(errors.slice(-3).join(' | ') || 'QLO Agents are not configured on the server');
}

async function runOneAgent(agent: AgentId, prompt: string, files: WorkspaceFile[], language: string, plan: UserPlan, userAi?: UserAiConfig | null) {
  return runMessages([
    { role: 'system', content: systemPrompt(language, plan) },
    { role: 'user', content: agentPrompt(agent, prompt, files, language) }
  ], userAi);
}

async function runCombinedAgent(prompt: string, files: WorkspaceFile[], language: string, plan: UserPlan, userAi?: UserAiConfig | null) {
  return runMessages([
    { role: 'system', content: systemPrompt(language, plan) },
    { role: 'user', content: combinedAgentPrompt(prompt, files, language) }
  ], userAi);
}

function extractHtml(text: string) {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?<!doctype html[\s\S]*?)```/i) || text.match(/```(?:html)?\s*([\s\S]*?<html[\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const raw = text.match(/(<!doctype html[\s\S]*)/i) || text.match(/(<html[\s\S]*)/i);
  if (raw?.[1]) return raw[1].trim();
  return '';
}

function extractJsx(text: string) {
  const fenced = text.match(/```(?:jsx|tsx|javascript|react)\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return '';
}

function normalizePreviewJsx(jsx: string) {
  let code = String(jsx || '');
  // Browser preview runs through Babel in a script tag, so ES module imports/exports break it.
  // Keep downloaded JSX as-is, but normalize only the preview copy.
  code = code.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
  code = code.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/, 'function $1');
  code = code.replace(/export\s+default\s+function\s*\(/, 'function App(');
  code = code.replace(/export\s+default\s+([A-Za-z0-9_]+)\s*;?/g, '');
  code = code.replace(/export\s+\{[^}]+\}\s*;?/g, '');
  if (!/function\s+App\s*\(|const\s+App\s*=|class\s+App\s+extends/.test(code)) {
    const match = code.match(/function\s+([A-Za-z0-9_]+)\s*\(/) || code.match(/const\s+([A-Za-z0-9_]+)\s*=/);
    if (match?.[1]) code += `\nconst App = ${match[1]};`;
  }
  return code;
}

function buildJsxPreviewHtml(jsx: string, title = 'Qalvero Agent JSX Preview') {
  const safe = normalizePreviewJsx(jsx).replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(title)}</title><script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>body{margin:0;background:#070914;color:white;font-family:Inter,Arial,sans-serif}.qv-root{min-height:100vh}.qv-error{padding:28px;line-height:1.7}</style></head><body><div id="root" class="qv-root"></div><script type="text/babel">try {\n${safe}\nconst RootComponent = typeof App !== 'undefined' ? App : (typeof QalveroAgentApp !== 'undefined' ? QalveroAgentApp : null);\nif (RootComponent) ReactDOM.createRoot(document.getElementById('root')).render(<RootComponent />); else document.getElementById('root').innerHTML = '<main class="qv-error"><h1>JSX loaded</h1><p>Define a component named App for automatic preview.</p></main>';\n} catch (error) { document.getElementById('root').innerHTML = '<main class="qv-error"><h1>Preview error</h1><p>'+String(error.message || error)+'</p></main>'; }</script></body></html>`;
}



function isApkRequest(prompt: string) {
  return /apk|android|android sdk|jdk|gradle|capacitor|اندرويد|أندرويد|تصدير apk|ملف apk|جافا sdk|android studio/i.test(String(prompt || ''));
}

function buildPreviewHtml(result: Record<AgentId, string>, prompt: string) {
  const escape = (v: string) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Qalvero Agents Output</title><style>body{margin:0;font-family:Inter,Arial,sans-serif;background:#070914;color:#f8fafc;padding:32px}main{max-width:1080px;margin:auto}.hero{padding:32px;border-radius:28px;background:linear-gradient(135deg,rgba(255,138,61,.18),rgba(255,77,141,.14));border:1px solid rgba(255,255,255,.12)}section{margin-top:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);border-radius:24px;padding:22px}pre{white-space:pre-wrap;line-height:1.7;color:#cbd5e1}h1{font-size:42px;margin:0 0 12px}h2{margin:0 0 12px;color:#fff}</style></head><body><main><div class="hero"><h1>Qalvero Agents Project</h1><p>${escape(prompt)}</p></div>${(['architect','developer','analyst','writer'] as AgentId[]).map((id) => `<section><h2>${agentNames[id].en}</h2><pre>${escape(result[id])}</pre></section>`).join('')}</main></body></html>`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rate = await checkApiRateLimit(req, 'qlo-agent', Number(process.env.QLO_AGENT_RATE_LIMIT_PER_MINUTE || 12), 60);
  if (!rate.ok) return res.status(429).json({ error: 'Too many Agent requests. Wait a moment and try again.', retry_after: rate.retryAfter, limit: rate.limit });
  try {
    const { prompt = '', files = [], language = 'en', creditMode = 'smart', userAi: rawUserAi } = req.body || {};
    const cleanPrompt = String(prompt).trim();
    if (!cleanPrompt) return res.status(400).json({ error: language === 'ar' ? 'اكتب الطلب الأول.' : 'Prompt required.' });
    if (cleanPrompt.length > Number(process.env.AGENT_MAX_PROMPT_CHARS || 9000)) return res.status(413).json({ error: language === 'ar' ? 'الطلب طويل جدًا.' : 'Prompt too long.' });
    const plan = await getUserPlan(req);
    let userAi: UserAiConfig | null = null;
    try { userAi = sanitizeUserAiConfig(rawUserAi, plan); }
    catch (err: any) { return res.status(403).json({ error: err.message || 'Personal AI key is not allowed.' }); }
    const safeFiles = Array.isArray(files) ? files.slice(0, 8).map((file: any) => ({
      name: String(file.name || 'file').slice(0, 120),
      type: String(file.type || ''),
      size: Number(file.size || 0),
      kind: ['text', 'image', 'binary'].includes(file.kind) ? file.kind : 'binary',
      content: file.kind === 'text' ? String(file.content || '').slice(0, 60000) : undefined,
      dataUrl: file.kind === 'image' ? String(file.dataUrl || '').slice(0, 200000) : undefined
    })) as WorkspaceFile[] : [];

    // Zero/low-credit path: if the request matches a Qalvero internal implementation pattern,
    // return a customized local result immediately without spending an AI call.
    // If no pattern fits, the normal Agent route below builds it with the AI provider.
    if (creditMode !== 'full' && shouldUseLocalTemplate(cleanPrompt, safeFiles)) {
      const local = buildLocalTemplate(cleanPrompt, language);
      if (local) {
        const cleanRaw = canonicalizeQloNames(local.rawText);
        const cleanHtml = canonicalizeQloNames(local.html);
        const cleanJsx = canonicalizeQloNames(local.jsx);
        await logUsageEvent(req, { kind: 'agent', route: 'internal-pattern', model: 'QLO 1.3 Agent', plan, charged: false, optimized: true, promptChars: cleanPrompt.length, responseChars: cleanRaw.length, promptTokens: estimateTokens(cleanPrompt), responseTokens: estimateTokens(cleanRaw), status: 'ok', meta: { variant: local.variant, files: safeFiles.length } });
        return res.status(200).json({
          result: { architect: cleanRaw, developer: cleanRaw, analyst: cleanRaw, writer: cleanRaw },
          rawText: cleanRaw,
          html: cleanHtml,
          jsx: cleanJsx,
          plan,
          creditMode: 'smart',
          variant: local.variant,
          packageHint: isApkRequest(cleanPrompt) ? 'apk-ready' : undefined
        });
      }
    }

    let result: Record<AgentId, string>;
    let rawText = '';
    const useFullParallel = creditMode === 'full' && plan === 'Max' && process.env.QLO_AGENT_ALLOW_PARALLEL === 'true';

    if (useFullParallel) {
      const [architect, developer, analyst, writer] = await Promise.all([
        runOneAgent('architect', cleanPrompt, safeFiles, language, plan, userAi),
        runOneAgent('developer', cleanPrompt, safeFiles, language, plan, userAi),
        runOneAgent('analyst', cleanPrompt, safeFiles, language, plan, userAi),
        runOneAgent('writer', cleanPrompt, safeFiles, language, plan, userAi)
      ]);
      result = {
        architect: canonicalizeQloNames(architect),
        developer: canonicalizeQloNames(developer),
        analyst: canonicalizeQloNames(analyst),
        writer: canonicalizeQloNames(writer)
      };
      rawText = (['architect', 'developer', 'analyst', 'writer'] as AgentId[])
        .map((id) => `## ${agentNames[id][language === 'ar' ? 'ar' : 'en']}\n\n${result[id]}`)
        .join('\n\n---\n\n');
    } else {
      const combined = await runCombinedAgent(cleanPrompt, safeFiles, language, plan, userAi);
      const cleanCombined = canonicalizeQloNames(combined);
      result = { architect: cleanCombined, developer: cleanCombined, analyst: cleanCombined, writer: cleanCombined };
      rawText = cleanCombined;
    }

    const developerText = result.developer || rawText;
    const jsx = extractJsx(developerText) || extractJsx(rawText);
    const html = extractHtml(developerText) || extractHtml(rawText) || (jsx ? buildJsxPreviewHtml(jsx) : buildPreviewHtml(result, cleanPrompt));
    await logUsageEvent(req, { kind: 'agent', route: useFullParallel ? 'full-parallel' : 'combined-agent', model: 'QLO 1.3 Agent', plan, charged: true, optimized: !useFullParallel, promptChars: cleanPrompt.length, responseChars: rawText.length, promptTokens: estimateTokens(cleanPrompt), responseTokens: estimateTokens(rawText), status: 'ok', meta: { files: safeFiles.length, apk: isApkRequest(cleanPrompt), byok: Boolean(userAi?.enabled) } });
    return res.status(200).json({ result, rawText: canonicalizeQloNames(rawText), html: canonicalizeQloNames(html), jsx: canonicalizeQloNames(jsx), plan, creditMode: useFullParallel ? 'full' : 'smart', packageHint: isApkRequest(cleanPrompt) ? 'apk-ready' : undefined });
  } catch (err: any) {
    await logApiError(req, { scope: 'qlo-agent', code: 'agent_failed', message: err?.message || 'QLO Agents failed', severity: 'medium', sample: String(req.body?.prompt || '').slice(0, 500) });
    return res.status(500).json({ error: process.env.QLO_DEBUG === 'true' ? (err?.message || 'QLO Agents failed') : 'QLO Agents connection failed. Check server AI keys and try again.' });
  }
}
