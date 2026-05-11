import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Bot, Brain, BookOpenCheck, Code2, Copy, Download, ExternalLink, FileCode2, FileText, Globe2, GraduationCap, Lightbulb, Loader2, PackageCheck, Paperclip, Play, Printer, Search, Send, Sparkles, SlidersHorizontal, ThumbsDown, ThumbsUp, X, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { labels } from '../lib/i18n';
import { getAccessToken } from '../lib/supabase';

type WebSource = { title: string; url: string; snippet: string; domain: string; weight?: number };
type Msg = { role: 'user' | 'assistant'; content: string; sources?: WebSource[] };
type ChatAttachment = { name: string; type: string; size: number; kind: 'text' | 'image' | 'binary'; content: string; dataUrl?: string };
type ChatThread = { id: string; title: string; messages: Msg[]; createdAt: string; updatedAt?: string; model?: string; mode?: string; storagePolicy?: 'local-first' | 'cloud-compact' };
type AgentOutput = { rawText: string; html: string; jsx?: string; plan?: string; creditMode?: string; packageHint?: string; type?: 'agent' | 'research'; fileBase?: string } | null;
type AutoRoute = 'agent' | 'research' | 'study' | 'pro' | 'chat';
type WorkingState = 'idle' | 'web' | 'agent' | 'research' | 'study' | 'pro' | 'chat' | 'reading';

type ModelOption = { id: string; name: string; badge: '1.2' | '1.3'; desc: { en: string; ar: string }; tone: 'flash' | 'study' | 'pro' | 'agent' };

const modes = [
  { id: 'Auto', label: { en: 'Auto', ar: 'تلقائي' } },
  { id: 'Study coach', label: { en: 'Study', ar: 'مذاكرة' } },
  { id: 'Writing studio', label: { en: 'Writing', ar: 'كتابة' } },
  { id: 'Business planner', label: { en: 'Ideas', ar: 'أفكار' } },
  { id: 'Reasoning', label: { en: 'Reasoning', ar: 'تحليل' } }
];

const agentQuickTemplates = [
  { ar: 'متجر إلكتروني', en: 'E-commerce', promptAr: 'اعمل متجر إلكتروني باسم "Nova Store" بتصميم عصري وألوان مميزة.', promptEn: 'Build an e-commerce store called "Nova Store" with a modern distinctive design.' },
  { ar: 'صفحة هبوط', en: 'Landing', promptAr: 'اعمل صفحة هبوط SaaS باسم "Qalvero Flow" مع أسعار ومميزات.', promptEn: 'Build a SaaS landing page called "Qalvero Flow" with pricing and features.' },
  { ar: 'داشبورد', en: 'Dashboard', promptAr: 'اعمل Dashboard لإدارة المبيعات مع كروت إحصائيات وجدول.', promptEn: 'Build a sales dashboard with metric cards and a table.' },
  { ar: 'مطعم', en: 'Restaurant', promptAr: 'اعمل موقع مطعم باسم "Mazo Cafe" مع منيو وعروض وحجز.', promptEn: 'Build a restaurant website called "Mazo Cafe" with menu, offers, and booking.' },
  { ar: 'أكاديمية', en: 'Academy', promptAr: 'اعمل موقع أكاديمية تعليمية مع كورسات وجدول وتسجيل طالب.', promptEn: 'Build an academy website with courses, schedule, and enrollment.' },
  { ar: 'أداة', en: 'Tool', promptAr: 'اعمل أداة حاسبة بسيطة بواجهة نظيفة وسجل نتائج محلي.', promptEn: 'Build a simple calculator tool with clean UI and local result history.' },
  { ar: 'حجز', en: 'Booking', promptAr: 'اعمل نظام حجز مواعيد بسيط بواجهة احترافية ومواعيد وهمية.', promptEn: 'Build a simple appointment booking system with a polished UI and mock slots.' },
  { ar: 'مهام', en: 'Tasks', promptAr: 'اعمل تطبيق مهام بسيط بفلترة وتخزين محلي وتصميم Premium.', promptEn: 'Build a simple tasks app with filtering, local storage, and a premium design.' },
  { ar: 'شات بوت', en: 'Chat UI', promptAr: 'اعمل واجهة شات بوت احترافية فيها رسائل وأدوات ورفع ملفات.', promptEn: 'Build a professional chatbot UI with messages, tools, and file upload.' },
  { ar: 'فاتورة PDF', en: 'Invoice', promptAr: 'اعمل فاتورة HTML قابلة للطباعة PDF مع جدول بنود وإجمالي.', promptEn: 'Build a printable HTML invoice with line items and totals.' },
  { ar: 'حزمة Office', en: 'Office Pack', promptAr: 'اعمل حزمة Office كاملة: مستند Word وجدول Excel وعرض PowerPoint عن مشروع Qalvero AI بشكل احترافي.', promptEn: 'Build a complete Office pack: Word document, Excel sheet, and PowerPoint deck for a professional Qalvero AI project.' },
  { ar: 'تطبيق Desktop', en: 'Desktop App', promptAr: 'اعمل مشروع قابل للتغليف Desktop على Windows وLinux مع ملاحظات Tauri/Electron وتشغيل محلي.', promptEn: 'Build a project prepared for desktop packaging on Windows and Linux with Tauri/Electron notes and local execution.' },
  { ar: 'PWA موبايل', en: 'Mobile PWA', promptAr: 'اعمل تطبيق PWA للموبايل قابل للتثبيت مع Offline cache وتصميم موبايل احترافي.', promptEn: 'Build an installable mobile PWA with offline cache and a polished mobile design.' },
  { ar: 'Android APK', en: 'Android APK', promptAr: 'اعمل تطبيق موبايل قابل للتصدير APK باستخدام Capacitor مع JDK 17 وAndroid SDK وGitHub Actions للبناء.', promptEn: 'Build a mobile app prepared for APK export using Capacitor, JDK 17, Android SDK, and GitHub Actions build workflow.' },
  { ar: 'لعبة APK', en: 'Game APK', promptAr: 'اعمل لعبة 2D شغالة وتكون قابلة للتصدير APK باستخدام Capacitor Android.', promptEn: 'Build a playable 2D game prepared for APK export using Capacitor Android.' },
  { ar: 'تطبيق ملاحظات APK', en: 'Notes APK', promptAr: 'اعمل تطبيق ملاحظات موبايل Offline قابل للتصدير APK مع تخزين محلي.', promptEn: 'Build an offline mobile notes app prepared for APK export with local storage.' },
  { ar: 'Qalvero Code', en: 'Qalvero Code', promptAr: 'حلل المشروع المرفق كمساعد كود متقدم: اعمل خريطة ملفات وخطة تعديل وpatch واختبارات وأوامر تشغيل آمنة.', promptEn: 'Analyze the attached project as an advanced code agent: file map, edit plan, patch, tests, and safe run commands.' },
  { ar: 'MCP Server', en: 'MCP Server', promptAr: 'اعمل تكامل MCP حقيقي وآمن: سيرفر JSON-RPC فيه tools/list وtools/call وresources وprompts مع إعدادات سرية آمنة.', promptEn: 'Build a real safe MCP integration: JSON-RPC server with tools/list, tools/call, resources, prompts, and secret-safe configuration.' },
  { ar: 'MCP Client', en: 'MCP Client', promptAr: 'اعمل MCP Client آمن يتصل بسيرفرات MCP من allowlist فقط ويعرض الأدوات وينفذ tool calls بدون كشف مفاتيح.', promptEn: 'Build a safe MCP client that connects only to allowlisted MCP servers, lists tools, and runs tool calls without exposing secrets.' },
  { ar: 'MCP Tool Hub', en: 'MCP Tool Hub', promptAr: 'اعمل لوحة MCP Tool Hub لإدارة الأدوات والموارد والبرومبتات مع واجهة احترافية وهوية Qalvero AI.', promptEn: 'Build an MCP Tool Hub dashboard for tools, resources, and prompts with a polished Qalvero AI interface.' },
  { ar: 'لعبة الثعبان', en: 'Snake Game', promptAr: 'اعمل لعبة الثعبان 2D شغالة فعلاً باسم Mazo Snake مع نقاط وتحكم موبايل وكيبورد.', promptEn: 'Build a real playable 2D Snake game called Mazo Snake with score, mobile controls, and keyboard controls.' },
  { ar: 'حزمة ألعاب 2D', en: '2D Arcade Pack', promptAr: 'اعمل حزمة ألعاب 2D فيها Snake وPong وBreakout وFlappy وSpace Shooter وتشتغل محليًا.', promptEn: 'Build a 2D arcade pack with Snake, Pong, Breakout, Flappy, and Space Shooter that runs locally.' },
  { ar: 'لعبة كسر الطوب', en: 'Breakout Game', promptAr: 'اعمل لعبة كسر الطوب Breakout 2D شغالة فعلاً بتصميم Qalvero AI.', promptEn: 'Build a real playable 2D Breakout game with Qalvero AI design.' },
  { ar: 'لعبة فضاء', en: 'Space Shooter', promptAr: 'اعمل لعبة Space Shooter 2D شغالة فعلاً مع إطلاق نار وأعداء ونقاط.', promptEn: 'Build a real playable 2D Space Shooter with bullets, enemies, and scoring.' },
  { ar: 'نظام POS', en: 'Restaurant POS', promptAr: 'اعمل نظام كاشير مطعم POS شغال محليًا مع منيو وسلة وطباعه إيصال.', promptEn: 'Build a local Restaurant POS with menu, cart, and printable receipt.' },
  { ar: 'منصة LMS', en: 'LMS', promptAr: 'اعمل منصة تعليم LMS فيها كورسات ودروس وتقدم الطالب واختبار.', promptEn: 'Build an LMS with courses, lessons, student progress, and a quiz.' },
  { ar: 'اختبار تفاعلي', en: 'Quiz App', promptAr: 'اعمل تطبيق اختبار تفاعلي بنقاط ومراجعة إجابات.', promptEn: 'Build an interactive quiz app with score and answer review.' },
  { ar: 'بطاقات مذاكرة', en: 'Flashcards', promptAr: 'اعمل تطبيق بطاقات مذاكرة بقلب الكروت وتقدم محلي.', promptEn: 'Build a flashcards study app with flip cards and local progress.' },
  { ar: 'Kanban', en: 'Kanban', promptAr: 'اعمل لوحة Kanban لإدارة المهام بأعمدة وكروت.', promptEn: 'Build a Kanban board with task columns and cards.' },
  { ar: 'مركز توثيق', en: 'Docs Hub', promptAr: 'اعمل مركز توثيق احترافي فيه Sidebar ومقالات وبحث.', promptEn: 'Build a professional documentation hub with sidebar, articles, and search.' },
  { ar: 'مكتبة مكونات', en: 'Component Library', promptAr: 'اعمل مكتبة مكونات UI فيها Buttons وCards وForms وNavigation.', promptEn: 'Build a UI component library with buttons, cards, forms, and navigation.' },
  { ar: 'نظام تصميم', en: 'Design System', promptAr: 'اعمل نظام تصميم فيه ألوان وخطوط ومكونات وقواعد استخدام.', promptEn: 'Build a design system with colors, typography, components, and usage rules.' },
  { ar: 'تتبع مصاريف', en: 'Expense Tracker', promptAr: 'اعمل تطبيق تتبع مصاريف بتصنيفات وإجمالي شهري وتصدير CSV.', promptEn: 'Build an expense tracker with categories, monthly total, and CSV export.' },
  { ar: 'صفحة حالة الخدمة', en: 'Status Page', promptAr: 'اعمل Status Page للخدمات فيها حالة عامة وحوادث وTimeline.', promptEn: 'Build a status page with overall status, incidents, and timeline.' },
  { ar: 'خارطة طريق', en: 'Roadmap', promptAr: 'اعمل خارطة طريق منتج بأعمدة Now وNext وLater.', promptEn: 'Build a product roadmap with Now, Next, and Later columns.' },
  { ar: 'متجر ملابس', en: 'Fashion store', promptAr: 'اعمل متجر ملابس عصري باسم Urban Drop مع تصنيفات ومقاسات وسلة.', promptEn: 'Build a modern fashion store called Urban Drop with categories, sizes, and cart.' },
  { ar: 'متجر أنمي', en: 'Anime merch', promptAr: 'اعمل متجر ملابس أنمي باسم Sukun Wear بتصميم عربي عصري وسلة وهمية.', promptEn: 'Build an anime merch store called Sukun Wear with a modern Arabic-friendly design and mock cart.' },
  { ar: 'موقع عيادة أسنان', en: 'Dental clinic', promptAr: 'اعمل موقع عيادة أسنان احترافي فيه خدمات وحجز ومعرض قبل وبعد.', promptEn: 'Build a professional dental clinic website with services, booking, and before/after gallery.' },
  { ar: 'شركة شحن', en: 'Logistics', promptAr: 'اعمل منصة شركة شحن فيها تتبع شحنة وحالات وجدول أسعار.', promptEn: 'Build a logistics platform with shipment tracking, statuses, and pricing table.' },
  { ar: 'مكتب محاماة', en: 'Law firm', promptAr: 'اعمل موقع مكتب محاماة احترافي فيه تخصصات واستشارة وحجز.', promptEn: 'Build a professional law firm website with practice areas, consultation, and booking.' },
  { ar: 'موقع فندق', en: 'Hotel site', promptAr: 'اعمل موقع فندق فيه غرف وحجز ومميزات وتقييمات.', promptEn: 'Build a hotel website with rooms, booking, amenities, and reviews.' },
  { ar: 'محول وحدات', en: 'Unit converter', promptAr: 'اعمل أداة تحويل وحدات محلية بتصميم نظيف وسجل نتائج.', promptEn: 'Build a local unit converter tool with clean design and history.' },
  { ar: 'مولد QR', en: 'QR generator', promptAr: 'اعمل أداة مولد QR بواجهة بسيطة ومعاينة وتحميل.', promptEn: 'Build a QR generator tool with simple UI, preview, and download state.' },
  { ar: 'محرر Markdown', en: 'Markdown editor', promptAr: 'اعمل محرر Markdown فيه كتابة ومعاينة وتصدير.', promptEn: 'Build a Markdown editor with editor, live preview, and export.' },
  { ar: 'قاعدة معرفة', en: 'Knowledge base', promptAr: 'اعمل Knowledge Base احترافية فيها بحث وتصنيفات ومقالات دعم.', promptEn: 'Build a professional knowledge base with search, categories, and support articles.' },
  { ar: 'نظام تذاكر دعم', en: 'Ticketing', promptAr: 'اعمل نظام تذاكر دعم فيه فتح تذكرة وحالات وأولويات.', promptEn: 'Build a support ticketing system with ticket form, statuses, and priorities.' },
  { ar: 'محفظة رقمية', en: 'Wallet UI', promptAr: 'اعمل واجهة محفظة رقمية فيها رصيد وتحويلات ومعاملات.', promptEn: 'Build a digital wallet UI with balance, transfers, and transactions.' },
  { ar: 'منصة كورسات', en: 'Course marketplace', promptAr: 'اعمل منصة بيع كورسات فيها بحث ومدرسين وسلة.', promptEn: 'Build a course marketplace with search, instructors, and cart.' },
  { ar: 'موقع أخبار', en: 'News portal', promptAr: 'اعمل بوابة أخبار بتصميم احترافي فيها أقسام ومقالات عاجلة.', promptEn: 'Build a professional news portal with categories and breaking articles.' },
  { ar: 'موقع بودكاست', en: 'Podcast site', promptAr: 'اعمل موقع بودكاست فيه حلقات ومقدمين واشتراك.', promptEn: 'Build a podcast website with episodes, hosts, and subscription.' },
  { ar: 'مركز ألعاب', en: 'Game hub', promptAr: 'اعمل مركز ألعاب 2D فيه كروت ألعاب ونقاط وترتيب.', promptEn: 'Build a 2D game hub with game cards, scores, and leaderboard.' },
];

const composerSuggestions = [
  { ar: 'اعمل متجر إلكتروني', en: 'Build an e-commerce store', promptAr: 'اعمل متجر إلكتروني احترافي باسم Mazora Store مع سلة وهمية وتصميم مختلف.', promptEn: 'Build a professional e-commerce store called Mazora Store with a mock cart and distinctive design.' },
  { ar: 'اعمل بحث جامعي PDF', en: 'Create academic PDF research', promptAr: 'اعمل بحث جامعي احترافي بالمصادر عن الذكاء الاصطناعي في التعليم، ونسقه كأنه جاهز PDF.', promptEn: 'Create a professional university-style research report with sources about AI in education, formatted for PDF.' },
  { ar: 'اشرح درس بمصادر', en: 'Explain with sources', promptAr: 'اشرحلي الدرس ده ببساطة ومع مصادر موثوقة لو محتاج.', promptEn: 'Explain this lesson simply and use trusted sources if needed.' },
  { ar: 'حل مشكلة كود', en: 'Fix code issue', promptAr: 'حلل مشكلة الكود المرفق واشرح السبب والحل.', promptEn: 'Analyze the attached code issue and explain the cause and fix.' },
  { ar: 'حوّل CSV لـ JSON', en: 'Convert CSV to JSON tool', promptAr: 'اعمل أداة بسيطة تحول CSV إلى JSON وتشتغل محليًا.', promptEn: 'Build a simple local tool that converts CSV to JSON.' },
  { ar: 'اكتب README', en: 'Write README', promptAr: 'اكتب README احترافي للمشروع المرفق مع خطوات التشغيل.', promptEn: 'Write a professional README for the attached project with setup steps.' },
  { ar: 'اعمل ملف Word وExcel وPowerPoint', en: 'Make Word, Excel, PowerPoint', promptAr: 'اعمل مستند Word وجدول Excel وعرض PowerPoint لنفس الفكرة بشكل جاهز للتصدير.', promptEn: 'Create a Word document, Excel spreadsheet, and PowerPoint deck for the same idea, ready to export.' },
  { ar: 'جهز نسخة موبايل وكمبيوتر', en: 'Prepare mobile and desktop build', promptAr: 'جهز المشروع عشان يبقى PWA للموبايل وقابل للتغليف على Windows وLinux.', promptEn: 'Prepare the project as a mobile PWA and for Windows/Linux desktop packaging.' },
  { ar: 'جهز APK Android', en: 'Prepare Android APK', promptAr: 'جهز المشروع للتصدير APK باستخدام Capacitor Android وJDK 17 وAndroid SDK مع ملف workflow للبناء.', promptEn: 'Prepare the project for APK export using Capacitor Android, JDK 17, Android SDK, and a build workflow.' },
  { ar: 'اعمل لعبة الثعبان', en: 'Build Snake game', promptAr: 'اعمل لعبة الثعبان 2D شغالة محليًا باسم Qalvero Snake مع نقاط وأفضل نتيجة.', promptEn: 'Build a local playable 2D Snake game called Qalvero Snake with score and high score.' },
  { ar: 'اعمل حزمة ألعاب 2D', en: 'Build 2D arcade pack', promptAr: 'اعمل حزمة ألعاب 2D للتشغيل فيها Snake وPong وBreakout وFlappy وMemory.', promptEn: 'Build a playable 2D arcade pack with Snake, Pong, Breakout, Flappy, and Memory.' },
  { ar: 'اعمل لعبة فضاء', en: 'Build space shooter', promptAr: 'اعمل لعبة Space Shooter 2D شغالة فعلاً مع تحكم ومراحل بسيطة.', promptEn: 'Build a real playable 2D Space Shooter with controls and simple waves.' },
  { ar: 'اعمل نظام POS', en: 'Build POS system', promptAr: 'اعمل نظام كاشير مطعم POS شغال محليًا.', promptEn: 'Build a local restaurant POS system.' },
  { ar: 'اعمل منصة LMS', en: 'Build LMS', promptAr: 'اعمل منصة تعليم LMS فيها تقدم طالب وتجربة تعليم احترافية.', promptEn: 'Build an LMS with student progress and a polished learning flow.' },
  { ar: 'اعمل Kanban', en: 'Build Kanban', promptAr: 'اعمل لوحة Kanban لإدارة مشروع صغير.', promptEn: 'Build a Kanban board for a small project.' },
  { ar: 'اعمل Docs Hub', en: 'Build docs hub', promptAr: 'اعمل مركز توثيق لمشروع SaaS.', promptEn: 'Build a documentation hub for a SaaS project.' }
];

const guestModels: ModelOption[] = [
  {
    id: 'QLO 1.2 Flash',
    name: 'QLO 1.2 Flash',
    badge: '1.2',
    tone: 'flash',
    desc: { en: 'Fast everyday chat, writing, summaries, and light help.', ar: 'سريع للشات اليومي والكتابة والتلخيص والمساعدة الخفيفة.' }
  }
];

const accountModels: ModelOption[] = [
  { id: 'QLO 1.2 Flash', name: 'QLO 1.2 Flash', badge: '1.2', tone: 'flash', desc: { en: 'Fast everyday chat with low credit cost.', ar: 'شات سريع بتكلفة كريدت قليلة.' } },
  { id: 'QLO 1.2 Study', name: 'QLO 1.2 Study', badge: '1.2', tone: 'study', desc: { en: 'Study mode with source grounding when needed.', ar: 'مذاكرة وشرح مع مصادر عند الحاجة.' } },
  { id: 'QLO 1.2 Pro', name: 'QLO 1.2 Pro', badge: '1.2', tone: 'pro', desc: { en: 'Stronger answers for coding, reasoning, and longer context.', ar: 'أقوى للكود والتحليل والسياق الأطول.' } },
  { id: 'QLO 1.3 Flash', name: 'QLO 1.3 Flash', badge: '1.3', tone: 'flash', desc: { en: 'Faster QLO 1.3 experience with better structure.', ar: 'تجربة QLO 1.3 أسرع بتنظيم أحسن.' } },
  { id: 'QLO 1.3 Pro', name: 'QLO 1.3 Pro', badge: '1.3', tone: 'pro', desc: { en: 'Advanced reasoning, coding support, and cleaner outputs.', ar: 'تحليل أقوى ودعم كود وردود أنضف.' } },
  { id: 'QLO 1.3 Agent', name: 'QLO 1.3 Agent', badge: '1.3', tone: 'agent', desc: { en: 'Builds apps, Office files, playable 2D games, ZIP exports, and local previews.', ar: 'يبني تطبيقات وملفات Office وألعاب 2D وZIP ومعاينة محلية.' } }
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


const LOCAL_THREAD_LIMIT = 24;
const LOCAL_FREE_RETENTION_DAYS = 60;
const LOCAL_PAID_RETENTION_DAYS = 180;
const CLOUD_CHAT_RETENTION_DAYS = 10;
const MAX_LOCAL_MESSAGES_PER_THREAD = 80;

function dateMs(value?: string) {
  const ms = value ? Date.parse(value) : 0;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}
function historyRetentionDays(plan?: string) {
  return plan === 'Free' || !plan ? LOCAL_FREE_RETENTION_DAYS : LOCAL_PAID_RETENTION_DAYS;
}
function pruneThreadsForPlan(threads: ChatThread[], plan = 'Free') {
  const retentionMs = historyRetentionDays(plan) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  return (threads || [])
    .map((thread) => ({
      ...thread,
      updatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString(),
      storagePolicy: thread.storagePolicy || 'local-first',
      messages: (thread.messages || []).slice(-MAX_LOCAL_MESSAGES_PER_THREAD)
    }))
    .filter((thread) => dateMs(thread.updatedAt || thread.createdAt) >= cutoff)
    .sort((a, b) => dateMs(b.updatedAt || b.createdAt) - dateMs(a.updatedAt || a.createdAt))
    .slice(0, LOCAL_THREAD_LIMIT);
}
function loadThreads(plan = 'Free'): ChatThread[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('qv_threads') || '[]');
    const pruned = pruneThreadsForPlan(parsed, plan);
    localStorage.setItem('qv_threads', JSON.stringify(pruned));
    return pruned;
  }
  catch { return []; }
}
function saveThreads(threads: ChatThread[], plan = 'Free') {
  const pruned = pruneThreadsForPlan(threads, plan);
  localStorage.setItem('qv_threads', JSON.stringify(pruned));
  localStorage.setItem('qv_threads_meta', JSON.stringify({
    strategy: 'local-first-hybrid',
    local_retention_days: historyRetentionDays(plan),
    cloud_retention_days: CLOUD_CHAT_RETENTION_DAYS,
    max_local_threads: LOCAL_THREAD_LIMIT,
    updated_at: new Date().toISOString()
  }));
}
function todayKey() { return new Date().toISOString().slice(0, 10); }


type LocalUserAiSettings = { enabled?: boolean; provider?: string; apiKey?: string; model?: string; useForAgent?: boolean };
function decodeLocalSecret(value: string) {
  try { return decodeURIComponent(escape(atob(value))); } catch { return ''; }
}
function loadLocalUserAi(forAgent = false): LocalUserAiSettings | null {
  try {
    const raw = localStorage.getItem('qv_user_ai_key');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.enabled) return null;
    if (forAgent && !parsed.useForAgent) return null;
    const apiKey = decodeLocalSecret(parsed.apiKey || '');
    if (!apiKey || apiKey.length < 12) return null;
    const provider = ['gemini', 'openrouter', 'groq', 'deepseek'].includes(parsed.provider) ? parsed.provider : 'gemini';
    return { enabled: true, provider, apiKey, model: parsed.model || '', useForAgent: Boolean(parsed.useForAgent) };
  } catch { return null; }
}


function planName(plan?: string) {
  return plan || 'Free';
}
function agentLimit(plan?: string) {
  if (plan === 'Max') return 4;
  if (plan === 'Premium') return 2;
  if (plan === 'Standard') return 1;
  return 1;
}
function getAgentUsageKey(plan?: string) { return `qv_agent_usage_${todayKey()}_${planName(plan)}`; }
function readAgentUsage(plan?: string) { return Number(localStorage.getItem(getAgentUsageKey(plan)) || 0); }
function incrementAgentUsage(plan?: string) { localStorage.setItem(getAgentUsageKey(plan), String(readAgentUsage(plan) + 1)); }

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}


function shouldUseWebGrounding(model: string, mode: string, text: string) {
  const q = `${model} ${mode} ${text}`.toLowerCase();
  if (model === 'QLO 1.2 Study') return true;
  return /(source|sources|cite|citation|research|study|paper|scientific|science|latest|today|current|medical|health|law|legal|statistics|data|evidence|مصدر|مصادر|دليل|بحث|دراسة|علمي|علمية|اخر|أحدث|النهارده|طبي|صحة|قانون|إحصائيات|بيانات)/i.test(q);
}

function hasCodeAttachment(files: ChatAttachment[]) {
  return files.some((file) => /\.(js|jsx|ts|tsx|py|html|css|json|php|java|go|rs|sql|sh|ya?ml|md|svg|docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(file.name));
}

function wantsAgentBuild(text: string, files: ChatAttachment[]) {
  const q = String(text || '').toLowerCase();
  const buildVerb = /(اعمل|ابني|أنشئ|انشئ|صمم|برمج|اكتب\s*كود|اكتبلي\s*كود|generate|build|create|make|develop|design)/i.test(q);
  const buildObject = /(موقع|تطبيق|متجر|صفحة|داشبورد|لوحة|واجهة|قالب|مشروع|اداة|أداة|حاسبة|لعبة|العاب|ألعاب|نظام|منصة|بوابة|تقويم|استبيان|اختبار|ملف\s*jsx|ملف\s*html|word|excel|powerpoint|office|docx|xlsx|pptx|وورد|اكسل|إكسل|بوربوينت|اوفيس|أوفيس|desktop|linux|windows|pwa|apk|website|web\s*app|app|store|shop|e-?commerce|landing|dashboard|portfolio|blog|tool|calculator|component|template|game|games|arcade|snake|pong|breakout|quiz|survey|calendar|kanban|crm|pos|lms|react|vite|jsx|html|css|single\s*file)/i.test(q);
  const explicitLocalProject = /(jsx|html|vite|react).{0,40}(واحد|single|local|محلي|شغله|تشغيل)/i.test(q);
  return (buildVerb && buildObject) || explicitLocalProject || (buildVerb && hasCodeAttachment(files));
}

function wantsStudyRoute(text: string) {
  const q = String(text || '').toLowerCase();
  return /(اشرح|شرح|ذاكر|مذاكرة|درس|واجب|امتحان|سؤال|حل\s*مسألة|تعلم|علمني|لخص\s*درس|explain|study|teach|lesson|homework|exam|quiz|summarize\s*this\s*lesson)/i.test(q);
}


function wantsAcademicResearch(text: string) {
  const q = String(text || '').toLowerCase();
  return /(بحث\s*(جامعي|جامعة|اكاديمي|أكاديمي)|ورقة\s*بحثية|بحث\s*بالمصادر|بحث\s*pdf|مراجع|توثيق|apa|mla|academic\s*research|university\s*research|research\s*paper|paper\s*with\s*sources)/i.test(q);
}

function isArabicText(value = '') { return /[\u0600-\u06FF]/.test(value); }

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function simpleMarkdownHtml(markdown = '') {
  const lines = escapeHtml(markdown).split('\n');
  const html = lines.map((line) => {
    if (/^###\s+/.test(line)) return `<h3>${line.replace(/^###\s+/, '')}</h3>`;
    if (/^##\s+/.test(line)) return `<h2>${line.replace(/^##\s+/, '')}</h2>`;
    if (/^#\s+/.test(line)) return `<h1>${line.replace(/^#\s+/, '')}</h1>`;
    if (/^[-*]\s+/.test(line)) return `<li>${line.replace(/^[-*]\s+/, '')}</li>`;
    if (!line.trim()) return '<br />';
    return `<p>${line}</p>`;
  }).join('\n');
  return html.replace(/(<li>.*?<\/li>\n?)+/gs, (block) => `<ul>${block}</ul>`);
}

function buildAcademicHtml(title: string, answer: string, sources: WebSource[], lang: string) {
  const isAr = lang === 'ar' || isArabicText(title + answer);
  const cleanTitle = title.trim().slice(0, 140) || (isAr ? 'بحث جامعي' : 'Academic Research');
  const date = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US');
  const refs = sources.map((s, i) => `<li><strong>[${i + 1}] ${escapeHtml(s.title)}</strong><br/><span>${escapeHtml(s.domain)}</span><br/><a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a></li>`).join('');
  return `<!doctype html><html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(cleanTitle)}</title><style>
    :root{--ink:#111827;--muted:#64748b;--line:#e2e8f0;--accent:#2563eb;--bg:#f8fafc;}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:${isAr ? "'Tahoma','Arial',sans-serif" : "Inter,Arial,sans-serif"};line-height:1.75}.page{max-width:900px;margin:0 auto;padding:42px 22px}.paper{background:#fff;border:1px solid var(--line);border-radius:28px;box-shadow:0 24px 80px rgba(15,23,42,.10);overflow:hidden}.cover{padding:54px 46px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff}.badge{display:inline-flex;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:8px 13px;font-size:12px;font-weight:800;background:rgba(255,255,255,.1)}h1{font-size:38px;line-height:1.25;margin:18px 0 10px}.meta{color:#dbeafe;font-size:14px}.content{padding:42px 46px}.content h1{font-size:30px;color:#0f172a}.content h2{font-size:24px;margin-top:30px;padding-top:18px;border-top:1px solid var(--line);color:#1e3a8a}.content h3{font-size:19px;color:#1e40af}.content p{margin:0 0 13px}.content ul{margin:0 0 16px;padding-inline-start:24px}.refs{padding:0 46px 46px}.refs h2{border-top:1px solid var(--line);padding-top:20px}.refs li{margin-bottom:16px;overflow-wrap:anywhere}.refs span{color:var(--muted);font-size:13px}.refs a{color:var(--accent);font-size:12px}.footer{border-top:1px solid var(--line);padding:18px 46px;color:var(--muted);font-size:12px;background:#f8fafc}@media print{body{background:#fff}.page{padding:0}.paper{box-shadow:none;border:0;border-radius:0}.cover{border-radius:0}.no-print{display:none}}
  </style></head><body><main class="page"><article class="paper"><section class="cover"><div class="badge">${isAr ? 'Qalvero Academic Research' : 'Qalvero Academic Research'}</div><h1>${escapeHtml(cleanTitle)}</h1><div class="meta">${isAr ? 'بحث منسق للطباعة PDF' : 'PDF-ready research document'} · ${date}</div></section><section class="content">${simpleMarkdownHtml(answer)}</section><section class="refs"><h2>${isAr ? 'المراجع والمصادر' : 'References and Sources'}</h2><ol>${refs || `<li>${isAr ? 'لم يتم العثور على مصادر كافية.' : 'No sufficient sources were found.'}</li>`}</ol></section><section class="footer">Generated by Qalvero AI. Review sources before formal submission.</section></article></main></body></html>`;
}

function wantsProRoute(text: string, files: ChatAttachment[]) {
  const q = String(text || '').toLowerCase();
  return /(debug|bug|fix|error|stack trace|typescript|react|supabase|api|database|sql|صلح|حل\s*مشكلة|ايرور|خطأ|الكود|كود|برمجة)/i.test(q) || (hasCodeAttachment(files) && !wantsAgentBuild(text, files));
}

function decideAutoRoute(text: string, files: ChatAttachment[], currentModel: string, currentMode: string): AutoRoute {
  if (currentModel === 'QLO 1.3 Agent') return 'agent';
  if (wantsAcademicResearch(text)) return 'research';
  if (wantsAgentBuild(text, files)) return 'agent';
  if (currentModel.includes('Study') || currentMode === 'Study coach' || wantsStudyRoute(text)) return 'study';
  if (wantsProRoute(text, files)) return 'pro';
  return 'chat';
}

function sourceContext(sources: WebSource[], lang: string) {
  if (!sources.length) return '';
  const header = lang === 'ar'
    ? 'استخدم المصادر المختصرة التالية فقط للحقائق الخارجية. اذكر الأرقام [1] [2] داخل الرد عند الاستفادة منها، ولو المصدر لا يكفي قل ذلك بوضوح.'
    : 'Use only these compact sources for external facts. Cite numbers like [1] [2] in the answer when using them, and say clearly if the sources are not enough.';
  return `\n\n${header}\n${sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet}`).join('\n\n')}`;
}

function webCacheKey(query: string, lang: string, mode = 'web') {
  return `qv_web_${new Date().toISOString().slice(0, 10)}_${mode}_${lang}_${query.toLowerCase().replace(/\s+/g, '_').slice(0, 80)}`;
}

async function getGroundingSources(query: string, lang: string, mode: 'web' | 'academic' = 'web'): Promise<WebSource[]> {
  const key = webCacheKey(query, lang, mode);
  try {
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached).slice(0, 4);
  } catch { /* ignore */ }
  const r = await fetch('/api/qlo-web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, language: lang, mode })
  });
  const data = await r.json();
  const sources = Array.isArray(data.sources) ? data.sources.slice(0, 4) : [];
  try { localStorage.setItem(key, JSON.stringify(sources)); } catch { /* ignore */ }
  return sources;
}

function classifyTrainingLanguage(text: string) {
  const value = String(text || '');
  const hasArabic = /[\u0600-\u06FF]/.test(value);
  const hasLatin = /[A-Za-z]/.test(value);
  const egyptian = /(عايز|عاوزه|عاوز|ايه|ازاي|إزاي|دلوقتي|كده|طب|بص|مش|ليه|عشان|تمام|خلاص|برضو|النهارده|هعمل|هتعمل|بيعمل|يشتغل)/i.test(value);
  if (hasArabic && egyptian) return hasLatin ? 'mixed_ar_eg_en' : 'ar_eg';
  if (hasArabic) return hasLatin ? 'mixed_ar_fusha_en' : 'ar_fusha';
  if (hasLatin) return 'en';
  return 'other';
}

function cleanTrainingText(text: string, max = 9000) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\s-]?){9,15}/g, '[phone]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .slice(0, max);
}

function saveLocalTrainingBackup(example: Record<string, unknown>) {
  try {
    const key = 'qv_qlo1_training_local';
    const old = JSON.parse(localStorage.getItem(key) || '[]');
    old.push(example);
    localStorage.setItem(key, JSON.stringify(old.slice(-800)));
  } catch { /* ignore */ }
}

function crc32(input: Uint8Array) {
  let crc = -1;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function dosTime(date = new Date()) {
  return ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
}
function dosDate(date = new Date()) {
  return (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
}
function u16(n: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
function u32(n: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
function concatBytes(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  parts.forEach((part) => { out.set(part, offset); offset += part.length; });
  return out;
}

function makeZip(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, content]) => {
    const filename = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const time = dosTime();
    const date = dosDate();
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(filename.length), u16(0), filename, data
    ]);
    const central = concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(filename.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), filename
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });
  const central = concatBytes(centralParts);
  const end = concatBytes([u32(0x06054b50), u16(0), u16(0), u16(Object.keys(files).length), u16(Object.keys(files).length), u32(central.length), u32(offset), u16(0)]);
  return new Blob([concatBytes([...localParts, central, end])], { type: 'application/zip' });
}


function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textLines(value = '', limit = 32) {
  return String(value || 'Qalvero AI Office Export')
    .replace(/```[a-z]*|```/gi, '')
    .split(/\n+/)
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function buildDocxBlob(title: string, content: string) {
  const lines = textLines(content, 80);
  const paragraphs = [`Qalvero AI - ${title}`, ...lines].map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join('');
  return makeZip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
  });
}

function buildXlsxBlob(title: string, content: string) {
  const rows = [['Type', 'Content'], ['Title', title], ...textLines(content, 80).map((line, i) => [`Item ${i + 1}`, line])];
  const rowXml = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`).join('')}</row>`).join('');
  return makeZip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Qalvero" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
  });
}

function buildPptxBlob(title: string, content: string) {
  const lines = textLines(content, 6);
  const body = escapeXml(lines.join(' • ') || 'Generated by Qalvero AI');
  return makeZip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
    'ppt/presentation.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(title)}</a:t></a:r></a:p><a:p><a:r><a:t>${body}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  });
}

function downloadOfficeExport(agentOutput: NonNullable<AgentOutput>, kind: 'docx' | 'xlsx' | 'pptx') {
  const base = (agentOutput.fileBase || 'qlo-agent-output').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'qlo-agent-output';
  const title = base.replace(/-/g, ' ');
  const content = agentOutput.rawText || agentOutput.html || agentOutput.jsx || 'Qalvero AI export';
  if (kind === 'docx') return downloadBlob(`${base}.docx`, buildDocxBlob(title, content));
  if (kind === 'xlsx') return downloadBlob(`${base}.xlsx`, buildXlsxBlob(title, content));
  return downloadBlob(`${base}.pptx`, buildPptxBlob(title, content));
}

function buildAgentProjectFiles(agentOutput: NonNullable<AgentOutput>) {
  const jsx = agentOutput.jsx || `export default function App(){return <main style={{padding:32,fontFamily:'Arial'}}>Qalvero Agent output is in preview.html</main>}`;
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'qalvero-agent-project',
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        'android:add': 'npx cap add android',
        'android:sync': 'npm run build && npx cap sync android',
        'android:open': 'npx cap open android',
        'android:apk': 'npm run android:sync && cd android && ./gradlew assembleDebug'
      },
      dependencies: {
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^5.4.11',
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.468.0',
        '@capacitor/core': '^6.2.0',
        '@capacitor/cli': '^6.2.0',
        '@capacitor/android': '^6.2.0'
      },
      devDependencies: {},
      engines: { node: '22.x' }
    }, null, 2),
    'index.html': '<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="theme-color" content="#0f172a"/><link rel="manifest" href="/manifest.webmanifest"/><title>Qalvero Agent Project</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    'src/main.jsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\nif ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined)); }\n",
    'manifest.webmanifest': JSON.stringify({ name: 'Qalvero Agent Project', short_name: 'Qalvero', start_url: '/', display: 'standalone', background_color: '#070914', theme_color: '#ff8a3d', icons: [] }, null, 2),
    'sw.js': "const CACHE='qalvero-agent-v1';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/index.html']))));self.addEventListener('fetch',e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));",
    'capacitor.config.ts': `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qalvero.agentapp',
  appName: 'Qalvero Agent App',
  webDir: 'dist',
  bundledWebRuntime: false
};

export default config;
`,
    '.github/workflows/android-apk.yml': `name: Build Android APK

on:
  workflow_dispatch:
  push:
    branches: [ main ]

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
      - uses: android-actions/setup-android@v3
      - run: npm ci
      - run: npm run build
      - run: npx cap add android
      - run: npx cap sync android
      - run: cd android && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: qalvero-debug-apk
          path: android/app/build/outputs/apk/debug/*.apk
`,
    'cloudbuild.yaml': `timeout: 1800s
options:
  logging: CLOUD_LOGGING_ONLY
  machineType: E2_HIGHCPU_8
steps:
  - name: cimg/android:2024.11-node
    entrypoint: bash
    args:
      - -lc
      - |
        set -euo pipefail
        node -v
        java -version
        npm ci --legacy-peer-deps
        npm run build
        npx cap add android || true
        npx cap sync android
        cd android
        chmod +x ./gradlew || true
        ./gradlew assembleDebug
        mkdir -p /workspace/qlo-apk-output
        cp app/build/outputs/apk/debug/*.apk /workspace/qlo-apk-output/app-debug.apk
artifacts:
  objects:
    location: gs://$PROJECT_ID-qalvero-apk-outputs/qlo-apk
    paths:
      - qlo-apk-output/*.apk
`,
    'docs/REMOTE_APK_BUILD.md': `# Remote APK build

This export includes a real Android build path. Qalvero AI can send this ZIP to a remote builder when your server is configured with Google Cloud credentials.

## Qalvero Cloud Build flow

1. The browser creates the same ZIP you can download.
2. Qalvero uploads the ZIP to Google Cloud Storage.
3. Qalvero starts a Cloud Build job using an Android + Node image.
4. Cloud Build runs npm ci, npm run build, Capacitor sync, and Gradle assembleDebug.
5. The debug APK is uploaded back to Cloud Storage.

Required server env vars:

- GCLOUD_PROJECT_ID
- GCLOUD_TRAINING_BUCKET
- GCLOUD_SERVICE_ACCOUNT_BASE64
- QLO_APK_AUTO_BUILD=on

The APK output is a debug APK for testing. Release APK/AAB still needs signing keys.
`,
    'scripts/build-apk.ps1': `Write-Host "Qalvero APK build"
node -v
java -version
npm ci
npm run build
npx cap add android
npx cap sync android
Set-Location android
.\gradlew.bat assembleDebug
Write-Host "APK output: android/app/build/outputs/apk/debug/"
`,
    'scripts/build-apk.sh': `#!/usr/bin/env bash
set -euo pipefail
node -v
java -version
npm ci
npm run build
npx cap add android || true
npx cap sync android
cd android
./gradlew assembleDebug
echo "APK output: android/app/build/outputs/apk/debug/"
`,
    'src/App.jsx': jsx,
    'README.md': `# Qalvero Agent Project

Generated inside Qalvero AI.

## Run locally

1. Install packages with npm install.
2. Start with npm run dev.
3. Build with npm run build.

## Included

- Single React JSX app
- Local Vite setup
- preview.html for browser preview
- Office export support from the Qalvero AI chat UI
- Mobile PWA, Android APK-ready Capacitor setup, and desktop/Linux packaging notes
- JDK 17 / Android SDK / Gradle build workflow
- agent-output.txt with notes
`,
    'docs/OFFICE_EXPORTS.md': `# Office support

Qalvero AI can export Agent output as Word (.docx), Excel (.xlsx), PowerPoint (.pptx), HTML, PDF print, JSX, and ZIP. Review Office files before formal submission because generated files are starter documents.
`,
    'docs/DESKTOP_MOBILE_LINUX.md': `# Mobile / Desktop / Linux packaging

Use this web project as the source for:

- Mobile: PWA install or Capacitor Android wrapper.
- APK: run npm run android:add, npm run android:sync, then npm run android:apk after installing JDK 17 and Android SDK.
- Desktop: Tauri or Electron wrapper.
- Linux: Tauri AppImage/deb/rpm or Electron AppImage.

Keep the web build working first, then wrap dist/.
`,
    'docs/APK_BUILD.md': `# Android APK build

This project is prepared for APK export through Capacitor Android.

## Requirements

- Node.js 22.x
- JDK 17
- Android Studio or Android SDK command-line tools
- Android SDK Platform installed
- Gradle through the generated Android project

## Local build

\`\`\`bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
\`\`\`

Debug APK path:

\`\`\`text
android/app/build/outputs/apk/debug/
\`\`\`

## CI build

A GitHub Actions workflow is included at .github/workflows/android-apk.yml. Run it from GitHub Actions to generate a debug APK artifact.

## Production signing

For a release APK/AAB, add Android signing config in Android Studio or CI secrets. Do not store keystore passwords in source files.
`,
    'docs/MCP_INTEGRATION.md': `# Qalvero MCP integration

This export includes MCP-ready guidance for Qalvero AI projects.

## Server endpoint shape

Use JSON-RPC over HTTP for remote/serverless compatibility. Required methods:

- initialize
- tools/list
- tools/call
- resources/list
- resources/read
- prompts/list
- prompts/get

## Security rules

- Keep MCP server URLs in an environment allowlist.
- Never expose API keys in the browser.
- Do not run arbitrary STDIO commands from user input.
- Treat remote tool output as untrusted.
- Validate tool schemas before calls.

## Qalvero env examples

\`\`\`env
QLO_MCP_ENABLED=true
QLO_MCP_API_KEY=change-me
QLO_MCP_SERVERS_JSON=[]
\`\`\`
`,
    'src/qalveroMcpClient.js': `export async function callQalveroMcp(method, params = {}) {
  const response = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'MCP call failed');
  return data.result;
}

export async function listQalveroMcpTools() {
  const result = await callQalveroMcp('tools/list');
  return result.tools || [];
}
`,
    'mcp.config.example.json': JSON.stringify({
      qalvero: {
        endpoint: '/api/mcp',
        transport: 'stateless-http-json-rpc',
        methods: ['initialize', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'prompts/list', 'prompts/get'],
        security: ['allowlist-remote-servers', 'no-browser-secrets', 'no-stdio-from-chat']
      }
    }, null, 2),
    'preview.html': agentOutput.html || '',
    'agent-output.txt': agentOutput.rawText || ''
  };
  return files;
}

function agentProjectZipBlob(agentOutput: NonNullable<AgentOutput>) {
  return makeZip(buildAgentProjectFiles(agentOutput));
}

function downloadAgentZip(agentOutput: NonNullable<AgentOutput>) {
  const blob = agentProjectZipBlob(agentOutput);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qalvero-agent-project.zip';
  a.click();
  URL.revokeObjectURL(url);
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const copyByLang = {
  ar: {
    intro: 'Qalvero AI',
    subtitle: 'اكتب، برمج، لخص، خطط، وابني أسرع مع QLO. تجربة شات نظيفة للمهام الرقمية اليومية.',
    cards: [
      { id: 'ask', title: 'اسأل QLO 1.2', desc: 'كتابة، تلخيص، أفكار، وشرح سريع.', prompt: '', mode: 'Auto', icon: Sparkles },
      { id: 'study', title: 'ساعدني أذاكر', desc: 'شرح وتلخيص وأسئلة مراجعة.', prompt: 'ساعدني أذاكر بشكل منظم النهارده.', mode: 'Study coach', icon: GraduationCap },
      { id: 'ideas', title: 'رتّب أفكاري', desc: 'حوّل الكلام لخطة واضحة.', prompt: 'رتّبلي أفكاري وخليها خطوات عملية.', mode: 'Business planner', icon: Lightbulb },
      { id: 'agent', title: 'QLO 1.3 Agent', desc: 'يبني JSX أو HTML ويشغله محليًا داخل الشات.', prompt: 'ابني لي مشروع بسيط احترافي كملف JSX واحد مع تصميم نظيف.', mode: 'Business planner', icon: Bot }
    ],
    typing: 'QLO بيكتب...',
    typingSearch: 'QLO بيدور في الويب عن مصادر موثوقة...',
    typingAgent: 'QLO 1.3 Agent بيبني المشروع ويجهز المعاينة...',
    typingResearch: 'QLO بيجمع مصادر ويجهز بحث جامعي PDF...',
    typingStudy: 'QLO Study بيشرح ويرتب الإجابة...',
    typingPro: 'QLO Pro بيحلل الكود والمشكلة...',
    typingReading: 'QLO بيقرأ الملفات المرفقة...',
    backendDown: 'اتصال الذكاء الاصطناعي مش متفعل دلوقتي. راجع مفاتيح السيرفر في Vercel Environment Variables.',
    noProviders: 'اتصال Qalvero AI مش متفعل حاليًا. ضيف مفاتيح AI من إعدادات السيرفر.',
    empty: 'QLO رجّع رد فاضي.',
    memorySaved: 'تم حفظ معلومة بسيطة في ذاكرة QLO.',
    guestHint: 'ضيف: QLO 1.2 Flash فقط. سجّل دخول عشان QLO 1.3 و Agent.',
    settings: 'إعدادات الرد',
    model: 'الموديل',
    mode: 'الوضع',
    startNew: 'محادثة جديدة',
    agentLimit: 'حد Agent اليومي',
    agentReady: 'تم تشغيل QLO 1.3 Agent. النتيجة والمعاينة تحت الرسالة.',
    agentBlocked: 'حد QLO Agent خلص النهارده. Free مرة يوميًا، Premium مرتين، Max أربع مرات.',
    preview: 'معاينة محلية',
    downloadRaw: 'تحميل نص',
    downloadHtml: 'تحميل HTML',
    downloadJsx: 'تحميل JSX',
    downloadDocx: 'Word',
    downloadXlsx: 'Excel',
    downloadPptx: 'PowerPoint',
    printPdf: 'PDF',
    creditSaver: 'وضع توفير الكريدت شغال: البحث يستخدم مصادر مختصرة والـAgent يستخدم أنماط بناء محسّنة قبل ما يستهلك ردود تقيلة.',
    sourcesTitle: 'المصادر المستخدمة',
    webGrounded: 'تم تدعيم الرد بمصادر خارجية مختصرة عشان نقلل الهبد والكريدت.',
    webEmpty: 'ملقتش مصادر موثوقة كفاية بسرعة، فخليت QLO يوضح عدم التأكد بدل الاختراع. شيء نادر بين البشر، للأسف.',
    downloadZip: 'تحميل ZIP',
    buildApk: 'بناء APK',
    buildingApk: 'بيتم إرسال المشروع لمحرك بناء APK...',
    apkBuildStarted: 'بدأ بناء APK. افتح سجل البناء أو مسار التخزين بعد ما يخلص.',
    apkBuilderLocal: 'محرك APK السحابي مش متظبط. حمّل ZIP واستخدم GitHub Actions أو Android Studio.',
    agentTools: 'أدوات Agent الجاهزة',
    agentToolsList: 'أدوات بناء متقدمة: مواقع، SaaS، متاجر، Office، ألعاب 2D، تعليم، إدارة، Docs، PWA/Desktop/APK، أدوات تفاعلية، ومعاينة محلية.',
    autoAgent: 'تم تحويل الطلب تلقائيًا لـ QLO 1.3 Agent عشان المطلوب بناء مشروع/واجهة. الروبوت عرف أخيرًا يفرّق بين اشرح وابني.',
    autoStudy: 'تم تحويل الطلب تلقائيًا لـ QLO 1.2 Study عشان ده طلب شرح/مذاكرة، ومعاه مصادر لما يحتاج.',
    autoPro: 'تم تحويل الطلب تلقائيًا لموديل أقوى عشان فيه كود أو مشكلة تقنية.',
    autoMode: 'توجيه تلقائي شغال',
    uploadReady: 'تم تجهيز الملفات للقراءة. الملفات النصية تُقرأ من المحتوى، والصور تُرفق كأصول محلية.',
    autoResearch: 'تم تحويل الطلب تلقائيًا لوضع بحث جامعي بالمصادر وتنسيق PDF.',
    researchReady: 'تم تجهيز البحث بصيغة احترافية قابلة للطباعة PDF.',
    researchPreview: 'بحث PDF جاهز للطباعة',
    suggestionsTitle: 'اقتراحات جاهزة'
  },
  en: {
    intro: 'Qalvero AI',
    subtitle: 'Write, code, summarize, brainstorm, and build faster with QLO.',
    cards: [
      { id: 'ask', title: 'Ask QLO 1.2', desc: 'Writing, summaries, ideas, and quick explanations.', prompt: '', mode: 'Auto', icon: Sparkles },
      { id: 'study', title: 'Help me study', desc: 'Explain, summarize, and quiz.', prompt: 'Help me study in an organized way today.', mode: 'Study coach', icon: GraduationCap },
      { id: 'ideas', title: 'Organize ideas', desc: 'Turn rough thoughts into steps.', prompt: 'Organize my ideas into clear practical steps.', mode: 'Business planner', icon: Lightbulb },
      { id: 'agent', title: 'QLO 1.3 Agent', desc: 'Build JSX or HTML and preview it locally in chat.', prompt: 'Build a clean single-file JSX project with a polished design.', mode: 'Business planner', icon: Bot }
    ],
    typing: 'QLO is typing...',
    typingSearch: 'QLO is searching the web for trusted sources...',
    typingAgent: 'QLO 1.3 Agent is building the project and preview...',
    typingResearch: 'QLO is collecting sources and formatting academic research...',
    typingStudy: 'QLO Study is preparing the explanation...',
    typingPro: 'QLO Pro is analyzing the code or technical issue...',
    typingReading: 'QLO is reading attached files...',
    backendDown: 'The AI connection is not active yet. Check server keys in Vercel Environment Variables.',
    noProviders: 'Qalvero AI connection is not configured yet. Add AI server keys in deployment settings.',
    empty: 'QLO returned an empty response.',
    memorySaved: 'A small detail was saved to QLO memory.',
    guestHint: 'Guest: QLO 1.2 Flash only. Login for QLO 1.3 and Agent.',
    settings: 'Response settings',
    model: 'Model',
    mode: 'Mode',
    startNew: 'New chat',
    agentLimit: 'Daily Agent limit',
    agentReady: 'QLO 1.3 Agent finished. Output and preview are below.',
    agentBlocked: 'QLO Agent daily limit reached. Free gets 1/day, Premium 2/day, Max 4/day.',
    preview: 'Local preview',
    downloadRaw: 'Download text',
    downloadHtml: 'Download HTML',
    downloadJsx: 'Download JSX',
    downloadDocx: 'Word',
    downloadXlsx: 'Excel',
    downloadPptx: 'PowerPoint',
    printPdf: 'PDF',
    creditSaver: 'Credit saver is on: web answers use compact source grounding and Agent uses optimized build patterns before spending heavy calls.',
    sourcesTitle: 'Sources used',
    webGrounded: 'Answer grounded with compact external sources to reduce hallucination and credit waste.',
    webEmpty: 'No strong sources were found quickly, so QLO will avoid pretending certainty.',
    downloadZip: 'Download ZIP',
    buildApk: 'Build APK',
    buildingApk: 'Sending project to the APK build engine...',
    apkBuildStarted: 'APK build started. Open the build log or storage output when it finishes.',
    apkBuilderLocal: 'Cloud APK builder is not configured. Download ZIP and use GitHub Actions or Android Studio.',
    agentTools: 'Ready Agent tools',
    agentToolsList: 'Advanced build tools: websites, SaaS, stores, Office, 2D games, education, admin, docs, PWA/Desktop/APK, tools, and local previews.',
    autoAgent: 'Auto-routed to QLO 1.3 Agent because this looks like a build/project request.',
    autoStudy: 'Auto-routed to QLO 1.2 Study because this looks like an explanation or study request.',
    autoPro: 'Auto-routed to a stronger model because this includes code or a technical issue.',
    autoMode: 'Auto routing is active',
    uploadReady: 'Files are ready. Text files are read from content, and images are attached as local assets.',
    autoResearch: 'Auto-routed to academic research mode with sources and PDF-ready formatting.',
    researchReady: 'Research is ready in a professional PDF-printable layout.',
    researchPreview: 'PDF-ready research',
    suggestionsTitle: 'Ready suggestions'
  }
} as const;

function looksLikeNoProvider(text: string) { return /no qlo providers|no providers|provider.*configured|not configured/i.test(text); }

const ACCEPTED_FILE_TYPES = '.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.html,.css,.scss,.json,.php,.java,.go,.rs,.sql,.sh,.bash,.zsh,.yaml,.yml,.csv,.txt,.md,.mdx,.svg,.xml,.env,.ini,.toml,.lock,.log,.vue,.svelte,.dart,.kt,.swift,.rb,.cpp,.c,.h,.hpp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.jpg,.jpeg,.png,.gif,.webp';
const MAX_ATTACHMENTS = 12;
const MAX_FILE_SIZE = 3 * 1024 * 1024;

export default function Chat() {
  const { lang, user, profile } = useApp();
  const t = labels[lang];
  const copy = lang === 'ar' ? copyByLang.ar : copyByLang.en;
  const plan = profile?.plan || 'Free';
  const [threads, setThreads] = useState<ChatThread[]>(() => loadThreads(plan));
  const [activeId, setActiveId] = useState<string>(() => loadThreads(plan)[0]?.id || 'new');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [workingState, setWorkingState] = useState<WorkingState>('idle');
  const [model, setModel] = useState('QLO 1.2 Flash');
  const loggedIn = Boolean(user || profile);
  const availableModels = loggedIn ? accountModels : guestModels;
  const [mode, setMode] = useState('Auto');
  const [error, setError] = useState('');
  const [memoryNotice, setMemoryNotice] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [ratings, setRatings] = useState<{ [key: string]: 'like' | 'dislike' | undefined }>({});
  const [agentOutput, setAgentOutput] = useState<AgentOutput>(null);
  const [apkBuild, setApkBuild] = useState<{ loading: boolean; message: string; logUrl?: string; outputUri?: string }>({ loading: false, message: '' });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const animatingRef = useRef(0);
  const sendingRef = useRef(false);

  const active = useMemo(() => threads.find((x) => x.id === activeId), [threads, activeId]);
  const msgs = active?.messages || [];
  const selectedModel = availableModels.find((item) => item.id === model) || availableModels[0] || accountModels[0];
  const selectedIsAgent = model === 'QLO 1.3 Agent';
  const usedAgents = readAgentUsage(plan);
  const maxAgents = agentLimit(plan);
  const workingLabels: Record<WorkingState, string> = {
    idle: copy.typing,
    web: copy.typingSearch,
    agent: copy.typingAgent,
    research: copy.typingResearch,
    study: copy.typingStudy,
    pro: copy.typingPro,
    chat: copy.typing,
    reading: copy.typingReading
  };

  useEffect(() => {
    if (!availableModels.some((item) => item.id === model)) setModel('QLO 1.2 Flash');
  }, [loggedIn, model, availableModels]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length, typing, agentOutput]);

  useEffect(() => { if (!showSettings) setModelMenuOpen(false); }, [showSettings]);

  useEffect(() => {
    try { localStorage.setItem('qv_plan_hint', plan); } catch { /* ignore */ }
    setThreads((prev) => {
      const next = pruneThreadsForPlan(prev, plan);
      saveThreads(next, plan);
      if (activeId !== 'new' && !next.some((thread) => thread.id === activeId)) setActiveId(next[0]?.id || 'new');
      return next;
    });
  }, [plan]);

  async function syncThreadToCloud(thread: ChatThread) {
    if (!profile?.email) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch('/api/qlo-chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ thread: { ...thread, model, mode }, retentionDays: CLOUD_CHAT_RETENTION_DAYS })
      });
    } catch { /* local-first means cloud sync is optional */ }
  }

  function setThreadMessages(threadId: string, messages: Msg[], syncCloud = false) {
    setThreads((prev) => {
      let changedThread: ChatThread | null = null;
      const next = prev.map((th) => {
        if (th.id !== threadId) return th;
        changedThread = { ...th, messages: messages.slice(-MAX_LOCAL_MESSAGES_PER_THREAD), updatedAt: new Date().toISOString(), model, mode, storagePolicy: 'local-first' };
        return changedThread;
      });
      saveThreads(next, plan);
      if (syncCloud && changedThread) void syncThreadToCloud(changedThread);
      return pruneThreadsForPlan(next, plan);
    });
  }

  function upsertThread(messages: Msg[], userText: string) {
    const now = new Date().toISOString();
    if (activeId === 'new' || !active) {
      const created: ChatThread = { id: crypto.randomUUID(), title: userText.slice(0, 42) || 'New chat', messages: messages.slice(-MAX_LOCAL_MESSAGES_PER_THREAD), createdAt: now, updatedAt: now, model, mode, storagePolicy: 'local-first' };
      const next = pruneThreadsForPlan([created, ...threads], plan);
      setThreads(next); saveThreads(next, plan); setActiveId(created.id); return created.id;
    }
    let changedThread: ChatThread | null = null;
    const next = threads.map((th) => {
      if (th.id !== activeId) return th;
      changedThread = { ...th, messages: messages.slice(-MAX_LOCAL_MESSAGES_PER_THREAD), title: th.title || userText.slice(0, 42), updatedAt: now, model, mode, storagePolicy: 'local-first' };
      return changedThread;
    });
    const pruned = pruneThreadsForPlan(next, plan);
    setThreads(pruned); saveThreads(pruned, plan); if (changedThread) void syncThreadToCloud(changedThread); return activeId;
  }

  function newChat() {
    setActiveId('new'); setInput(''); setError(''); setMemoryNotice(''); setTyping(false); setWorkingState('idle'); setAttachments([]); setAgentOutput(null); setApkBuild({ loading: false, message: '' }); sendingRef.current = false;
  }

  function handleRate(index: number, rating: 'like' | 'dislike') {
    const key = `${activeId}-${index}`;
    setRatings((prev) => {
      const current = prev[key];
      if (current === rating) { const { [key]: _, ...rest } = prev; return rest; }
      return { ...prev, [key]: rating };
    });
  }

  function handleCopy(index: number) {
    const textToCopy = msgs[index]?.content || '';
    navigator.clipboard?.writeText(textToCopy).catch(() => undefined);
  }

  async function processFiles(files: File[]) {
    const incoming = Array.from(files || []);
    setError('');
    setWorkingState('reading');
    if (!incoming.length) { setWorkingState('idle'); return; }

    const current = attachments;
    const seen = new Set(current.map((att) => `${att.name}:${att.size}`));
    const next: ChatAttachment[] = [];
    const errors: string[] = [];
    const maxToAdd = Math.max(0, MAX_ATTACHMENTS - current.length);

    if (maxToAdd <= 0) {
      setError(lang === 'ar' ? 'وصلت للحد الأقصى للملفات في الرسالة دي.' : 'Attachment limit reached for this message.');
      setWorkingState('idle');
      return;
    }

    for (const file of incoming) {
      if (next.length >= maxToAdd) break;
      const fingerprint = `${file.name}:${file.size}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);

      if (file.size > MAX_FILE_SIZE) {
        errors.push(lang === 'ar' ? `${file.name}: أكبر من 3MB` : `${file.name}: larger than 3MB`);
        continue;
      }

      const lower = file.name.toLowerCase();
      const isSvg = lower.endsWith('.svg');
      const isImage = /\.(png|jpe?g|gif|webp)$/i.test(lower);
      const isText = isSvg || /\.(js|jsx|ts|tsx|mjs|cjs|py|html|css|scss|json|php|java|go|rs|sql|sh|bash|zsh|ya?ml|csv|txt|mdx?|xml|env|ini|toml|lock|log|vue|svelte|dart|kt|swift|rb|cpp|c|h|hpp|rtf)$/i.test(lower) || file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('xml');

      try {
        if (isText) {
          const content = await file.text();
          next.push({
            name: file.name,
            type: file.type || (isSvg ? 'image/svg+xml' : 'text/plain'),
            size: file.size,
            kind: 'text',
            content: content.slice(0, 80000)
          });
        } else if (isImage) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          next.push({
            name: file.name,
            type: file.type || 'image',
            size: file.size,
            kind: 'image',
            content: `[Image asset: ${file.name}]`,
            dataUrl: dataUrl.slice(0, 350000)
          });
        } else {
          next.push({ name: file.name, type: file.type || 'binary', size: file.size, kind: 'binary', content: `[Binary file: ${file.name}, ${file.size} bytes]` });
        }
      } catch {
        errors.push(lang === 'ar' ? `${file.name}: فشل في القراءة` : `${file.name}: failed to read`);
      }
    }

    if (next.length) {
      setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
      setMemoryNotice(copy.uploadReady);
    }
    if (incoming.length > next.length && current.length + next.length >= MAX_ATTACHMENTS) {
      setMemoryNotice(lang === 'ar' ? `تم إرفاق ${next.length} ملف فقط عشان الحد الأقصى ${MAX_ATTACHMENTS}.` : `Attached ${next.length} file(s) only because the limit is ${MAX_ATTACHMENTS}.`);
    }
    if (errors.length) setError(errors.slice(0, 3).join(' · '));
    setWorkingState('idle');
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []) as File[];
    e.target.value = '';
    await processFiles(files);
  }

  function removeAttachment(idx: number) { setAttachments((prev) => prev.filter((_, i) => i !== idx)); }


  function chooseModel(nextModel: string) {
    setModel(nextModel);
    setModelMenuOpen(false);
  }


  async function queueTrainingExample(args: { prompt: string; response: string; route: string; model: string; task?: string; sources?: WebSource[] }) {
    if (localStorage.getItem('qv_qlo1_training_enabled') === 'off') return;
    const languageTag = classifyTrainingLanguage(`${args.prompt}\n${args.response}`);
    if (!['ar_eg', 'ar_fusha', 'en', 'mixed_ar_eg_en', 'mixed_ar_fusha_en'].includes(languageTag)) return;
    const example = {
      prompt: cleanTrainingText(args.prompt, 8000),
      response: cleanTrainingText(args.response, 12000),
      languageTag,
      route: args.route,
      model: args.model,
      task: args.task || mode,
      sources: (args.sources || []).slice(0, 5).map((s) => ({ title: s.title, url: s.url, domain: s.domain })),
      created_at: new Date().toISOString()
    };
    saveLocalTrainingBackup(example);
    try {
      const token = await getAccessToken();
      if (!token) return;
      await fetch('/api/qlo-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(example)
      });
    } catch { /* local backup already saved */ }
  }

  async function animateReply(threadId: string, afterUser: Msg[], reply: string, sources: WebSource[] = []) {
    const ticket = Date.now(); animatingRef.current = ticket; setTyping(true);
    const clean = reply || copy.empty;
    setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: '', sources: [] }]);
    await sleep(70);
    const step = clean.length > 2200 ? 48 : clean.length > 900 ? 24 : 8;
    for (let i = step; i <= clean.length; i += step) {
      if (animatingRef.current !== ticket) break;
      setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: clean.slice(0, i), sources: [] }]);
      await sleep(clean.length > 1400 ? 5 : 10);
    }
    setThreadMessages(threadId, [...afterUser, { role: 'assistant', content: clean, sources }], true); setTyping(false); setWorkingState('idle');
  }

  function buildPayload(text: string) {
    const attachmentsText = attachments.map((att) => `\n\n[${att.name} · ${att.kind}]\n${att.content}`).join('');
    const visibleFiles = attachments.length ? `\n\n${lang === 'ar' ? 'الملفات المرفقة' : 'Attached files'}: ${attachments.map((a) => a.name).join(', ')}` : '';
    return { finalText: text + attachmentsText, visibleText: text + visibleFiles };
  }

  async function sendChat(text: string, routeModel = model, routeMode = mode) {
    const { finalText, visibleText } = buildPayload(text);
    const afterUser = [...msgs, { role: 'user', content: visibleText } as Msg];
    const threadId = upsertThread(afterUser, visibleText);
    setLoading(true);
    setWorkingState(routeModel.includes('Study') ? 'study' : routeModel.includes('Pro') ? 'pro' : 'chat');
    try {
      let sources: WebSource[] = [];
      let groundedText = finalText;
      if (shouldUseWebGrounding(routeModel, routeMode, text)) {
        setWorkingState('web');
        sources = await getGroundingSources(text || finalText.slice(0, 220), lang);
        groundedText = `${finalText}${sourceContext(sources, lang)}`;
        setMemoryNotice(sources.length ? copy.webGrounded : copy.webEmpty);
      }
      const token = await getAccessToken();
      const r = await fetch('/api/qalvero-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: groundedText, history: msgs, model: routeModel, mode: routeMode, language: lang, grounded: sources.length > 0, userAi: loadLocalUserAi(false) })
      });
      const data = await r.json();
      const rawReply = data.reply || data.error || copy.empty;
      const reply = looksLikeNoProvider(rawReply) ? copy.noProviders : rawReply;
      if (!r.ok) setError(reply);
      if (data.memory_updated && !sources.length) setMemoryNotice(copy.memorySaved);
      await animateReply(threadId, afterUser, reply, sources);
      void queueTrainingExample({ prompt: visibleText, response: reply, route: routeModel.includes('Study') ? 'study' : routeModel.includes('Pro') ? 'pro' : 'chat', model: routeModel, task: routeMode, sources });
    } catch {
      setError(copy.backendDown);
      await animateReply(threadId, afterUser, copy.backendDown);
    } finally { setLoading(false); setAttachments([]); }
  }

  async function sendAcademicResearch(text: string) {
    const { finalText, visibleText } = buildPayload(text);
    const afterUser = [...msgs, { role: 'user', content: visibleText } as Msg];
    const threadId = upsertThread(afterUser, visibleText);
    setLoading(true);
    setWorkingState('research');
    setAgentOutput(null);
    try {
      setWorkingState('web');
      const sources = await getGroundingSources(text || finalText.slice(0, 220), lang, 'academic');
      setWorkingState('research');
      const researchInstruction = lang === 'ar'
        ? `حوّل الطلب التالي إلى بحث جامعي احترافي ومنظم. استخدم المصادر المختصرة فقط للحقائق الخارجية، واستشهد داخل النص بالأرقام [1] [2]. المطلوب: عنوان واضح، ملخص، مقدمة، محاور رئيسية بعناوين، نقاط تحليلية، خاتمة، وقائمة مراجع مختصرة. لا تخترع مصادر. لو المصادر غير كافية قل ذلك بوضوح.

الطلب:
${finalText}${sourceContext(sources, lang)}`
        : `Turn the following request into a professional university-style research report. Use only the compact sources for external facts and cite with [1] [2]. Include: clear title, abstract, introduction, main sections with headings, analytical points, conclusion, and short references. Do not invent sources. If sources are insufficient, say so clearly.

Request:
${finalText}${sourceContext(sources, lang)}`;
      const token = await getAccessToken();
      const r = await fetch('/api/qalvero-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: researchInstruction, history: msgs, model: 'QLO 1.2 Study', mode: 'Study coach', language: lang, grounded: sources.length > 0, output: 'academic_research', userAi: loadLocalUserAi(false) })
      });
      const data = await r.json();
      const rawReply = data.reply || data.error || copy.empty;
      const reply = looksLikeNoProvider(rawReply) ? copy.noProviders : rawReply;
      if (!r.ok) setError(reply);
      const html = buildAcademicHtml(text, reply, sources, lang);
      setAgentOutput({ rawText: reply, html, type: 'research', fileBase: 'qalvero-academic-research' });
      await animateReply(threadId, afterUser, `${copy.researchReady}

${reply}`.slice(0, 9000), sources);
      void queueTrainingExample({ prompt: visibleText, response: reply, route: 'academic_research', model: 'QLO 1.2 Study', task: 'research', sources });
    } catch {
      setError(copy.backendDown);
      await animateReply(threadId, afterUser, copy.backendDown);
    } finally {
      setLoading(false);
      setAttachments([]);
    }
  }

  async function sendAgent(text: string) {
    if (usedAgents >= maxAgents) { setError(copy.agentBlocked); return; }
    const { finalText, visibleText } = buildPayload(text);
    const afterUser = [...msgs, { role: 'user', content: visibleText } as Msg];
    const threadId = upsertThread(afterUser, visibleText);
    setLoading(true); setWorkingState('agent'); setAgentOutput(null); setApkBuild({ loading: false, message: '' });
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/qlo-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt: finalText, files: attachments, language: lang, creditMode: 'smart', output: 'jsx', userAi: loadLocalUserAi(true) })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || copy.backendDown);
      incrementAgentUsage(plan);
      setAgentOutput({ rawText: data.rawText || '', html: data.html || '', jsx: data.jsx || '', plan: data.plan, creditMode: data.creditMode, packageHint: data.packageHint });
      await animateReply(threadId, afterUser, `${copy.agentReady}\n\n${data.rawText || ''}`.slice(0, 9000));
      void queueTrainingExample({ prompt: visibleText, response: data.rawText || '', route: 'agent', model: 'QLO 1.3 Agent', task: data.template || 'project_build' });
    } catch (err: any) {
      const msg = err?.message || copy.backendDown;
      setError(msg);
      await animateReply(threadId, afterUser, msg);
    } finally { setLoading(false); setAttachments([]); }
  }

  async function send() {
    const text = input.trim();
    // Hard single-flight guard: React state is async, so a fast double-tap/Enter could start two requests.
    // This ref blocks duplicate sends before loading state updates.
    if ((!text && attachments.length === 0) || loading || sendingRef.current) return;
    sendingRef.current = true;
    setInput(''); setError(''); setMemoryNotice('');
    const safeText = text || (attachments.length ? (lang === 'ar' ? 'حلل الملفات المرفقة ونفّذ المطلوب المناسب.' : 'Analyze the attached files and do the suitable task.') : '');
    try {
      const route = decideAutoRoute(safeText, attachments, model, mode);
      if (route === 'research') {
        setModel('QLO 1.2 Study');
        setMode('Study coach');
        setMemoryNotice(copy.autoResearch);
        await sendAcademicResearch(safeText || (lang === 'ar' ? 'اعمل بحث جامعي من الملفات المرفقة.' : 'Create an academic research report from the attached files.'));
        return;
      }
      if (route === 'agent') {
        setModel('QLO 1.3 Agent');
        setMemoryNotice(copy.autoAgent);
        await sendAgent(safeText || (lang === 'ar' ? 'حلل الملفات المرفقة وابني الناتج المناسب.' : 'Analyze the attached files and build the suitable output.'));
        return;
      }
      if (route === 'study') {
        setModel('QLO 1.2 Study');
        setMode('Study coach');
        setMemoryNotice(copy.autoStudy);
        await sendChat(safeText || (lang === 'ar' ? 'اشرح الملفات المرفقة بشكل مبسط.' : 'Explain the attached files simply.'), 'QLO 1.2 Study', 'Study coach');
        return;
      }
      if (route === 'pro') {
        const routeModel = loggedIn ? 'QLO 1.3 Pro' : 'QLO 1.2 Flash';
        setModel(routeModel);
        if (loggedIn) setMemoryNotice(copy.autoPro);
        await sendChat(safeText || (lang === 'ar' ? 'حلل الملفات المرفقة.' : 'Analyze the attached files.'), routeModel, mode);
        return;
      }
      await sendChat(safeText || (lang === 'ar' ? 'حلل الملفات المرفقة.' : 'Analyze the attached files.'));
    } finally {
      sendingRef.current = false;
    }
  }

  function selectCard(prompt: string, nextMode: string) {
    setMode(nextMode);
    if (prompt) setInput(prompt);
    if (nextMode === 'Business planner' && prompt.toLowerCase().includes('jsx')) setModel('QLO 1.3 Agent');
    textareaRef.current?.focus();
  }

  function printAgentPdf() {
    if (!agentOutput?.html) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(agentOutput.html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }


  async function buildApkFromAgentOutput() {
    if (!agentOutput || agentOutput.type === 'research') return;
    setApkBuild({ loading: true, message: copy.buildingApk });
    try {
      const zip = agentProjectZipBlob(agentOutput);
      const zipBase64 = await blobToBase64(zip);
      const r = await fetch('/api/qlo-apk-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipBase64, projectName: agentOutput.fileBase || 'qalvero-agent-project' })
      });
      const data = await r.json();
      if (data?.ok && data?.mode === 'cloud-build') {
        setApkBuild({ loading: false, message: data.message || copy.apkBuildStarted, logUrl: data.logUrl, outputUri: data.outputUri });
      } else if (data?.ok) {
        setApkBuild({ loading: false, message: data.message || copy.apkBuilderLocal, outputUri: data.outputUri || data.sourceUri });
      } else {
        setApkBuild({ loading: false, message: data?.error || copy.apkBuilderLocal });
      }
    } catch {
      setApkBuild({ loading: false, message: copy.apkBuilderLocal });
    }
  }

  return (
    <section className="qlo-chat-shell mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col">
      <div className="flex items-center justify-between px-1 py-2 md:py-3">
        <div className="text-sm font-bold soft-text">{loggedIn ? `${planName(profile?.plan)} · ${copy.agentLimit}: ${usedAgents}/${maxAgents}` : copy.guestHint}</div>
        <button onClick={newChat} className="qlo-mini-btn">{copy.startNew}</button>
      </div>

      <div className="qlo-chat-scroll flex-1">
        {msgs.length === 0 ? (
          <div className="qlo-empty-state grid min-h-[58vh] place-items-center pb-8 pt-7 text-center md:pb-14 md:pt-14">
            <div className="w-full">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black soft-text"><Brain size={16} className="text-[var(--accent-1)]" /> <span>Qalvero AI</span></div>
              <h1 className="mt-7 text-4xl font-black leading-tight md:text-6xl">{copy.intro} <span className="grad">QLO</span></h1>
              <p className="mx-auto mt-4 max-w-xl text-lg soft-text md:text-2xl">{copy.subtitle}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold soft-text"><Zap size={14} /> {copy.creditSaver}</div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold soft-text"><Bot size={14} /> {copy.autoMode}</div>
              </div>
              <div className="mt-9 grid gap-3 sm:grid-cols-2 md:gap-4">
                {copy.cards.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => selectCard(item.prompt, item.mode)} className="qlo-action-card text-start"><span className="qlo-action-icon"><Icon className="h-5 w-5" /></span><span><span className="block text-lg font-black md:text-xl">{item.title}</span><span className="mt-1 block text-sm soft-text">{item.desc}</span></span></button>; })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-6 pt-3 md:pt-6">
            {msgs.map((m, i) => { const key = `${activeId}-${i}`; const rating = ratings[key]; return (
              <div key={i} className={`message-row flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div>
                  <div dir="auto" className={`qlo-message ${m.role === 'user' ? 'qlo-user-message' : 'qlo-ai-message'} qlo-message-animate`}><div className="markdownish whitespace-pre-wrap text-[15px] leading-7">{m.content || (typing && i === msgs.length - 1 ? <span className="typing-cursor">▋</span> : '')}</div></div>
                  {m.role === 'assistant' && m.sources?.length ? (
                    <div className="qlo-sources mt-2">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black soft-text"><Globe2 size={13} /> {copy.sourcesTitle}</div>
                      <div className="grid gap-2">
                        {m.sources.map((src, idx) => (
                          <a key={`${src.url}-${idx}`} href={src.url} target="_blank" rel="noreferrer" className="qlo-source-link">
                            <span className="qlo-source-index">{idx + 1}</span>
                            <span className="min-w-0"><span className="block truncate font-bold">{src.title}</span><span className="block truncate text-[11px] opacity-70">{src.domain}</span></span>
                            <ExternalLink size={13} />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className={`mt-1 flex gap-1 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <button onClick={() => handleCopy(i)} className="message-btn" aria-label={lang === 'ar' ? 'نسخ' : 'Copy'}><Copy size={14} /></button>
                    {m.role === 'assistant' && <><button onClick={() => handleRate(i, 'like')} className={`message-btn ${rating === 'like' ? 'active' : ''}`} aria-label={lang === 'ar' ? 'إعجاب' : 'Like'}><ThumbsUp size={14} /></button><button onClick={() => handleRate(i, 'dislike')} className={`message-btn ${rating === 'dislike' ? 'active' : ''}`} aria-label={lang === 'ar' ? 'عدم الإعجاب' : 'Dislike'}><ThumbsDown size={14} /></button></>}
                  </div>
                </div>
              </div>
            ); })}
            {typing && (
              <div className="flex justify-start">
                <div className={`qlo-thinking-card qlo-thinking-${workingState}`}>
                  {workingState === 'web' ? <Search size={16} /> : workingState === 'agent' ? <Bot size={16} /> : workingState === 'research' ? <FileText size={16} /> : workingState === 'study' ? <BookOpenCheck size={16} /> : workingState === 'pro' ? <Code2 size={16} /> : <Loader2 size={16} className="qlo-spin" />}
                  <span>{workingLabels[workingState]}</span>
                  <span className="qlo-dots"><i></i><i></i><i></i></span>
                </div>
              </div>
            )}
            {agentOutput && (
              <div className="panel rounded-[2rem] p-4 md:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-black">{agentOutput.type === 'research' ? <FileText className="text-[var(--accent-1)]" /> : <FileCode2 className="text-[var(--accent-1)]" />} {agentOutput.type === 'research' ? copy.researchPreview : copy.preview}</div>
                    <div className="mt-1 text-xs soft-text">{copy.agentToolsList}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-soft" onClick={() => downloadFile(`${agentOutput.fileBase || 'qlo-agent-output'}.txt`, agentOutput.rawText, 'text/plain')}><Download size={15} /> {copy.downloadRaw}</button>
                    {agentOutput.type !== 'research' && agentOutput.jsx && <button className="btn btn-soft" onClick={() => downloadFile('QalveroAgentApp.jsx', agentOutput.jsx || '', 'text/jsx')}><Code2 size={15} /> {copy.downloadJsx}</button>}
                    <button className="btn btn-soft" onClick={() => downloadFile(`${agentOutput.fileBase || 'qlo-agent-preview'}.html`, agentOutput.html, 'text/html')}><Play size={15} /> {copy.downloadHtml}</button>
                    <button className="btn btn-soft" onClick={() => downloadOfficeExport(agentOutput, 'docx')}><FileText size={15} /> {copy.downloadDocx}</button>
                    <button className="btn btn-soft" onClick={() => downloadOfficeExport(agentOutput, 'xlsx')}><FileText size={15} /> {copy.downloadXlsx}</button>
                    <button className="btn btn-soft" onClick={() => downloadOfficeExport(agentOutput, 'pptx')}><FileText size={15} /> {copy.downloadPptx}</button>
                    {agentOutput.type !== 'research' && <button className="btn btn-soft" onClick={() => downloadAgentZip(agentOutput)}><PackageCheck size={15} /> {copy.downloadZip}</button>}
                    {agentOutput.type !== 'research' && <button className="btn btn-soft" onClick={buildApkFromAgentOutput} disabled={apkBuild.loading}><PackageCheck size={15} /> {apkBuild.loading ? copy.buildingApk : copy.buildApk}</button>}
                    <button className="btn btn-primary" onClick={printAgentPdf}><Printer size={15} /> {copy.printPdf}</button>
                  </div>
                  {apkBuild.message && <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-xs soft-text">{apkBuild.message}{apkBuild.logUrl && <a className="ms-2 underline" href={apkBuild.logUrl} target="_blank" rel="noreferrer">Build log</a>}{apkBuild.outputUri && <span className="ms-2 font-mono">{apkBuild.outputUri}</span>}</div>}
                </div>
                <iframe title="QLO Agent Preview" srcDoc={agentOutput.html} className="h-[420px] w-full rounded-[1.5rem] border border-white/10 bg-white" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 safe-bottom pt-3">
        {(error || memoryNotice) && <div className="mb-3 rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm soft-text">{memoryNotice || error}</div>}
        {attachments.length > 0 && <div className="mb-3 flex flex-wrap gap-2 px-1">{attachments.map((att, idx) => <div key={idx} className="attachment-tag"><span className="max-w-[10rem] truncate">{att.name}</span><span className="text-[10px] opacity-60">{Math.ceil(att.size / 1024)}KB</span><button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500"><X size={14} /></button></div>)}</div>}

        <div className="qlo-smart-suggestions mb-2">
          <div className="qlo-suggestions-title"><Sparkles size={13} /> {copy.suggestionsTitle}</div>
          <div className="qlo-suggestions-scroll">
            {composerSuggestions.map((item) => (
              <button key={item.en} type="button" className="qlo-suggestion-chip" onClick={() => setInput(lang === 'ar' ? item.promptAr : item.promptEn)}>
                {lang === 'ar' ? item.ar : item.en}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`qlo-composer ${dragActive ? 'qlo-composer-drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={async (e) => { e.preventDefault(); setDragActive(false); await processFiles(Array.from(e.dataTransfer.files || []) as File[]); }}
        >
          <div className="flex items-end gap-2">
            <textarea ref={textareaRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={selectedIsAgent ? (lang === 'ar' ? 'اطلب من Agent يبني مشروع أو ملف JSX...' : 'Ask Agent to build a project or JSX file...') : t.placeholder} className="qlo-input" />
            <input id="qv-file-input" type="file" multiple accept={ACCEPTED_FILE_TYPES} className="hidden" onChange={onFileChange} />
            <button onClick={() => document.getElementById('qv-file-input')?.click()} className="qlo-icon-btn" aria-label={lang === 'ar' ? 'إرفاق ملف' : 'Attach file'}><Paperclip size={20} /></button>
            <button onClick={() => setShowSettings((v) => !v)} className="qlo-icon-btn" aria-label={copy.settings}><SlidersHorizontal size={20} /></button>
            <button onClick={send} disabled={loading || (!input.trim() && attachments.length === 0)} className="qlo-send-btn" aria-label={t.send}><Send size={20} /></button>
          </div>
          {showSettings && <div className="qlo-composer-settings">
            <div className="qlo-model-picker">
              <span className="qlo-setting-label">{copy.model}</span>
              <button type="button" className={`qlo-model-current qlo-model-${selectedModel.tone}`} onClick={() => setModelMenuOpen((v) => !v)}>
                <span className="qlo-model-main"><strong>{selectedModel.name}</strong><em>{selectedModel.badge}</em></span>
                <small>{selectedModel.desc[lang === 'ar' ? 'ar' : 'en']}</small>
              </button>
              {modelMenuOpen && (
                <div className="qlo-model-menu">
                  {availableModels.map((m) => (
                    <button key={m.id} type="button" className={`qlo-model-option ${m.id === model ? 'active' : ''} qlo-model-${m.tone}`} onClick={() => chooseModel(m.id)}>
                      <span className="qlo-model-main"><strong>{m.name}</strong><em>{m.badge}</em></span>
                      <small>{m.desc[lang === 'ar' ? 'ar' : 'en']}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="qlo-select-wrap"><span>{copy.mode}</span><select value={mode} onChange={(e) => setMode(e.target.value)}>{modes.map((m) => <option key={m.id} value={m.id}>{m.label[lang === 'ar' ? 'ar' : 'en']}</option>)}</select></label>
            {selectedIsAgent && <div className="md:col-span-2">
              <div className="mb-2 text-xs font-black soft-text">{lang === 'ar' ? 'أفكار سريعة جاهزة للتنفيذ' : 'Quick build ideas'}</div>
              <div className="flex flex-wrap gap-2">
                {agentQuickTemplates.map((tpl) => (
                  <button
                    key={tpl.en}
                    className="qlo-template-chip"
                    onClick={() => setInput(lang === 'ar' ? tpl.promptAr : tpl.promptEn)}
                    type="button"
                  >
                    {lang === 'ar' ? tpl.ar : tpl.en}
                  </button>
                ))}
              </div>
            </div>}
          </div>}
        </div>
      </div>
    </section>
  );
}
