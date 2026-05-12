export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    mode: 'github-actions',
    cloudBuild: false,
    message: 'Google Cloud APK builder has been removed. APK export is handled through the generated GitHub Actions workflow instead.',
    requirements: [
      'Commit the generated Capacitor Android project to GitHub.',
      'Use the included GitHub Actions Android/APK workflow.',
      'Download the APK from the workflow artifacts after the run finishes.'
    ]
  });
}
