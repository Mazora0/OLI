let activeMenu: HTMLElement | null = null;
let longPressTimer: number | null = null;
let startX = 0;
let startY = 0;

function isArabicPage() {
  return document.documentElement.dir === 'rtl' || document.documentElement.lang?.startsWith('ar');
}

function getComposerTextarea() {
  return document.querySelector<HTMLTextAreaElement>('.qlo-input, .qlo-composer textarea, .composer textarea');
}

function cleanUserMessageText(message: HTMLElement) {
  const clone = message.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.qlo-user-longpress-menu,.qlo-user-longpress-backdrop,.qlo-message-actions,.qlo-extra-message-actions').forEach((node) => node.remove());
  return (clone.innerText || clone.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
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

function selectMessageText(message: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(message);
  selection.addRange(range);
}

function editUserMessage(message: HTMLElement) {
  const text = cleanUserMessageText(message);
  const textarea = getComposerTextarea();
  if (!textarea) {
    copyText(text);
    return;
  }

  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus({ preventScroll: false });
  textarea.setSelectionRange(text.length, text.length);

  const composer = textarea.closest<HTMLElement>('.qlo-composer, .composer');
  composer?.classList.add('qlo-editing-user-message');
  setTimeout(() => composer?.classList.remove('qlo-editing-user-message'), 1400);
  composer?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function closeMenu() {
  activeMenu?.remove();
  activeMenu = null;
  document.body.classList.remove('qlo-user-menu-open');
}

function makeIcon(path: string) {
  return `<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>`;
}

const icons = {
  copy: makeIcon('M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z'),
  select: makeIcon('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 4v2h10V7H7Zm0 4v2h10v-2H7Zm0 4v2h7v-2H7Z'),
  edit: makeIcon('M4 17.5V20h2.5L17.1 9.4l-2.5-2.5L4 17.5Zm14.8-9.9c.3-.3.3-.8 0-1.1l-1.3-1.3a.8.8 0 0 0-1.1 0l-1 1 2.5 2.5 1-1.1Z')
};

function addItem(menu: HTMLElement, label: string, icon: string, run: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'qlo-user-longpress-item';
  button.innerHTML = `<span>${label}</span>${icon}`;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenu();
    run();
  });
  menu.appendChild(button);
}

function showMenu(message: HTMLElement, x: number, y: number) {
  closeMenu();
  const ar = isArabicPage();
  const text = cleanUserMessageText(message);
  if (!text) return;

  const menu = document.createElement('div');
  menu.className = 'qlo-user-longpress-menu';
  menu.dir = ar ? 'rtl' : 'ltr';

  const time = document.createElement('div');
  time.className = 'qlo-user-longpress-time';
  time.textContent = new Date().toLocaleTimeString(ar ? 'ar-EG' : undefined, { hour: 'numeric', minute: '2-digit' });
  menu.appendChild(time);

  addItem(menu, ar ? 'نسخ' : 'Copy', icons.copy, () => copyText(text));
  addItem(menu, ar ? 'تحديد نص' : 'Select text', icons.select, () => selectMessageText(message));
  addItem(menu, ar ? 'تحرير الرسالة' : 'Edit message', icons.edit, () => editUserMessage(message));

  document.body.appendChild(menu);
  document.body.classList.add('qlo-user-menu-open');

  const rect = menu.getBoundingClientRect();
  const margin = 12;
  const left = Math.min(Math.max(x - rect.width / 2, margin), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(y - rect.height - 12, margin), window.innerHeight - rect.height - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  activeMenu = menu;
}

function getUserMessageFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('.qlo-user-message, [data-role="user"] .message-bubble, .message-bubble.qlo-user-message');
}

function clearLongPressTimer() {
  if (longPressTimer !== null) {
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function start() {
  document.addEventListener('contextmenu', (event) => {
    const message = getUserMessageFromTarget(event.target);
    if (!message) return;
    event.preventDefault();
    showMenu(message, event.clientX, event.clientY);
  });

  document.addEventListener('touchstart', (event) => {
    const message = getUserMessageFromTarget(event.target);
    if (!message) return;
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    clearLongPressTimer();
    longPressTimer = window.setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(18);
      showMenu(message, startX, startY);
    }, 480);
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - startX);
    const dy = Math.abs(touch.clientY - startY);
    if (dx > 12 || dy > 12) clearLongPressTimer();
  }, { passive: true });

  document.addEventListener('touchend', clearLongPressTimer, { passive: true });
  document.addEventListener('touchcancel', clearLongPressTimer, { passive: true });

  document.addEventListener('click', (event) => {
    if (activeMenu && event.target instanceof Element && !event.target.closest('.qlo-user-longpress-menu')) closeMenu();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
