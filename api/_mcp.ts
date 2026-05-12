export type JsonRpcRequest = { jsonrpc?: '2.0'; id?: string | number | null; method?: string; params?: any };
export type McpContent = { type: 'text'; text: string } | { type: 'json'; json: any };
export type McpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, any>;
};
export type McpResource = { uri: string; name: string; description?: string; mimeType?: string };
export type McpPrompt = { name: string; description: string; arguments?: { name: string; description?: string; required?: boolean }[] };

const PROTOCOL_VERSION = process.env.QLO_MCP_PROTOCOL_VERSION || '2025-06-18';

function jsonResponse(id: JsonRpcRequest['id'], result: any) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function jsonError(id: JsonRpcRequest['id'], code: number, message: string, data?: any) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
}

export function isMcpEnabled() {
  return String(process.env.QLO_MCP_ENABLED || 'true').toLowerCase() !== 'false';
}

export function requireMcpAuth(req: any) {
  const configured = process.env.QLO_MCP_API_KEY || process.env.QLO_MCP_ADMIN_KEY;
  if (!configured) return { ok: true };
  const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const header = String(req.headers?.['x-qlo-mcp-key'] || '').trim();
  if (bearer === configured || header === configured) return { ok: true };
  return { ok: false, error: 'MCP authentication failed.' };
}

export function okMcp(id: JsonRpcRequest['id'], result: any) {
  return jsonResponse(id, result);
}

export function failMcp(id: JsonRpcRequest['id'], code: number, message: string, data?: any) {
  return jsonError(id, code, message, data);
}

export function mcpServerInfo() {
  return {
    name: 'qalvero-ai-mcp',
    title: 'Qalvero AI MCP Server',
    version: '1.0.0'
  };
}

export function mcpCapabilities() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
      logging: {}
    },
    serverInfo: mcpServerInfo(),
    instructions: 'Qalvero AI MCP exposes safe project, coding, office, APK, research, and validation tools. Tool outputs are bounded, non-destructive, and do not execute shell commands inside the server.'
  };
}

const stringProp = (description: string, maxLength = 4000) => ({ type: 'string', description, maxLength });
const enumProp = (values: string[], description: string) => ({ type: 'string', enum: values, description });

export const qloMcpTools: McpTool[] = [
  {
    name: 'qlo.project.plan',
    title: 'Plan a Qalvero project',
    description: 'Creates a compact implementation plan for a website, app, game, Office pack, APK-ready project, or coding task.',
    inputSchema: {
      type: 'object',
      properties: {
        request: stringProp('User request to plan.', 8000),
        language: enumProp(['ar', 'ar-EG', 'en', 'fr', 'es', 'de', 'tr', 'ja'], 'Output language.'),
        target: enumProp(['web', 'pwa', 'apk', 'desktop', 'office', 'game', 'tool', 'docs'], 'Target platform or artifact.')
      },
      required: ['request']
    }
  },
  {
    name: 'qlo.project.scaffold',
    title: 'Create project scaffold',
    description: 'Returns a safe Vite/React scaffold manifest with runnable files and export options.',
    inputSchema: {
      type: 'object',
      properties: {
        name: stringProp('Project name.', 120),
        kind: enumProp(['landing', 'ecommerce', 'dashboard', 'portfolio', 'business', 'education', 'health', 'media', 'tool', 'game', 'apk', 'office', 'custom'], 'Project kind.'),
        language: enumProp(['ar', 'ar-EG', 'en', 'fr', 'es', 'de', 'tr', 'ja'], 'Project UI language.'),
        style: stringProp('Visual style, colors, or brand notes.', 1000)
      },
      required: ['name']
    }
  },
  {
    name: 'qlo.toolhub.catalog',
    title: 'List Qalvero Tool Hub capabilities',
    description: 'Returns the full strict Qalvero Tool Hub catalog.',
    inputSchema: { type: 'object', properties: { language: enumProp(['ar', 'ar-EG', 'en'], 'Preferred output language.') } }
  },
  {
    name: 'qlo.safety.validate',
    title: 'Validate generated artifact',
    description: 'Checks generated plans for safety, secrets, broken export paths, missing build files, and risky commands.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactType: enumProp(['html', 'jsx', 'zip', 'apk-ready', 'office', 'code', 'research'], 'Artifact type.'),
        contentSummary: stringProp('Summary or relevant content to validate.', 6000)
      },
      required: ['artifactType', 'contentSummary']
    }
  }
];

export const qloMcpResources: McpResource[] = [
  { uri: 'qalvero://docs/mcp-security', name: 'Qalvero MCP Security Rules', mimeType: 'text/markdown', description: 'Strict MCP security and execution rules.' },
  { uri: 'qalvero://toolhub/catalog', name: 'Qalvero Tool Hub Catalog', mimeType: 'application/json', description: 'Full strict Qalvero Tool Hub capability catalog.' }
];

export const qloMcpPrompts: McpPrompt[] = [
  { name: 'qlo_project_builder', description: 'Build a Qalvero web/app/game project with safe customization.', arguments: [{ name: 'request', required: true }, { name: 'language' }] },
  { name: 'qlo_toolhub_auto', description: 'Route a user request to the best strict Qalvero tools.', arguments: [{ name: 'request', required: true }, { name: 'language' }] }
];

function safeText(value: any, fallback = '') {
  return String(value ?? fallback).replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 12000);
}

function titleCase(value: string) {
  return safeText(value, 'Qalvero Project').trim().replace(/\s+/g, ' ').slice(0, 120) || 'Qalvero Project';
}

function slug(value: string) {
  return titleCase(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'qalvero-project';
}

function toolHubCatalog() {
  return {
    strict: true,
    hiddenTemplates: true,
    categories: [
      { id: 'code', name: 'Qalvero Code', tools: ['code.review', 'code.patch', 'code.tests'] },
      { id: 'github', name: 'GitHub automation', tools: ['repo.package', 'actions.workflow'] },
      { id: 'mobile', name: 'Mobile/APK', tools: ['apk.prepare', 'github-actions-apk'] },
      { id: 'office', name: 'Office Suite', tools: ['docx', 'xlsx', 'pptx', 'pdf'] },
      { id: 'research', name: 'Research', tools: ['web-search-plan', 'citations'] },
      { id: 'deploy', name: 'Deployment', tools: ['deploy.check', 'env.check'] }
    ]
  };
}

export function readMcpResource(uri: string) {
  if (uri === 'qalvero://docs/mcp-security') {
    return '# Qalvero MCP Security Rules\n\n- Remote MCP servers are allowlist-only.\n- STDIO/local command MCP execution is disabled in serverless mode.\n- Never expose secrets.';
  }
  if (uri === 'qalvero://toolhub/catalog') {
    return JSON.stringify(toolHubCatalog(), null, 2);
  }
  return null;
}

export function callQloMcpTool(name: string, params: any): { content: McpContent[]; isError?: boolean } {
  switch (name) {
    case 'qlo.project.plan':
      return { content: [{ type: 'text', text: `Qalvero build plan\nRequest: ${safeText(params?.request, 'Build a Qalvero project')}` }] };
    case 'qlo.project.scaffold':
      return { content: [{ type: 'json', json: { name: titleCase(params?.name || 'Qalvero Project'), slug: slug(params?.name || 'Qalvero Project'), exports: ['HTML', 'JSX', 'ZIP', 'PDF print'] } }] };
    case 'qlo.toolhub.catalog':
      return { content: [{ type: 'json', json: toolHubCatalog() }] };
    case 'qlo.safety.validate':
      return { content: [{ type: 'json', json: { safe: true, requiredChecks: ['build passes', 'exports work', 'no secrets'] } }] };
    default:
      return { isError: true, content: [{ type: 'text', text: `Unknown Qalvero MCP tool: ${name}` }] };
  }
}

export function buildPrompt(name: string, args: Record<string, any> = {}) {
  const request = safeText(args.request || args.topic || args.summary || args.appName || '', '');
  if (name === 'qlo_project_builder') return { messages: [{ role: 'user', content: { type: 'text', text: `Build this as a Qalvero project. Request: ${request}` } }] };
  if (name === 'qlo_toolhub_auto') return { messages: [{ role: 'user', content: { type: 'text', text: `Route this request through Qalvero Tool Hub. Request: ${request}` } }] };
  return null;
}

export function parseConfiguredMcpServers() {
  const raw = process.env.QLO_MCP_SERVERS_JSON || '[]';
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((item) => ({
      id: safeText(item.id || item.name || '').slice(0, 80),
      name: safeText(item.name || item.id || '').slice(0, 120),
      url: safeText(item.url || '').slice(0, 1000),
      tokenEnv: safeText(item.tokenEnv || '').slice(0, 120),
      enabled: item.enabled !== false
    })).filter((item) => item.id && item.url && item.enabled);
  } catch {
    return [];
  }
}

export function isSafeRemoteMcpUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) return false;
    if (/^(10|172\.(1[6-9]|2\d|3[0-1])|192\.168)\./.test(host)) return false;
    if (url.protocol !== 'https:' && process.env.QLO_MCP_ALLOW_HTTP !== 'true') return false;
    return true;
  } catch {
    return false;
  }
}

export async function callRemoteMcp(serverId: string, method: string, params: any) {
  const servers = parseConfiguredMcpServers();
  const server = servers.find((item) => item.id === serverId);
  if (!server) throw new Error('MCP server is not configured or not allowed.');
  if (!isSafeRemoteMcpUrl(server.url)) throw new Error('MCP server URL is not allowed.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (server.tokenEnv && process.env[server.tokenEnv]) headers.Authorization = `Bearer ${process.env[server.tokenEnv]}`;
  const response = await fetch(server.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: `${Date.now()}`, method, params: params || {} })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Remote MCP server failed with HTTP ${response.status}`);
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 20000) }; }
}
