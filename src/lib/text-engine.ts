export function isArabicText(text: string) {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

export function getTextDirection(text: string): 'rtl' | 'ltr' {
  return isArabicText(text) ? 'rtl' : 'ltr';
}

export function normalizeInputText(text: string) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
}

export function cleanModelOutput(text: string) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/(^|\n)(\d+)\s*[\-–—]\s+/g, '$1$2. ')
    .replace(/(^|\n)[•●]\s+/g, '$1- ')
    .trim();
}

export function improveArabicSpacing(text: string) {
  return String(text || '')
    .replace(/\s+([،؛؟.!])/g, '$1')
    .replace(/([،؛؟.!])([^\s\n])/g, '$1 $2')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function prepareTextForSpeech(text: string) {
  return cleanModelOutput(text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_`>\[\]()]/g, '')
    .replace(/\n{2,}/g, '. ')
    .trim();
}

export function formatInstructionFor(text: string) {
  if (isArabicText(text)) {
    return 'اكتب ردًا منظمًا بنفس لغة المستخدم. استخدم فقرات قصيرة وخطوات مرقمة عند الحاجة. لا تخلط اللغات إلا للمصطلحات التقنية. استخدم Markdown صالحًا فقط.';
  }
  return 'Write a clean, organized reply in the user language. Use short paragraphs and numbered steps when useful. Use valid Markdown only.';
}
