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
    const textareaParent = composer.querySelector('textarea, .qlo-input')?.parentElement;
    composer.insertBefore(dock, textareaParent || composer.firstChild);
  }
  return dock;
}

function moveAttachmentsIntoComposer() {
  const composer = getComposers()[0];
  if (!composer) return;

  const dock = getAttachmentDock(composer);
  const attachments = Array.from(document.querySelectorAll<HTMLElement>('.attachment-tag, [data-qlo-attachment="true"]'))
    .filter((item) => !item.closest('.qlo-message, .message-bubble'));

  let count = 0;
  for (const item of attachments) {
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
