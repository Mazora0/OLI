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

function findSettingRow(labels: string[]) {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.setting-row, .row-card'));
  return rows.find((row) => labels.some((label) => (row.innerText || '').toLowerCase().includes(label.toLowerCase()))) || null;
}

function lockBillingCountryRow() {
  const row = findSettingRow(['بلد الفوترة', 'billing country']);
  if (!row || row.dataset.qloCountryLocked === '1') return;
  const select = row.querySelector<HTMLSelectElement>('select');
  if (!select) return;
  const selected = select.selectedOptions?.[0]?.textContent || select.value;
  const badge = document.createElement('span');
  badge.className = 'qlo-fixed-country-badge';
  badge.textContent = selected;
  badge.title = document.documentElement.dir === 'rtl'
    ? 'يتم اختيار البلد مرة واحدة عند إنشاء الحساب'
    : 'Country is selected once during signup';
  select.replaceWith(badge);
  row.dataset.qloCountryLocked = '1';
}

function normalizeChatRetentionMeta() {
  try {
    const raw = localStorage.getItem('qv_threads_meta');
    const meta = raw ? JSON.parse(raw) : {};
    localStorage.setItem('qv_threads_meta', JSON.stringify({
      ...meta,
      strategy: 'local-text-only-cloud-monthly',
      local_retention: 'forever',
      local_retention_days: null,
      cloud_retention_days: 30,
      stored_content: 'text-only'
    }));
  } catch {
    localStorage.setItem('qv_threads_meta', JSON.stringify({
      strategy: 'local-text-only-cloud-monthly',
      local_retention: 'forever',
      local_retention_days: null,
      cloud_retention_days: 30,
      stored_content: 'text-only'
    }));
  }
}

function markSettingsPage() {
  const hasSettings = Boolean(document.querySelector('.setting-row'));
  document.body.classList.toggle('qlo-settings-page', hasSettings);
  if (hasSettings) {
    addPencilButton();
    lockBillingCountryRow();
    normalizeChatRetentionMeta();
  }
}

function start() {
  markSettingsPage();
  new MutationObserver(markSettingsPage).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
