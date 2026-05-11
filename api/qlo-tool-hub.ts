import { callQloMcpTool, qloMcpTools, qloMcpResources, qloMcpPrompts } from './_mcp';

function setHeaders(res: any) {
  res.setHeader('Cache-Control', 'no-store');
}

function publicTool(t: any) {
  return {
    name: t.name,
    title: t.title || t.name,
    description: t.description,
    inputSchema: t.inputSchema
  };
}

export default async function handler(req: any, res: any) {
  setHeaders(res);
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const action = String((req.method === 'GET' ? req.query?.action : req.body?.action) || 'catalog');

    if (action === 'catalog') {
      return res.status(200).json({
        strict: true,
        hiddenInternalPatterns: true,
        toolCount: qloMcpTools.length,
        resourceCount: qloMcpResources.length,
        promptCount: qloMcpPrompts.length,
        tools: qloMcpTools.map(publicTool),
        policy: {
          creditSaving: 'Use deterministic tools and internal build patterns before expensive AI calls.',
          userFacing: 'Never tell users that an internal template was used.',
          customization: 'Every generated artifact must adapt name, language, colors, copy, mock data, and layout details.',
          safety: 'No arbitrary command execution, no client secrets, no unsafe localhost MCP bridge.'
        }
      });
    }

    if (action === 'call') {
      const tool = String(req.body?.tool || '');
      const args = req.body?.arguments || req.body?.args || {};
      if (!tool) return res.status(400).json({ error: 'tool is required' });
      if (!qloMcpTools.some((t) => t.name === tool)) return res.status(404).json({ error: 'Unknown Qalvero Tool Hub tool.' });
      return res.status(200).json(callQloMcpTool(tool, args));
    }

    return res.status(400).json({ error: 'Unknown Tool Hub action.' });
  } catch (err: any) {
    return res.status(500).json({ error: process.env.QLO_DEBUG === 'true' ? (err?.message || 'Tool Hub failed') : 'Tool Hub failed.' });
  }
}
