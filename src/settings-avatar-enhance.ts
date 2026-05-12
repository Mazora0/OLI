function findAvatarPanel() {
  return document.querySelector<HTMLElement>('.avatar-ring')?.closest<HTMLElement>('.panel');
}

function findAvatarGrid() {
  const panels = Array.from(document.querySelectorAll<HTMLElement>('.panel'));
  return panels.find((panel) => panel.querySelector('.grid.grid-cols-3')) || null;
}

function addPencilButton() {
  const avatarRing = document.querySelector<HTMLElement>('.avatar-ring');
  if (!avatarRing || avatarRing.querySelector('.qlo-avatar-edit')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'qlo-avatar-edit';
  button.setAttribute('aria-label', 'Change avatar');
  button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M4 17.5V20h2.5L17.1 9.4l-2.5-2.5L4 17.5Zm14.8-9.9c.3-.3.3-.8 0-1.1l-1.3-1.3a.8.8 0 0 0-1.1 0l-1 1 2.5 2.5 1-1.1Z"/></svg>';
  button.addEventListener('click', () => {
    document.body.classList.toggle('qlo-avatar-picker-open');
    const grid = findAvatarGrid();
    grid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  avatarRing.appendChild(button);
}

function markSettingsPage() {
  const hasSettings = Boolean(document.querySelector('.setting-row'));
  document.body.classList.toggle('qlo-settings-page', hasSettings);
  if (hasSettings) addPencilButton();
}

function start() {
  markSettingsPage();
  new MutationObserver(markSettingsPage).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
