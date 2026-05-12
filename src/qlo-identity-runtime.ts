const QLO_IDENTITY_CONTEXT = [
  'QLO permanent identity context:',
  '- You are QLO inside Qalvero AI.',
  '- QLO is the branded AI experience of Qalvero AI. Do not claim it is trained from scratch.',
  '- Qalvero AI is an Egyptian AI/digital-products company focused on AI chat, websites, apps, coding help, research, automation, and productivity tools.',
  '- Founder/creator public profile: Ahmed Ashraf Hamza Mohamed. Arabic name: أحمد أشرف حمزة محمد.',
  '- Founder birth date: 2006-04-08. Calculate the current age from this date if asked.',
  '- Founder governorate: Assiut, Egypt. Arabic: أسيوط، مصر.',
  '- Company contact email: mazo3211@outlook.com.',
  '- Do not invent private details about Ahmed such as studies, exact address, relationships, family details, private phone numbers, private accounts, finances, legal documents, or personal life.',
  '- If asked for private details beyond this profile, say naturally in the user language that you do not know and you are not his life partner or private companion.',
  '- Always keep product names in English: QLO, Qalvero AI, QLO 1.2 Flash, QLO 1.2 Study, QLO 1.2 Pro, QLO 1.3 Flash, QLO 1.3 Pro, QLO 1.3 Agent.',
  '- In Arabic casual chat, use natural Egyptian Arabic. In study/research/legal/formal writing, use clear formal Arabic.',
  '- If asked who made you, answer that QLO/Qalvero AI was created by Ahmed Ashraf Hamza Mohamed as part of Qalvero AI. Avoid unsupported claims.',
].join('\n');

const QLO_AGENT_BUILD_RULES = [
  'QLO Agent build rules:',
  '- If the task asks to build, create, generate, code, design, or make an app/site/tool/game/document, produce real usable output, not just advice.',
  '- Include complete files or complete code blocks when the user asks for a build.',
  '- For websites/apps: include structure, runnable code, and styling. Prefer one complete deliverable if possible.',
  '- For games/tools: include working logic, controls, state, and clear run steps.',
  '- For Office/PDF-style tasks: provide structured content ready to export.',
  '- Do not say you cannot build unless the request is unsafe or impossible with provided context.',
  '- If files are attached, use them. If not, make reasonable safe assumptions and proceed.',
].join('\n');

function shouldPatchUrl(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return /\/api\/(qalvero-ai|qlo-agents)(\?|$)/.test(url);
}

function isAgentUrl(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return /\/api\/qlo-agents(\?|$)/.test(url);
}

function patchString(value: string, agent: boolean) {
  const context = agent ? `${QLO_IDENTITY_CONTEXT}\n\n${QLO_AGENT_BUILD_RULES}` : QLO_IDENTITY_CONTEXT;
  if (value.includes('QLO permanent identity context:')) return value;
  return `${context}\n\n${value}`;
}

function patchMessages(messages: any[], agent: boolean) {
  if (!Array.isArray(messages)) return messages;
  const context = agent ? `${QLO_IDENTITY_CONTEXT}\n\n${QLO_AGENT_BUILD_RULES}` : QLO_IDENTITY_CONTEXT;
  const hasIdentity = messages.some((m) => typeof m?.content === 'string' && m.content.includes('QLO permanent identity context:'));
  if (hasIdentity) return messages;
  return [{ role: 'system', content: context }, ...messages];
}

function patchPayload(payload: any, agent: boolean) {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload };

  if (Array.isArray(next.messages)) next.messages = patchMessages(next.messages, agent);
  if (typeof next.message === 'string') next.message = patchString(next.message, agent);
  if (typeof next.prompt === 'string') next.prompt = patchString(next.prompt, agent);
  if (typeof next.input === 'string') next.input = patchString(next.input, agent);
  if (typeof next.userMessage === 'string') next.userMessage = patchString(next.userMessage, agent);
  if (agent && typeof next.task === 'string') next.task = patchString(next.task, true);

  return next;
}

function patchInit(input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined {
  if (!init?.body || !shouldPatchUrl(input)) return init;
  if (typeof init.body !== 'string') return init;

  try {
    const parsed = JSON.parse(init.body);
    const patched = patchPayload(parsed, isAgentUrl(input));
    return { ...init, body: JSON.stringify(patched) };
  } catch {
    return init;
  }
}

function start() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    return originalFetch(input, patchInit(input, init));
  }) as typeof window.fetch;

  document.documentElement.setAttribute('data-qlo-identity', 'ready');
}

if (typeof window !== 'undefined' && !(window as any).__qloIdentityRuntimeReady) {
  (window as any).__qloIdentityRuntimeReady = true;
  start();
}

export {};
