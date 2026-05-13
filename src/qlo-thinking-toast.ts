type ThinkingState = {
  id: number;
  startedAt: number;
  timer?: number;
  label?: HTMLElement;
};

let thinkingSeq = 0;
let activeThinking: ThinkingState | null = null;
let pendingFinishedDuration: number | null = null;

const MODEL_SWITCH_PATTERNS = [
  'تم تبديل الموديل',
  'تم التبديل إلى',
  'Model switched',
  'Switched to'
];

function nowSeconds(startedAt: number) {
  return Math.max(0, (Date.now() - startedAt) / 1000);
}

function formatSeconds(seconds: number) {
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

function isArabic() {
  return document.documentElement.dir === 'rtl' || document.documentElement.lang?.startsWith('ar');
}

function looksLikeModelToast(node: HTMLElement) {
  const text = (node.innerText || node.textContent || '').trim();
  if (!text || text.length > 120) return false;
  return MODEL_SWITCH_PATTERNS.some((pattern) => text.includes(pattern));
}

function autoHideModelToast() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div, span, p'));
  for (const node of candidates) {
    if (!looksLikeModelToast(node)) continue;
    if (node.dataset.qloAutoHideToast === '1') continue;

    const target = node.closest<HTMLElement>('[role="status"], .toast, .qlo-toast, .qlo-floating-toast, .fixed, .absolute') || node;
    target.dataset.qloAutoHideToast = '1';
    target.classList.add('qlo-model-switch-toast');

    window.setTimeout(() => target.classList.add('qlo-toast-leaving'), 2300);
    window.setTimeout(() => {
      target.style.display = 'none';
      target.setAttribute('aria-hidden', 'true');
    }, 2650);
  }
}

function findThinkingCards() {
  const direct = Array.from(document.querySelectorAll<HTMLElement>('.qlo-thinking-card'));
  const fuzzy = Array.from(document.querySelectorAll<HTMLElement>('[class*="thinking"], [class*="loading"], [class*="generating"]'))
    .filter((node) => {
      const text = (node.innerText || node.textContent || '').toLowerCase();
      return /thinking|يفكر|جاري|generating|searching|بحث|إنشاء/.test(text) && node.getBoundingClientRect().height > 8;
    });
  return Array.from(new Set([...direct, ...fuzzy]));
}

function ensureThinkingTimer(card: HTMLElement) {
  if (!activeThinking) {
    activeThinking = {
      id: ++thinkingSeq,
      startedAt: Date.now()
    };
  }

  card.classList.add('qlo-thinking-enhanced');
  card.dataset.qloThinkingId = String(activeThinking.id);

  let timer = card.querySelector<HTMLElement>('.qlo-live-thinking-timer');
  if (!timer) {
    timer = document.createElement('div');
    timer.className = 'qlo-live-thinking-timer';
    timer.innerHTML = `<span class="qlo-thinking-pulse" aria-hidden="true"></span><span class="qlo-thinking-label">${isArabic() ? 'يفكر' : 'Thinking'}</span><span class="qlo-thinking-time">0.0s</span>`;
    card.prepend(timer);
    activeThinking.label = timer;
  }

  const timeNode = timer.querySelector<HTMLElement>('.qlo-thinking-time');
  const update = () => {
    if (!activeThinking || !timeNode) return;
    timeNode.textContent = formatSeconds(nowSeconds(activeThinking.startedAt));
  };

  update();
  if (!activeThinking.timer) {
    activeThinking.timer = window.setInterval(update, 120);
  }
}

function finishThinkingIfGone() {
  if (!activeThinking) return;
  const stillExists = findThinkingCards().some((card) => card.dataset.qloThinkingId === String(activeThinking?.id));
  if (stillExists) return;

  const duration = nowSeconds(activeThinking.startedAt);
  if (activeThinking.timer) window.clearInterval(activeThinking.timer);
  activeThinking = null;
  pendingFinishedDuration = duration;
  window.setTimeout(attachFinishedThinkingBadge, 80);
}

function assistantMessages() {
  return Array.from(document.querySelectorAll<HTMLElement>('.qlo-ai-message, .message-bubble'))
    .filter((node) => !node.classList.contains('qlo-user-message'))
    .filter((node) => !node.closest('.qlo-thinking-card'));
}

function attachFinishedThinkingBadge() {
  if (pendingFinishedDuration == null) return;
  const messages = assistantMessages();
  const last = messages[messages.length - 1];
  if (!last || last.dataset.qloThinkingDurationReady === '1') return;

  const badge = document.createElement('div');
  badge.className = 'qlo-thinking-finished-badge';
  badge.textContent = isArabic()
    ? `تم التفكير خلال ${formatSeconds(pendingFinishedDuration)}`
    : `Thought for ${formatSeconds(pendingFinishedDuration)}`;

  last.prepend(badge);
  last.dataset.qloThinkingDurationReady = '1';
  pendingFinishedDuration = null;
}

function enhanceThinking() {
  const cards = findThinkingCards();
  if (cards.length) cards.forEach(ensureThinkingTimer);
  else finishThinkingIfGone();
  attachFinishedThinkingBadge();
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    autoHideModelToast();
    enhanceThinking();
  });
}

function start() {
  schedule();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setInterval(schedule, 500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
