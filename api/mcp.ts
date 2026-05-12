import baseMcpHandler from '../src/server/routes/mcp';
import qloMcpHandler from '../src/server/routes/qlo-mcp';
import qloToolHubHandler from '../src/server/routes/qlo-tool-hub';

function getRoute(req: any) {
  const direct = req?.query?.route;
  if (direct) return String(direct);

  try {
    const url = new URL(String(req?.url || ''), 'http://localhost');
    return url.searchParams.get('route') || '';
  } catch {
    return '';
  }
}

export default async function handler(req: any, res: any) {
  const route = getRoute(req);

  if (route === 'qlo-mcp') {
    return qloMcpHandler(req, res);
  }

  if (route === 'qlo-tool-hub') {
    return qloToolHubHandler(req, res);
  }

  return baseMcpHandler(req, res);
}
