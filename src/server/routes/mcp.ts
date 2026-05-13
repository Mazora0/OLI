import {
  buildPrompt,
  callQloMcpTool,
  failMcp,
  isMcpEnabled,
  mcpCapabilities,
  okMcp,
  qloMcpPrompts,
  qloMcpResources,
  qloMcpTools,
  readMcpResource,
  requireMcpAuth,
  type JsonRpcRequest
} from '../_mcp';

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.QLO_MCP_ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-QLO-MCP-Key, MCP-Protocol-Version');
  res.setHeader('Cache-Control', 'no-store');
}

async function handleRpc(req: any, rpc: JsonRpcRequest) {
  const method = String(rpc.method || '');
  if (!method) return failMcp(rpc.id, -32600, 'Invalid MCP JSON-RPC request.');

  switch (method) {
    case 'initialize':
      return okMcp(rpc.id, mcpCapabilities());
    case 'notifications/initialized':
      return okMcp(rpc.id, {});
    case 'ping':
      return okMcp(rpc.id, {});
    case 'tools/list':
      return okMcp(rpc.id, { tools: qloMcpTools });
    case 'tools/call': {
      const name = String(rpc.params?.name || '');
      const args = rpc.params?.arguments || rpc.params?.args || {};
      if (!name) return failMcp(rpc.id, -32602, 'Tool name is required.');
      return okMcp(rpc.id, callQloMcpTool(name, args));
    }
    case 'resources/list':
      return okMcp(rpc.id, { resources: qloMcpResources });
    case 'resources/read': {
      const uri = String(rpc.params?.uri || '');
      const body = readMcpResource(uri);
      if (body === null) return failMcp(rpc.id, -32602, 'Unknown resource URI.');
      const mimeType = uri.endsWith('/catalog') ? 'application/json' : 'text/markdown';
      return okMcp(rpc.id, { contents: [{ uri, mimeType, text: body }] });
    }
    case 'prompts/list':
      return okMcp(rpc.id, { prompts: qloMcpPrompts });
    case 'prompts/get': {
      const name = String(rpc.params?.name || '');
      const prompt = buildPrompt(name, rpc.params?.arguments || {});
      if (!prompt) return failMcp(rpc.id, -32602, 'Unknown prompt.');
      return okMcp(rpc.id, prompt);
    }
    default:
      return failMcp(rpc.id, -32601, `Unsupported MCP method: ${method}`);
  }
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!isMcpEnabled()) return res.status(503).json({ error: 'Qalvero MCP is disabled.' });

  const auth = requireMcpAuth(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  if (req.method === 'GET') {
    return res.status(200).json({ ...mcpCapabilities(), endpoint: '/api/mcp', transport: 'stateless-http-json-rpc' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    if (Array.isArray(body)) {
      const results = await Promise.all(body.slice(0, 20).map((rpc) => handleRpc(req, rpc)));
      return res.status(200).json(results);
    }
    const result = await handleRpc(req, body || {});
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(200).json(failMcp(null, -32603, process.env.QLO_DEBUG === 'true' ? (err?.message || 'MCP internal error') : 'MCP internal error'));
  }
}
