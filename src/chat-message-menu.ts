import { cleanModelOutput, prepareTextForSpeech } from './lib/text-engine';

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
  const utterance = new SpeechSynthesisUtterance(speechText.slice(0, 3600));
  utterance.lang = /[\u0600-\u06FF]/.test(speechText) ? 'ar-EG' : 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
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
    // Share cancelled. Fine, the universe continues its pointless spin.
  }
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

  const more = makeAction(ar ? 'المزيد' : 'More', icons.more, () => copyText(cleanMessageText(message)), 'qlo-extra-more');
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
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
