const MAX_INPUT_HEIGHT = 156;
const MIN_INPUT_HEIGHT = 44;

function getTextareas() {
  return Array.from(document.querySelectorAll<HTMLTextAreaElement>('.qlo-input, .qlo-composer textarea, .composer textarea'));
}

function getComposers() {
  return Array.from(document.querySelectorAll<HTMLElement>('.qlo-composer, .composer'));
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  const composer = textarea.closest<HTMLElement>('.qlo-composer, .composer');
  textarea.style.height = 'auto';
  const height = Math.max(MIN_INPUT_HEIGHT, Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT));
  textarea.style.height = `${height}px`;
  textarea.style.overflowY = textarea.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  composer?.style.setProperty('--qlo-input-current-height', `${height}px`);
}

function resizeAllTextareas() {
  getTextareas().forEach(resizeTextarea);
}

function getAttachmentDock(composer: HTMLElement) {
  let dock = composer.querySelector<HTMLElement>('.qlo-attachment-dock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'qlo-attachment-dock';
    const textarea = composer.querySelector('textarea, .qlo-input');
    const textareaParent = textarea?.parentElement;
    composer.insertBefore(dock, textareaParent || textarea || composer.firstChild);
  }
  return dock;
}

function clickHiddenFileClear(composer: HTMLElement) {
  const fileInput = composer.querySelector<HTMLInputElement>('input[type="file"]') || document.querySelector<HTMLInputElement>('input[type="file"]');
  if (fileInput) {
    fileInput.value = '';
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function removeAttachment(item: HTMLElement, composer: HTMLElement) {
  item.remove();
  clickHiddenFileClear(composer);
  composer.classList.remove('qlo-composer-has-attachment');
  const dock = composer.querySelector<HTMLElement>('.qlo-attachment-dock');
  if (dock) dock.hidden = true;
  window.dispatchEvent(new CustomEvent('qlo:attachment-cleared'));
}

function ensureRemoveButton(item: HTMLElement, composer: HTMLElement) {
  if (item.querySelector('.qlo-attachment-remove')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'qlo-attachment-remove';
  button.setAttribute('aria-label', document.documentElement.dir === 'rtl' ? 'إلغاء الملف' : 'Remove file');
  button.title = button.getAttribute('aria-label') || 'Remove file';
  button.innerHTML = '×';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeAttachment(item, composer);
  });
  item.appendChild(button);
}

function moveAttachmentsIntoComposer() {
  const composer = getComposers()[0];
  if (!composer) return;

  const dock = getAttachmentDock(composer);
  const attachments = Array.from(document.querySelectorAll<HTMLElement>('.attachment-tag, [data-qlo-attachment="true"]'))
    .filter((item) => !item.closest('.qlo-message, .message-bubble'));

  let count = 0;
  for (const item of attachments) {
    item.classList.add('qlo-inline-attachment');
    ensureRemoveButton(item, composer);
    if (!composer.contains(item)) dock.appendChild(item);
    count += 1;
  }

  dock.hidden = count === 0;
  composer.classList.toggle('qlo-composer-has-attachment', count > 0);
}

function modelIconSvg() {
  return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm0 3.2a6.8 6.8 0 0 1 5.7 3.1h-4.1a9.9 9.9 0 0 0-1.1-3.05c-.17-.03-.34-.05-.5-.05Zm-1.7.35A8 8 0 0 1 11.4 8.3H7.15a6.84 6.84 0 0 1 3.15-2.75ZM5.35 10h6.05c.04.65.04 1.35 0 2H5.05A6.56 6.56 0 0 1 5.35 10Zm1.8 5.7h4.25a8 8 0 0 1-1.1 2.75 6.84 6.84 0 0 1-3.15-2.75Zm4.85 3.1c.16 0 .33-.02.5-.05a9.9 9.9 0 0 0 1.1-3.05h4.1a6.8 6.8 0 0 1-5.7 3.1Zm6.65-6.8H13.6c.04-.65.04-1.35 0-2h5.05a6.56 6.56 0 0 1 0 2Z"/></svg>';
}

function enhanceModelButton() {
  const composer = getComposers()[0];
  if (!composer) return;
  const buttons = Array.from(composer.querySelectorAll<HTMLButtonElement>('button'));
  const sliderButton = buttons.find((button) => button.querySelector('.lucide-sliders-horizontal'));
  if (!sliderButton || sliderButton.dataset.qloDirectModelButton === '1') return;

  sliderButton.dataset.qloDirectModelButton = '1';
  sliderButton.classList.add('qlo-direct-model-button');
  sliderButton.setAttribute('aria-label', document.documentElement.dir === 'rtl' ? 'اختيار الموديل' : 'Choose model');
  sliderButton.title = sliderButton.getAttribute('aria-label') || 'Choose model';
  sliderButton.innerHTML = modelIconSvg();
}

function openModelMenuFromDirectButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('button.qlo-direct-model-button');
  if (!button || !button.closest('.qlo-composer, .composer')) return;

  setTimeout(() => {
    const current = document.querySelector<HTMLButtonElement>('.qlo-model-current');
    current?.click();
  }, 35);
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    resizeAllTextareas();
    moveAttachmentsIntoComposer();
    enhanceModelButton();
  });
}

function startComposerEnhance() {
  scheduleEnhance();

  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) resizeTextarea(event.target);
  }, true);

  document.addEventListener('change', scheduleEnhance, true);
  document.addEventListener('click', (event) => {
    openModelMenuFromDirectButton(event.target);
    setTimeout(scheduleEnhance, 80);
  }, true);

  window.addEventListener('resize', scheduleEnhance, { passive: true });

  new MutationObserver(scheduleEnhance).observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startComposerEnhance, { once: true });
} else {
  startComposerEnhance();
}

export {};
