import {
  callRemoteMcp,
  callQloMcpTool,
  isMcpEnabled,
  isSafeRemoteMcpUrl,
  parseConfiguredMcpServers,
  qloMcpPrompts,
  qloMcpResources,
  qloMcpTools,
  requireMcpAuth
} from '../../../api/_mcp';

function safePublicServer(server: any) {
  return { id: server.id, name: server.name, url: server.url.replace(/\/[^/]*$/, '/…'), enabled: server.enabled, safe: isSafeRemoteMcpUrl(server.url) };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isMcpEnabled()) return res.status(503).json({ error: 'Qalvero MCP is disabled.' });

  const auth = requireMcpAuth(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  try {
    const action = String((req.method === 'GET' ? req.query?.action : req.body?.action) || 'status');
    const servers = parseConfiguredMcpServers();

    if (action === 'status') {
      return res.status(200).json({
        enabled: true,
        endpoint: '/api/mcp',
        localTools: qloMcpTools.length,
        resources: qloMcpResources.length,
        prompts: qloMcpPrompts.length,
        remoteServers: servers.map(safePublicServer),
        strict: {
          stdioDisabled: true,
          remoteAllowlistOnly: true,
          localhostBlocked: true,
          httpRequiresEnvFlag: true,
          secretsHidden: true
        }
      });
    }

    if (action === 'list-local') return res.status(200).json({ tools: qloMcpTools, resources: qloMcpResources, prompts: qloMcpPrompts });

    if (action === 'call-local') {
      const tool = String(req.body?.tool || '');
      const args = req.body?.arguments || {};
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      return res.status(200).json(callQloMcpTool(tool, args));
    }

    if (action === 'remote-list-tools') {
      const serverId = String(req.body?.serverId || req.query?.serverId || '');
      const data = await callRemoteMcp(serverId, 'tools/list', {});
      return res.status(200).json(data);
    }

    if (action === 'remote-call-tool') {
      const serverId = String(req.body?.serverId || '');
      const tool = String(req.body?.tool || '');
      const args = req.body?.arguments || {};
      if (!serverId || !tool) return res.status(400).json({ error: 'serverId and tool are required' });
      const data = await callRemoteMcp(serverId, 'tools/call', { name: tool, arguments: args });
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown MCP action.' });
  } catch (err: any) {
    return res.status(500).json({ error: process.env.QLO_DEBUG === 'true' ? (err?.message || 'MCP bridge failed') : 'MCP bridge failed.' });
  }
}
