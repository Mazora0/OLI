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
  storagePolicy?: 'local-text-only';
};

const HISTORY_KEY = 'qv_threads';
const HISTORY_META_KEY = 'qv_threads_meta';
const ACTIVE_THREAD_KEY = 'qv_active_thread_id';
const CLOUD_RETENTION_DAYS = 30;
const MAX_THREADS = 120;
const MAX_MESSAGES_PER_THREAD = 120;
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
    storagePolicy: 'local-text-only'
  };
}

function cleanList(parsed: unknown) {
  if (!Array.isArray(parsed)) return [] as StoredThread[];
  return parsed.map(cleanThread).filter(Boolean) as StoredThread[];
}

function sortLimit(threads: StoredThread[]) {
  return threads
    .sort((a, b) => asTime(b.updatedAt || b.createdAt) - asTime(a.updatedAt || a.createdAt))
    .slice(0, MAX_THREADS);
}

function writeMeta(originalSetItem = localStorage.setItem.bind(localStorage)) {
  originalSetItem(HISTORY_META_KEY, JSON.stringify({
    strategy: 'local-text-only-cloud-monthly',
    local_retention: 'forever',
    local_retention_days: null,
    cloud_retention_days: CLOUD_RETENTION_DAYS,
    max_threads: MAX_THREADS,
    max_messages_per_thread: MAX_MESSAGES_PER_THREAD,
    stored_content: 'text-only',
    updated_at: new Date().toISOString()
  }));
}

export function pruneQalveroChatHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const cleaned = sortLimit(cleanList(parsed));
    const originalSetItem = localStorage.setItem.bind(localStorage);
    originalSetItem(HISTORY_KEY, JSON.stringify(cleaned));
    writeMeta(originalSetItem);

    const active = localStorage.getItem(ACTIVE_THREAD_KEY);
    if (active && !cleaned.some((thread) => thread.id === active)) {
      localStorage.removeItem(ACTIVE_THREAD_KEY);
    }

    return cleaned;
  } catch {
    return [] as StoredThread[];
  }
}

function patchThreadStorage() {
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => {
    if (key === HISTORY_META_KEY) {
      try {
        const meta = JSON.parse(value || '{}');
        return originalSetItem(key, JSON.stringify({
          ...meta,
          strategy: 'local-text-only-cloud-monthly',
          local_retention: 'forever',
          local_retention_days: null,
          cloud_retention_days: CLOUD_RETENTION_DAYS,
          stored_content: 'text-only'
        }));
      } catch {
        return originalSetItem(key, value);
      }
    }

    if (key !== HISTORY_KEY) return originalSetItem(key, value);
    try {
      const parsed = JSON.parse(value || '[]');
      const cleaned = sortLimit(cleanList(parsed));
      originalSetItem(key, JSON.stringify(cleaned));
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
