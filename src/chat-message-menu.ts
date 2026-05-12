type MenuAction = {
  id: string;
  ar: string;
  en: string;
  run: (message: HTMLElement, text: string) => void;
};

function isArabicPage() {
  return document.documentElement.dir === 'rtl' || document.documentElement.lang?.startsWith('ar');
}

function cleanMessageText(message: HTMLElement) {
  const clone = message.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.qlo-message-menu-wrap,.qlo-message-menu,.qlo-copy-block-btn,.qlo-copy-block-head').forEach((node) => node.remove());
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

function openPlainTextModal(text: string) {
  document.querySelector('.qlo-plain-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'qlo-plain-modal';
  overlay.dir = 'auto';

  const card = document.createElement('div');
  card.className = 'qlo-plain-modal-card';

  const header = document.createElement('div');
  header.className = 'qlo-plain-modal-head';

  const title = document.createElement('strong');
  title.textContent = 'Plain text';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'qlo-plain-modal-close';
  close.textContent = '×';
  close.addEventListener('click', () => overlay.remove());

  const pre = document.createElement('pre');
  pre.className = 'qlo-plain-modal-body';
  pre.textContent = text;

  const footer = document.createElement('div');
  footer.className = 'qlo-plain-modal-actions';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = isArabicPage() ? 'نسخ' : 'Copy';
  copy.addEventListener('click', () => copyText(text));

  const done = document.createElement('button');
  done.type = 'button';
  done.textContent = isArabicPage() ? 'إغلاق' : 'Close';
  done.addEventListener('click', () => overlay.remove());

  header.append(title, close);
  footer.append(copy, done);
  card.append(header, pre, footer);
  overlay.append(card);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function speakText(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 3600));
  utterance.lang = /[\u0600-\u06FF]/.test(text) ? 'ar-EG' : 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function downloadTxt(text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `qalvero-reply-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const actions: MenuAction[] = [
  { id: 'copy', ar: 'نسخ الرد', en: 'Copy response', run: (_message, text) => copyText(text) },
  { id: 'plain', ar: 'فتح كنص عادي', en: 'Open as plain text', run: (_message, text) => openPlainTextModal(text) },
  { id: 'speak', ar: 'قراءة بصوت', en: 'Read aloud', run: (_message, text) => speakText(text) },
  { id: 'stop', ar: 'إيقاف القراءة', en: 'Stop reading', run: () => window.speechSynthesis?.cancel() },
  { id: 'download', ar: 'تحميل TXT', en: 'Download TXT', run: (_message, text) => downloadTxt(text) }
];

function closeAllMenus(except?: HTMLElement) {
  document.querySelectorAll<HTMLElement>('.qlo-message-menu-wrap.qlo-open').forEach((menu) => {
    if (menu !== except) menu.classList.remove('qlo-open');
  });
}

function attachMenu(message: HTMLElement) {
  if (message.dataset.qloMenuReady === '1') return;
  if (message.closest('.qlo-thinking-card')) return;

  const text = cleanMessageText(message);
  if (!text || text.length < 2) return;

  const wrap = document.createElement('div');
  wrap.className = 'qlo-message-menu-wrap';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'qlo-message-menu-trigger';
  trigger.setAttribute('aria-label', isArabicPage() ? 'خيارات الرسالة' : 'Message options');
  trigger.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>';

  const menu = document.createElement('div');
  menu.className = 'qlo-message-menu';

  for (const action of actions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `qlo-message-menu-item qlo-action-${action.id}`;
    item.textContent = isArabicPage() ? action.ar : action.en;
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      action.run(message, cleanMessageText(message));
      wrap.classList.remove('qlo-open');
    });
    menu.appendChild(item);
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const next = !wrap.classList.contains('qlo-open');
    closeAllMenus(wrap);
    wrap.classList.toggle('qlo-open', next);
  });

  wrap.append(trigger, menu);
  message.appendChild(wrap);
  message.dataset.qloMenuReady = '1';
}

function enhanceMenus() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('.qlo-ai-message, .message-bubble'))
    .filter((node) => !node.closest('.qlo-copy-block'))
    .filter((node) => !node.classList.contains('qlo-user-message'));
  candidates.forEach(attachMenu);
}

function start() {
  enhanceMenus();
  document.addEventListener('click', () => closeAllMenus(), true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllMenus();
  });
  new MutationObserver(() => requestAnimationFrame(enhanceMenus)).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
