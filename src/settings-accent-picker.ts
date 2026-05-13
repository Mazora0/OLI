type AccentId = 'orange' | 'violet' | 'blue' | 'emerald';

const accentColors: Record<AccentId, string> = {
  orange: '#ff6b2c',
  violet: '#8b5cf6',
  blue: '#38bdf8',
  emerald: '#10b981'
};

const accentLabels: Record<AccentId, string> = {
  orange: 'Orange',
  violet: 'Violet',
  blue: 'Blue',
  emerald: 'Emerald'
};

function isAccentSelect(select: HTMLSelectElement) {
  const values = Array.from(select.options).map((option) => option.value);
  return ['orange', 'violet', 'blue', 'emerald'].every((value) => values.includes(value));
}

function createDot(value: AccentId, selected: boolean, select: HTMLSelectElement) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `qlo-accent-dot ${selected ? 'is-selected' : ''}`;
  button.style.setProperty('--dot-color', accentColors[value]);
  button.setAttribute('aria-label', accentLabels[value]);
  button.setAttribute('title', accentLabels[value]);
  button.innerHTML = selected ? '<span aria-hidden="true">✓</span>' : '<span aria-hidden="true"></span>';
  button.addEventListener('click', () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    window.setTimeout(enhanceAccentPicker, 0);
  });
  return button;
}

function enhanceAccentPicker() {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
  for (const select of selects) {
    if (!isAccentSelect(select)) continue;
    if (select.dataset.qloAccentEnhanced === '1') continue;

    const holder = document.createElement('div');
    holder.className = 'qlo-accent-dot-picker';
    const current = select.value as AccentId;
    (Object.keys(accentColors) as AccentId[]).forEach((value) => holder.appendChild(createDot(value, current === value, select)));

    select.dataset.qloAccentEnhanced = '1';
    select.classList.add('qlo-hidden-accent-select');
    select.insertAdjacentElement('afterend', holder);
  }
}

function start() {
  enhanceAccentPicker();
  new MutationObserver(() => requestAnimationFrame(enhanceAccentPicker)).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
