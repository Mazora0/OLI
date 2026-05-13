import { cleanModelOutput, prepareTextForSpeech } from './lib/text-engine';

let activeMoreMenu: HTMLElement | null = null;

function isArabicPage() {
  return document.documentElement.dir === 'rtl' || document.documentElement.lang?.startsWith('ar');
}

function cleanMessageText(message: HTMLElement) {
  const clone = message.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.qlo-extra-message-actions,.qlo-copy-block-btn,.qlo-copy-block-head').forEach((node) => node.remove());
  return cleanModelOutput((clone.innerText || clone.textContent || '')
    .replace(/\n{4,}/g, '\n\n')
    .trim());
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function showToast(message: string) {
  const old = document.querySelector('.qlo-tts-warning');
  old?.remove();
  const toast = document.createElement('div');
  toast.className = 'qlo-tts-warning';
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2600);
}

function getPreferredVoice(text: string) {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const isArabic = /[\u0600-\u06FF]/.test(text);
  const normalized = voices.map((voice) => ({
    voice,
    lang: voice.lang.toLowerCase(),
    name: voice.name.toLowerCase()
  }));

  if (!isArabic) {
    return normalized.find((item) => item.lang.startsWith('en-us'))?.voice
      || normalized.find((item) => item.lang.startsWith('en'))?.voice
      || null;
  }

  /* Arabic only. No English fallback pretending to understand Arabic. */
  return normalized.find((item) => item.lang === 'ar-eg')?.voice
    || normalized.find((item) => item.lang.startsWith('ar-eg'))?.voice
    || normalized.find((item) => item.name.includes('egypt') || item.name.includes('egyptian') || item.name.includes('مصر'))?.voice
    || normalized.find((item) => item.lang.startsWith('ar-sa'))?.voice
    || normalized.find((item) => item.lang.startsWith('ar-ae'))?.voice
    || normalized.find((item) => item.lang.startsWith('ar'))?.voice
    || null;
}

function speakNow(text: string) {
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 3600));
  const isArabic = /[\u0600-\u06FF]/.test(text);
  const voice = getPreferredVoice(text);

  utterance.lang = isArabic ? 'ar-EG' : 'en-US';

  if (voice) {
    utterance.voice = voice;
  } else if (isArabic) {
    /* If device has no Arabic voices, don't humiliate the app with English TTS. */
    showToast(isArabicPage() ? 'لا يوجد صوت عربي مناسب على هذا الجهاز.' : 'No Arabic voice is available on this device.');
    return;
  }

  utterance.rate = isArabic ? 0.94 : 1;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function speakText(text: string) {
  const speechText = prepareTextForSpeech(text);
  if (!('speechSynthesis' in window)) {
    copyText(speechText);
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    speakNow(speechText);
    return;
  }

  const speakAfterVoicesLoad = () => {
    window.speechSynthesis.removeEventListener('voiceschanged', speakAfterVoicesLoad);
    speakNow(speechText);
  };

  window.speechSynthesis.addEventListener('voiceschanged', speakAfterVoicesLoad);

  window.setTimeout(() => {
    window.speechSynthesis.removeEventListener('voiceschanged', speakAfterVoicesLoad);
    if (!window.speechSynthesis.speaking) speakNow(speechText);
  }, 700);
}

async function shareText(text: string) {
  const clean = cleanModelOutput(text);
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Qalvero AI', text: clean });
    } else {
      await copyText(clean);
    }
  } catch {
    // cancelled
  }
}

function closeMoreMenu() {
  activeMoreMenu?.remove();
  activeMoreMenu = null;
}

function makeIcon(path: string) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
}

const icons = {
  more: makeIcon('M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'),
  share: makeIcon('M18 16.1c-.8 0-1.5.3-2 .8L8.9 12.7a3.3 3.3 0 0 0 0-1.4L16 7.1a3 3 0 1 0-1-1.8L7.9 9.5a3 3 0 1 0 0 5l7.1 4.2a3 3 0 1 0 3-2.6Z'),
  speak: makeIcon('M3 10v4h4l5 5V5L7 10H3Zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-9.5v2.1a8 8 0 0 1 0 14.8v2.1a10 10 0 0 0 0-19Z'),
  copy: makeIcon('M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z')
};

function makeAction(label: string, icon: string, onClick: () => void, extraClass: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `qlo-extra-message-action ${extraClass}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = icon;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
    button.classList.add('qlo-action-done');
    setTimeout(() => button.classList.remove('qlo-action-done'), 700);
  });
  return button;
}

function makeMenuButton(label: string, icon: string, run: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span>${label}</span>${icon}`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMoreMenu();
    run();
  });
  return button;
}

function openMoreMenu(anchor: HTMLElement, message: HTMLElement) {
  closeMoreMenu();
  const ar = isArabicPage();
  const menu = document.createElement('div');
  menu.className = 'qlo-extra-more-menu';
  menu.dir = ar ? 'rtl' : 'ltr';
  menu.append(
    makeMenuButton(ar ? 'نسخ' : 'Copy', icons.copy, () => copyText(cleanMessageText(message))),
    makeMenuButton(ar ? 'قراءة بصوت' : 'Read aloud', icons.speak, () => speakText(cleanMessageText(message))),
    makeMenuButton(ar ? 'مشاركة' : 'Share', icons.share, () => shareText(cleanMessageText(message)))
  );
  document.body.appendChild(menu);

  const buttonRect = anchor.getBoundingClientRect();
  const rect = menu.getBoundingClientRect();
  const margin = 10;
  const left = Math.min(Math.max(buttonRect.left, margin), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(buttonRect.bottom + 8, margin), window.innerHeight - rect.height - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  activeMoreMenu = menu;
}

function findNativeActionRow(message: HTMLElement) {
  const next = message.nextElementSibling as HTMLElement | null;
  if (next && /copy|نسخ|like|إعجاب|share|مشاركة/i.test(next.innerText || next.getAttribute('aria-label') || '')) return next;
  const parent = message.parentElement;
  if (!parent) return null;
  const buttons = Array.from(parent.querySelectorAll<HTMLButtonElement>('button'));
  const native = buttons.find((button) => {
    const label = `${button.ariaLabel || ''} ${button.title || ''} ${button.innerText || ''}`;
    return /copy|نسخ|إعجاب|like|dislike|عدم/i.test(label);
  });
  return native?.parentElement || null;
}

function attachExtraActions(message: HTMLElement) {
  if (message.dataset.qloExtraActionsReady === '1') return;
  if (message.closest('.qlo-thinking-card')) return;
  if (message.classList.contains('qlo-user-message')) return;

  const text = cleanMessageText(message);
  if (!text || text.length < 2) return;

  const ar = isArabicPage();
  const row = document.createElement('div');
  row.className = 'qlo-extra-message-actions';

  const more = makeAction(ar ? 'المزيد' : 'More', icons.more, () => undefined, 'qlo-extra-more');
  more.addEventListener('click', (event) => {
    event.stopPropagation();
    openMoreMenu(more, message);
  });
  const share = makeAction(ar ? 'مشاركة' : 'Share', icons.share, () => shareText(cleanMessageText(message)), 'qlo-extra-share');
  const speak = makeAction(ar ? 'قراءة بصوت' : 'Read aloud', icons.speak, () => speakText(cleanMessageText(message)), 'qlo-extra-speak');

  row.append(more, share, speak);

  const nativeRow = findNativeActionRow(message);
  if (nativeRow && !nativeRow.querySelector('.qlo-extra-message-actions')) {
    nativeRow.prepend(row);
  } else {
    message.appendChild(row);
  }

  message.dataset.qloExtraActionsReady = '1';
}

function enhanceActions() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('.qlo-ai-message, .message-bubble'))
    .filter((node) => !node.closest('.qlo-copy-block'))
    .filter((node) => !node.classList.contains('qlo-user-message'));
  candidates.forEach(attachExtraActions);
}

function start() {
  enhanceActions();
  new MutationObserver(() => requestAnimationFrame(enhanceActions)).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    if (activeMoreMenu && event.target instanceof Element && !event.target.closest('.qlo-extra-more-menu,.qlo-extra-more')) closeMoreMenu();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMoreMenu();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
