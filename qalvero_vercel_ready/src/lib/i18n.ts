export type Lang='en'|'ar'|'fr'|'es'|'de'|'tr'|'ja';
export const languages=[['en','English 🇺🇸'],['ar','عربي مصري 🇪🇬'],['fr','Français 🇫🇷'],['es','Español 🇪🇸'],['de','Deutsch 🇩🇪'],['tr','Türkçe 🇹🇷'],['ja','日本語 🇯🇵']] as const;
const t:any={
 en:{newChat:'New chat',pricing:'Pricing',products:'Products',dashboard:'Dashboard',login:'Login',signup:'Create account',settings:'Settings',model:'Model',send:'Send',placeholder:'Ask QLO 1.2 anything...',welcome:'What can QLO 1.2 help with today?',sub:'AI assistant by Qalvero for productivity, learning, writing, planning, and daily tools.',upgrade:'Upgrade plan',free:'Free',standard:'Standard',premium:'Premium',country:'Country',theme:'Theme',language:'Language',logout:'Logout'},
 ar:{newChat:'محادثة جديدة',pricing:'الخطط',products:'المنتجات',dashboard:'لوحة الحساب',login:'تسجيل الدخول',signup:'إنشاء حساب',settings:'الإعدادات',model:'الموديل',send:'إرسال',placeholder:'اسأل QLO 1.2 أي حاجة...',welcome:'تحب QLO 1.2 يساعدك في إيه؟',sub:'مساعد Qalvero للانتاجية، الدراسة، الكتابة، التخطيط، والأدوات اليومية.',upgrade:'ترقية الخطة',free:'مجاني',standard:'ستاندرد',premium:'بريميوم',country:'البلد',theme:'المظهر',language:'اللغة',logout:'خروج'},
 fr:{welcome:'Comment QLO 1.2 peut-il aider ?',placeholder:'Demandez à QLO 1.2...',send:'Envoyer',login:'Connexion',signup:'Créer un compte'},
 es:{welcome:'¿Cómo puede ayudar QLO 1.2?',placeholder:'Pregunta a QLO 1.2...',send:'Enviar',login:'Entrar',signup:'Crear cuenta'},
 de:{welcome:'Wie kann QLO 1.2 helfen?',placeholder:'Frage QLO 1.2...',send:'Senden',login:'Anmelden',signup:'Konto erstellen'},
 tr:{welcome:'QLO 1.2 nasıl yardımcı olabilir?',placeholder:'QLO 1.2’ye sor...',send:'Gönder',login:'Giriş',signup:'Hesap oluştur'},
 ja:{welcome:'QLO 1.2に何を頼みますか？',placeholder:'QLO 1.2に質問...',send:'送信',login:'ログイン',signup:'アカウント作成'}
};
export function tr(lang:Lang,key:string){return t[lang]?.[key]||t.en[key]||key}
