const HIDDEN_CHAT_TEXT = [
  'حد Agent اليومي',
  'Agent اليومي',
  'محادثة جديدة',
  'New chat'
];

function isChatHome() {
  const text = document.body.innerText || '';
  return /Qalvero AI/i.test(text) && /اسأل|Ask|Qalvero AI/.test(text) && Boolean(document.querySelector('.qlo-composer, .composer'));
}

function looksLikeHeaderControl(node: HTMLElement) {
  const text = (node.innerText || '').trim();
  if (!text) return false;
  if (!HIDDEN_CHAT_TEXT.some((part) => text.includes(part))) return false;
  const rect = node.getBoundingClientRect();
  return rect.top < Math.min(360, window.innerHeight * 0.45) && rect.height < 90;
}

function hideChatHeaderControls() {
  if (!isChatHome()) return;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('button, a, span, div'));
  for (const node of candidates) {
    if (!looksLikeHeaderControl(node)) continue;
    const target = node.closest<HTMLElement>('button, a, .btn, [role="button"]') || node;
    target.classList.add('qlo-hide-main-chat-header-item');
    target.setAttribute('aria-hidden', 'true');
  }
}

function preventBrowserTranslate() {
  document.documentElement.setAttribute('translate', 'no');
  document.documentElement.classList.add('notranslate');
  document.body.setAttribute('translate', 'no');
  document.body.classList.add('notranslate');
  document.getElementById('root')?.setAttribute('translate', 'no');
  document.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]').forEach((node) => {
    node.setAttribute('translate', 'no');
    node.classList.add('notranslate');
  });
}

function start() {
  preventBrowserTranslate();
  hideChatHeaderControls();
  new MutationObserver(() => {
    requestAnimationFrame(() => {
      preventBrowserTranslate();
      hideChatHeaderControls();
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
