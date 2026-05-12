import { access, copyFile, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(root, 'api');
const serverDir = path.join(root, 'src', 'server');
const routesDir = path.join(serverDir, 'routes');

const helpers = ['_observability.ts', '_mcp.ts', '_vertex.ts'];
const mergedRoutes = ['qlo-mcp.ts', 'qlo-tool-hub.ts'];
const routedBase = 'mcp.ts';

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function rewriteHelperImportsForServerRoute(source) {
  return source.replace(
    /(['"])\.\/_((observability)|(mcp)|(vertex))(\.ts)?\1/g,
    (_match, quote, helperName) => `${quote}../_${helperName}${quote}`
  );
}

function rewriteHelperImportsForApiRoute(source) {
  return source.replace(
    /(['"])\.\/_((observability)|(mcp)|(vertex))(\.ts)?\1/g,
    (_match, quote, helperName) => `${quote}../src/server/_${helperName}${quote}`
  );
}

async function copyHelperModules() {
  await mkdir(serverDir, { recursive: true });

  for (const helper of helpers) {
    const source = path.join(apiDir, helper);
    const target = path.join(serverDir, helper);
    if (await exists(source)) {
      await copyFile(source, target);
    }
  }
}

async function copyMergedRoutes() {
  await mkdir(routesDir, { recursive: true });

  for (const route of [routedBase, ...mergedRoutes]) {
    const source = path.join(apiDir, route);
    const target = path.join(routesDir, route);
    if (await exists(source)) {
      const original = await readFile(source, 'utf8');
      await writeFile(target, rewriteHelperImportsForServerRoute(original));
    }
  }
}

async function rewriteRemainingApiImports() {
  const files = await readdir(apiDir);
  const apiFiles = files.filter((file) =>
    file.endsWith('.ts') &&
    !helpers.includes(file) &&
    !mergedRoutes.includes(file) &&
    file !== routedBase
  );

  for (const file of apiFiles) {
    const filePath = path.join(apiDir, file);
    const original = await readFile(filePath, 'utf8');
    const updated = rewriteHelperImportsForApiRoute(original);

    if (updated !== original) {
      await writeFile(filePath, updated);
    }
  }
}

async function writeMergedMcpEntrypoint() {
  const wrapper = `import baseMcpHandler from '../src/server/routes/mcp';\nimport qloMcpHandler from '../src/server/routes/qlo-mcp';\nimport qloToolHubHandler from '../src/server/routes/qlo-tool-hub';\n\nfunction getRoute(req: any) {\n  const direct = req?.query?.route;\n  if (direct) return String(direct);\n\n  try {\n    const url = new URL(String(req?.url || ''), 'http://localhost');\n    return url.searchParams.get('route') || '';\n  } catch {\n    return '';\n  }\n}\n\nexport default async function handler(req: any, res: any) {\n  const route = getRoute(req);\n\n  if (route === 'qlo-mcp') {\n    return qloMcpHandler(req, res);\n  }\n\n  if (route === 'qlo-tool-hub') {\n    return qloToolHubHandler(req, res);\n  }\n\n  return baseMcpHandler(req, res);\n}\n`;

  await writeFile(path.join(apiDir, routedBase), wrapper);
}

async function removeBuildOnlyApiEntrypoints() {
  for (const file of [...helpers, ...mergedRoutes]) {
    const source = path.join(apiDir, file);
    if (await exists(source)) {
      await unlink(source);
    }
  }
}

await copyHelperModules();

const runningOnVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

if (runningOnVercel) {
  await copyMergedRoutes();
  await rewriteRemainingApiImports();
  await writeMergedMcpEntrypoint();
  await removeBuildOnlyApiEntrypoints();

  console.log('Vercel API helpers plus qlo-mcp/tool-hub routes merged under /api/mcp for this build.');
} else {
  console.log('Server helper copies prepared for local build.');
}
