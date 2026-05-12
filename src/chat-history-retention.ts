type StoredRole = 'user' | 'assistant';
type StoredMessage = { role: StoredRole; content: string };
type StoredThread = {
  id: string;
  title: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt?: string;
  model?: string;
  mode?: string;
  storagePolicy?: 'text-only-monthly';
};

const HISTORY_KEY = 'qv_threads';
const HISTORY_META_KEY = 'qv_threads_meta';
const ACTIVE_THREAD_KEY = 'qv_active_thread_id';
const RETENTION_DAYS = 30;
const MAX_THREADS = 60;
const MAX_MESSAGES_PER_THREAD = 80;
const MAX_MESSAGE_CHARS = 12000;

function asTime(value?: string) {
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) && time > 0 ? time : 0;
}

function safeText(value: unknown) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .slice(0, MAX_MESSAGE_CHARS)
    .trim();
}

function cleanMessage(message: any): StoredMessage | null {
  const role = message?.role === 'assistant' ? 'assistant' : message?.role === 'user' ? 'user' : null;
  const content = safeText(message?.content);
  if (!role || !content) return null;
  return { role, content };
}

function cleanThread(thread: any): StoredThread | null {
  const now = new Date().toISOString();
  const id = safeText(thread?.id) || `thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const messages = Array.isArray(thread?.messages)
    ? (thread.messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES_PER_THREAD) as StoredMessage[])
    : [];

  if (!messages.length) return null;

  const firstUser = messages.find((m) => m.role === 'user')?.content || '';
  const title = safeText(thread?.title) || firstUser.slice(0, 52) || 'محادثة جديدة';
  const createdAt = safeText(thread?.createdAt) || now;
  const updatedAt = safeText(thread?.updatedAt) || createdAt || now;

  return {
    id,
    title,
    messages,
    createdAt,
    updatedAt,
    model: safeText(thread?.model).slice(0, 80) || undefined,
    mode: safeText(thread?.mode).slice(0, 80) || undefined,
    storagePolicy: 'text-only-monthly'
  };
}

function pruneList(parsed: unknown) {
  if (!Array.isArray(parsed)) return [] as StoredThread[];
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return parsed
    .map(cleanThread)
    .filter(Boolean)
    .filter((thread) => asTime((thread as StoredThread).updatedAt || (thread as StoredThread).createdAt) >= cutoff) as StoredThread[];
}

function sortLimit(threads: StoredThread[]) {
  return threads
    .sort((a, b) => asTime(b.updatedAt || b.createdAt) - asTime(a.updatedAt || a.createdAt))
    .slice(0, MAX_THREADS);
}

function writeMeta(originalSetItem = localStorage.setItem.bind(localStorage)) {
  originalSetItem(HISTORY_META_KEY, JSON.stringify({
    strategy: 'text-only-monthly',
    retention_days: RETENTION_DAYS,
    max_threads: MAX_THREADS,
    max_messages_per_thread: MAX_MESSAGES_PER_THREAD,
    stored_content: 'text-only',
    updated_at: new Date().toISOString()
  }));
}

export function pruneQalveroChatHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const pruned = sortLimit(pruneList(parsed));
    const originalSetItem = localStorage.setItem.bind(localStorage);
    originalSetItem(HISTORY_KEY, JSON.stringify(pruned));
    writeMeta(originalSetItem);

    const active = localStorage.getItem(ACTIVE_THREAD_KEY);
    if (active && !pruned.some((thread) => thread.id === active)) {
      localStorage.removeItem(ACTIVE_THREAD_KEY);
    }

    return pruned;
  } catch {
    return [] as StoredThread[];
  }
}

function patchThreadStorage() {
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    if (key === HISTORY_META_KEY) {
      try {
        const meta = { ...JSON.parse(value || '{}'), strategy: 'text-only-monthly', retention_days: RETENTION_DAYS, stored_content: 'text-only' };
        return originalSetItem(key, JSON.stringify(meta));
      } catch {
        return originalSetItem(key, value);
      }
    }

    if (key !== HISTORY_KEY) return originalSetItem(key, value);
    try {
      const parsed = JSON.parse(value || '[]');
      const pruned = sortLimit(pruneList(parsed));
      originalSetItem(key, JSON.stringify(pruned));
      writeMeta(originalSetItem);
      return;
    } catch {
      // Keep the original write if this is not parseable JSON. LocalStorage drama avoided.
    }
    return originalSetItem(key, value);
  };
}

function startRetention() {
  patchThreadStorage();
  pruneQalveroChatHistory();
  window.addEventListener('storage', (event) => {
    if (event.key === HISTORY_KEY) pruneQalveroChatHistory();
  });
  window.setInterval(pruneQalveroChatHistory, 10 * 60 * 1000);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startRetention, { once: true });
  else startRetention();
}

export type { StoredThread };
