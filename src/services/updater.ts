export interface UpdateInfo {
  version: string;
  name: string;
  publishedAt: string;
  notes: string;
  downloadUrl: string;
  releaseUrl: string;
}

// Baseline build timestamp for the current installed client
export const CURRENT_BUILD_DATE = '2026-11-13T17:56:02Z';
export const CURRENT_VERSION = '0.1.1';

export async function checkGitHubUpdate(force = false): Promise<{ hasUpdate: boolean; info?: UpdateInfo }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://api.github.com/repos/anhdangtutien/Spytify/releases/latest', {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { hasUpdate: false };
    }

    const data = await res.json();
    const publishedAt = data.published_at || '';
    const tagName = (data.tag_name || '').replace(/^v/, '');
    const exeAsset = data.assets?.find((a: any) => (a.name || '').endsWith('.exe'));
    const downloadUrl = exeAsset?.browser_download_url || data.html_url || 'https://github.com/anhdangtutien/Spytify/releases';

    const info: UpdateInfo = {
      version: data.tag_name || `v${CURRENT_VERSION}`,
      name: data.name || `Spytify ${data.tag_name || ''}`,
      publishedAt: publishedAt,
      notes: data.body || '',
      downloadUrl,
      releaseUrl: data.html_url || 'https://github.com/anhdangtutien/Spytify/releases',
    };

    // Check if remote build is strictly newer than current build time or has a newer tag
    const remoteTime = new Date(publishedAt).getTime();
    const localTime = new Date(CURRENT_BUILD_DATE).getTime();

    const isNewerBuild = remoteTime > localTime;
    const isNewerVersion = tagName && tagName !== CURRENT_VERSION;

    const hasUpdate = Boolean(isNewerBuild || isNewerVersion);

    if (!hasUpdate) {
      return { hasUpdate: false, info };
    }

    if (!force) {
      const dismissed = localStorage.getItem('spytify_dismissed_update_time');
      if (dismissed && dismissed === publishedAt) {
        return { hasUpdate: false, info };
      }
    }

    return { hasUpdate: true, info };
  } catch (err) {
    console.debug('Failed to check for Spytify updates:', err);
    return { hasUpdate: false };
  }
}

export function dismissUpdate(publishedAt: string) {
  localStorage.setItem('spytify_dismissed_update_time', publishedAt);
}
