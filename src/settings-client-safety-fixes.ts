function isSettingsPage() {
  return Boolean(document.querySelector('.setting-row')) && /settings|الإعدادات/i.test(document.body.innerText || '');
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

function normalizeRetentionText() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.setting-row, .row-card, .panel, .card'));
  for (const row of rows) {
    const text = row.innerText || '';
    if (!/60|180|retention|احتفاظ|حفظ|history|سجل/i.test(text)) continue;
    for (const node of Array.from(row.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        node.textContent = node.textContent
          .replace(/180\s*(day|days|يوم)/gi, '30 يوم')
          .replace(/60\s*(day|days|يوم)/gi, '30 يوم');
      }
    }
  }
}

function patchChatMeta() {
  try {
    const raw = localStorage.getItem('qv_threads_meta');
    const meta = raw ? JSON.parse(raw) : {};
    localStorage.setItem('qv_threads_meta', JSON.stringify({
      ...meta,
      strategy: 'text-only-monthly',
      retention_days: 30,
      stored_content: 'text-only'
    }));
  } catch {
    localStorage.setItem('qv_threads_meta', JSON.stringify({
      strategy: 'text-only-monthly',
      retention_days: 30,
      stored_content: 'text-only'
    }));
  }
}

function run() {
  if (!isSettingsPage()) return;
  lockBillingCountryRow();
  normalizeRetentionText();
  patchChatMeta();
}

function start() {
  run();
  new MutationObserver(() => requestAnimationFrame(run)).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
