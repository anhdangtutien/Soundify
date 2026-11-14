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
export const CURRENT_BUILD_DATE = '2026-11-13T17:56:02Z';
export const CURRENT_VERSION = '0.1.1';

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

      if (!force) {
        const dismissed = localStorage.getItem('spytify_dismissed_update_time');
        if (dismissed && dismissed === raw.published_at) {
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
    const tagName = (data.tag_name || '').replace(/^v/, '');
    const exeAsset = data.assets?.find((a: any) => (a.name || '').endsWith('.exe'));
    const downloadUrl = exeAsset?.browser_download_url || data.html_url || 'https://github.com/anhdangtutien/Spytify/releases';
    const effectiveRemoteDate = exeAsset?.updated_at || exeAsset?.created_at || publishedAt;

    const info: UpdateInfo = {
      version: data.tag_name || `v${CURRENT_VERSION}`,
      name: data.name || `Spytify ${data.tag_name || ''}`,
      publishedAt: effectiveRemoteDate,
      notes: data.body || '',
      downloadUrl,
      releaseUrl: data.html_url || 'https://github.com/anhdangtutien/Spytify/releases',
    };

    const remoteTime = new Date(effectiveRemoteDate).getTime();
    const localTime = new Date(CURRENT_BUILD_DATE).getTime();

    const isNewerBuild = remoteTime > localTime;
    const isNewerVersion = tagName && tagName !== CURRENT_VERSION;

    const hasUpdate = Boolean(isNewerBuild || isNewerVersion);

    if (!hasUpdate) {
      return { hasUpdate: false, info };
    }

    if (!force) {
      const dismissed = localStorage.getItem('spytify_dismissed_update_time');
      if (dismissed && dismissed === effectiveRemoteDate) {
        return { hasUpdate: false, info };
      }
    }

    return { hasUpdate: true, info };
  } catch (err: any) {
    console.debug('Failed to check for Spytify updates:', err);
    return { hasUpdate: false, error: err?.message || String(err) };
  }
}

export function dismissUpdate(publishedAt: string) {
  localStorage.setItem('spytify_dismissed_update_time', publishedAt);
}
