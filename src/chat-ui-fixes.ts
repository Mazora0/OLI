function closestButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest('button, [role="button"], select') as HTMLElement | null;
}

function isChatRoute() {
  return /\/$|\/chat|\/app/i.test(window.location.pathname || '/') || document.body.textContent?.includes('Qalvero AI');
}

function resizeTextareas() {
  document.querySelectorAll<HTMLTextAreaElement>('.qlo-composer textarea, textarea.qlo-input').forEach((textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  });
}

function markChatState() {
  document.body.classList.add('qlo-chat-polished');
  const hasUserMessages = document.querySelectorAll('.qlo-user-message, [data-role="user"], .message-bubble').length > 0;
  document.body.classList.toggle('qlo-chat-has-messages', hasUserMessages || sessionStorage.getItem('qloChatStarted') === '1');
}

function autoCloseOpenPickers() {
  document.querySelectorAll<HTMLElement>('.qlo-model-menu, [data-radix-popper-content-wrapper], [role="listbox"]').forEach((menu) => {
    menu.classList.add('qlo-auto-close-flash');
  });
}

function hideSuggestionPanels() {
  sessionStorage.setItem('qloChatStarted', '1');
  document.body.classList.add('qlo-chat-user-interacted', 'qlo-chat-has-messages');
}

function wireChatPolish() {
  if (!isChatRoute()) return;
  document.body.classList.add('qlo-chat-polished');
  resizeTextareas();
  markChatState();
}

const observer = new MutationObserver(() => {
  wireChatPolish();
});

function start() {
  wireChatPolish();
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) resizeTextareas();
  }, true);

  document.addEventListener('click', (event) => {
    const button = closestButton(event.target);
    if (!button) return;
    const text = (button.textContent || '').trim();
    const isSend = /send|ارسال|إرسال|ابعت|بعث/i.test(text) || button.querySelector('svg');
    const isSuggestion = Boolean(button.closest('.qlo-smart-suggestions, .qlo-empty-state'));
    const isPickerChoice = Boolean(button.closest('.qlo-model-menu, [role="listbox"]'));

    if (isSuggestion || isSend) {
      hideSuggestionPanels();
    }

    if (isPickerChoice) {
      setTimeout(autoCloseOpenPickers, 0);
      setTimeout(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), 40);
      setTimeout(markChatState, 80);
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target instanceof HTMLSelectElement) {
      event.target.blur();
      document.body.classList.add('qlo-chat-polished');
      setTimeout(markChatState, 30);
    }
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

export {};
