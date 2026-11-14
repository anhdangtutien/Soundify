import { invoke } from '@tauri-apps/api/core';

export interface UpdateInfo {
  version: string;
  name: string;
  publishedAt: string;
  notes: string;
  downloadUrl: string;
  releaseUrl: string;
}

// Baseline build timestamp for the current installed client
export const CURRENT_BUILD_DATE = '2026-11-14T12:00:00Z';
export const CURRENT_VERSION = '0.1.3';

export function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, '').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
  const p1 = parse(v1);
  const p2 = parse(v2);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

export async function checkGitHubUpdate(force = false): Promise<{ hasUpdate: boolean; info?: UpdateInfo; error?: string }> {
  // 1. Try native Rust command first (immune to CORS, webview network restrictions, and sets proper User-Agent)
  try {
    const raw = await invoke<any>('check_for_updates', { currentBuildDate: CURRENT_BUILD_DATE });
    if (raw) {
      const info: UpdateInfo = {
        version: raw.latest_version || `v${CURRENT_VERSION}`,
        name: raw.release_name || `Spytify ${raw.latest_version || ''}`,
        publishedAt: raw.published_at || '',
        notes: raw.release_notes || '',
        downloadUrl: raw.download_url,
        releaseUrl: raw.release_url,
      };

      if (!raw.has_update) {
        return { hasUpdate: false, info };
      }

      // If version is equal or older, never prompt automatically on startup
      if (!force && compareSemver(info.version, CURRENT_VERSION) <= 0) {
        return { hasUpdate: false, info };
      }

      if (!force) {
        const dismissedVer = localStorage.getItem('spytify_dismissed_update_version');
        const dismissedTime = localStorage.getItem('spytify_dismissed_update_time');
        if (dismissedVer && dismissedVer === info.version) {
          return { hasUpdate: false, info };
        }
        if (dismissedTime && dismissedTime === raw.published_at) {
          return { hasUpdate: false, info };
        }
      }

      return { hasUpdate: true, info };
    }
  } catch (rustErr) {
    console.warn('Rust update check fallback to web fetch:', rustErr);
  }

  // 2. Fallback to standard web fetch
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
      return { hasUpdate: false, error: `GitHub API trả về HTTP ${res.status}` };
    }

    const data = await res.json();
    const publishedAt = data.published_at || '';
    const rawTag = data.tag_name || '';
    const exeAsset = data.assets?.find((a: any) => (a.name || '').endsWith('.exe'));
    const downloadUrl = exeAsset?.browser_download_url || data.html_url || 'https://github.com/anhdangtutien/Spytify/releases';
    const effectiveRemoteDate = exeAsset?.updated_at || exeAsset?.created_at || publishedAt;

    const info: UpdateInfo = {
      version: rawTag || `v${CURRENT_VERSION}`,
      name: data.name || `Spytify ${rawTag || ''}`,
      publishedAt: effectiveRemoteDate,
      notes: data.body || '',
      downloadUrl,
      releaseUrl: data.html_url || 'https://github.com/anhdangtutien/Spytify/releases',
    };

    const isNewerVersion = compareSemver(info.version, CURRENT_VERSION) > 0;
    const remoteTime = new Date(effectiveRemoteDate).getTime();
    const localTime = new Date(CURRENT_BUILD_DATE).getTime();
    const isNewerBuild = remoteTime > localTime && compareSemver(info.version, CURRENT_VERSION) === 0;

    const hasUpdate = Boolean(isNewerVersion || isNewerBuild);

    if (!hasUpdate) {
      return { hasUpdate: false, info };
    }

    if (!force) {
      if (compareSemver(info.version, CURRENT_VERSION) <= 0) {
        return { hasUpdate: false, info };
      }

      const dismissedVer = localStorage.getItem('spytify_dismissed_update_version');
      const dismissedTime = localStorage.getItem('spytify_dismissed_update_time');
      if (dismissedVer && dismissedVer === info.version) {
        return { hasUpdate: false, info };
      }
      if (dismissedTime && dismissedTime === effectiveRemoteDate) {
        return { hasUpdate: false, info };
      }
    }

    return { hasUpdate: true, info };
  } catch (err: any) {
    console.debug('Failed to check for Spytify updates:', err);
    return { hasUpdate: false, error: err?.message || String(err) };
  }
}

export function dismissUpdate(infoOrTime: string | UpdateInfo) {
  if (typeof infoOrTime === 'string') {
    localStorage.setItem('spytify_dismissed_update_time', infoOrTime);
  } else {
    if (infoOrTime.version) {
      localStorage.setItem('spytify_dismissed_update_version', infoOrTime.version);
    }
    if (infoOrTime.publishedAt) {
      localStorage.setItem('spytify_dismissed_update_time', infoOrTime.publishedAt);
    }
  }
}
