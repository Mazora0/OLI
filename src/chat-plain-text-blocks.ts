function isLikelyStructuredText(text: string) {
  const clean = text.trim();
  if (clean.length < 90) return false;
  const lines = clean.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const numbered = lines.filter((line) => /^(\d+[.)]|[-*•])\s+/.test(line)).length;
  const hasFence = /```[\s\S]*?```/.test(clean);
  const hasIndentedPlan = lines.some((line) => /^(الخطوة|Step|TODO|ملاحظة|Note|Plain text|JSON|HTML|CSS|TS|JS)/i.test(line));
  return hasFence || numbered >= 2 || hasIndentedPlan;
}

function extractFence(text: string) {
  const match = text.match(/```([\w-]+)?\n?([\s\S]*?)```/);
  if (!match) return null;
  const lang = (match[1] || 'Plain text').trim();
  return { lang: lang === 'txt' ? 'Plain text' : lang, body: match[2].trim() };
}

function makeBlock(title: string, body: string) {
  const block = document.createElement('div');
  block.className = 'qlo-copy-block';
  block.dir = 'auto';

  const head = document.createElement('div');
  head.className = 'qlo-copy-block-head';

  const label = document.createElement('div');
  label.className = 'qlo-copy-block-title';
  label.textContent = title || 'Plain text';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'qlo-copy-block-btn';
  copy.setAttribute('aria-label', 'Copy block');
  copy.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(body);
      copy.classList.add('qlo-copied');
      setTimeout(() => copy.classList.remove('qlo-copied'), 900);
    } catch {
      const area = document.createElement('textarea');
      area.value = body;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
  });

  const pre = document.createElement('pre');
  pre.className = 'qlo-copy-block-body';
  pre.textContent = body;

  head.append(copy, label);
  block.append(head, pre);
  return block;
}

function enhanceMessage(node: HTMLElement) {
  if (node.dataset.qloPlainBlockEnhanced === '1') return;
  const contentNode = node.querySelector<HTMLElement>('.markdownish') || node;
  if (contentNode.querySelector('.qlo-copy-block')) {
    node.dataset.qloPlainBlockEnhanced = '1';
    return;
  }

  const raw = contentNode.innerText || contentNode.textContent || '';
  if (!isLikelyStructuredText(raw)) return;

  const fence = extractFence(raw);
  const title = fence?.lang || 'Plain text';
  const body = fence?.body || raw.trim();
  if (!body) return;

  const block = makeBlock(title, body);

  if (fence) {
    const rest = raw.replace(/```[\w-]*\n?[\s\S]*?```/, '').trim();
    contentNode.textContent = rest;
    if (rest) contentNode.append(document.createElement('br'));
    contentNode.append(block);
  } else {
    contentNode.textContent = '';
    contentNode.append(block);
  }

  node.dataset.qloPlainBlockEnhanced = '1';
}

function enhanceAll() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('.qlo-ai-message, .message-bubble'))
    .filter((node) => !node.closest('.qlo-copy-block'));
  nodes.forEach(enhanceMessage);
}

function start() {
  enhanceAll();
  new MutationObserver(() => requestAnimationFrame(enhanceAll)).observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();

export {};
