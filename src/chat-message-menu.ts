function isArabicPage() {
  return document.documentElement.dir === 'rtl' || document.documentElement.lang?.startsWith('ar');
}

function cleanMessageText(message: HTMLElement) {
  const clone = message.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.qlo-message-actions,.qlo-copy-block-btn,.qlo-copy-block-head').forEach((node) => node.remove());
  return (clone.innerText || clone.textContent || '')
    .replace(/\n{4,}/g, '\n\n')
    .trim();
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
  if (!('speechSynthesis' in window)) return;
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 3600));
  utterance.lang = /[\u0600-\u06FF]/.test(text) ? 'ar-EG' : 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

async function shareText(text: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Qalvero AI', text });
    } else {
      await copyText(text);
    }
  } catch {
    // User cancelled share. Humanity survives.
  }
}

function makeIcon(path: string) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
}

const icons = {
  more: makeIcon('M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'),
  share: makeIcon('M18 16.1c-.8 0-1.5.3-2 .8L8.9 12.7a3.3 3.3 0 0 0 0-1.4L16 7.1a3 3 0 1 0-1-1.8L7.9 9.5a3 3 0 1 0 0 5l7.1 4.2a3 3 0 1 0 3-2.6Z'),
  speak: makeIcon('M3 10v4h4l5 5V5L7 10H3Zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-9.5v2.1a8 8 0 0 1 0 14.8v2.1a10 10 0 0 0 0-19Z'),
  down: makeIcon('M15 3H7.8a2 2 0 0 0-1.8 1.1L2.2 12a2 2 0 0 0 1.8 2.9h5.1L8.4 19a2 2 0 0 0 2 2.4h.3c.8 0 1.5-.4 1.8-1.1L16 13V5a2 2 0 0 0-2-2Zm3 0v12h4V3h-4Z'),
  up: makeIcon('M9 21h7.2a2 2 0 0 0 1.8-1.1l3.8-7.9A2 2 0 0 0 20 9.1h-5.1L15.6 5a2 2 0 0 0-2-2.4h-.3c-.8 0-1.5.4-1.8 1.1L8 11v8a2 2 0 0 0 2 2ZM6 21V9H2v12h4Z'),
  copy: makeIcon('M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z')
};

function makeAction(label: string, icon: string, onClick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'qlo-message-action';
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

function attachActions(message: HTMLElement) {
  if (message.dataset.qloActionsReady === '1') return;
  if (message.closest('.qlo-thinking-card')) return;
  if (message.classList.contains('qlo-user-message')) return;

  const text = cleanMessageText(message);
  if (!text || text.length < 2) return;

  const ar = isArabicPage();
  const actions = document.createElement('div');
  actions.className = 'qlo-message-actions';

  actions.append(
    makeAction(ar ? 'المزيد' : 'More', icons.more, () => undefined),
    makeAction(ar ? 'مشاركة' : 'Share', icons.share, () => shareText(cleanMessageText(message))),
    makeAction(ar ? 'قراءة بصوت' : 'Read aloud', icons.speak, () => speakText(cleanMessageText(message))),
    makeAction(ar ? 'عدم إعجاب' : 'Dislike', icons.down, () => message.dataset.qloFeedback = 'down'),
    makeAction(ar ? 'إعجاب' : 'Like', icons.up, () => message.dataset.qloFeedback = 'up'),
    makeAction(ar ? 'نسخ' : 'Copy', icons.copy, () => copyText(cleanMessageText(message)))
  );

  message.appendChild(actions);
  message.dataset.qloActionsReady = '1';
}

function enhanceActions() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('.qlo-ai-message, .message-bubble'))
    .filter((node) => !node.closest('.qlo-copy-block'))
    .filter((node) => !node.classList.contains('qlo-user-message'));
  candidates.forEach(attachActions);
}

function start() {
  enhanceActions();
  new MutationObserver(() => requestAnimationFrame(enhanceActions)).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
