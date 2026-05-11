function parseServiceAccount() {
  const raw = process.env.GCLOUD_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const b64 = process.env.GCLOUD_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 || '';
  const value = raw || (b64 ? Buffer.from(b64, 'base64').toString('utf8') : '');
  if (!value.trim()) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessTokenFromServiceAccount() {
  const credentials = parseServiceAccount();
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error('Missing GCLOUD_SERVICE_ACCOUNT_JSON or GCLOUD_SERVICE_ACCOUNT_BASE64.');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const crypto = await import('crypto');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || 'Could not get Google Cloud access token.');
  return tokenData.access_token as string;
}

export async function createVertexCustomJob(args: {
  projectId: string;
  region: string;
  displayName: string;
  containerImageUri: string;
  datasetUri: string;
  outputUri: string;
  baseModel?: string;
  machineType?: string;
  acceleratorType?: string;
  acceleratorCount?: number;
}) {
  const accessToken = await getAccessTokenFromServiceAccount();
  const endpoint = `https://${args.region}-aiplatform.googleapis.com/v1/projects/${args.projectId}/locations/${args.region}/customJobs`;
  const body = {
    displayName: args.displayName,
    jobSpec: {
      workerPoolSpecs: [
        {
          machineSpec: {
            machineType: args.machineType || process.env.GCLOUD_VERTEX_MACHINE_TYPE || 'n1-standard-8',
            ...(args.acceleratorType ? { acceleratorType: args.acceleratorType, acceleratorCount: args.acceleratorCount || 1 } : {})
          },
          replicaCount: '1',
          containerSpec: {
            imageUri: args.containerImageUri,
            env: [
              { name: 'QLO_DATASET_URI', value: args.datasetUri },
              { name: 'QLO_OUTPUT_URI', value: args.outputUri },
              { name: 'QLO_BASE_MODEL', value: args.baseModel || process.env.QLO1_BASE_MODEL || 'Qwen/Qwen3-8B' }
            ]
          }
        }
      ]
    }
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.error || 'Vertex AI custom job failed to start.');
  return data;
}
