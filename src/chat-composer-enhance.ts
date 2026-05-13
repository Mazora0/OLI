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

function openModelMenuFromSliderButton(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('button');
  if (!button || !button.closest('.qlo-composer, .composer')) return;
  if (!button.querySelector('.lucide-sliders-horizontal')) return;

  setTimeout(() => {
    document.querySelector<HTMLButtonElement>('.qlo-model-current')?.click();
  }, 50);
}

let scheduled = false;
function scheduleEnhance() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    resizeAllTextareas();
    moveAttachmentsIntoComposer();
  });
}

function startComposerEnhance() {
  scheduleEnhance();

  document.addEventListener('input', (event) => {
    if (event.target instanceof HTMLTextAreaElement) resizeTextarea(event.target);
  }, true);

  document.addEventListener('change', scheduleEnhance, true);
  document.addEventListener('click', (event) => {
    openModelMenuFromSliderButton(event.target);
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
