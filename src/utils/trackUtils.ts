import React from 'react';
import { Track } from '../types';

export const DEFAULT_COVER_FALLBACK =
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60';

function extractCleanYtId(raw?: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith('yt_')) s = s.slice(3);
  if (s.includes('v=')) s = s.split('v=')[1].split('&')[0];
  if (s.includes('vi/')) s = s.split('vi/')[1].split('/')[0];
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return null;
}

/**
 * Deduplicates a list of tracks by ID and by Title (case-insensitive & trimmed)
 * Keeps the first occurrence and removes subsequent duplicates.
 */
export function deduplicateTracks(tracks: Track[]): Track[] {
  if (!tracks || !Array.isArray(tracks)) return [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const result: Track[] = [];

  for (const t of tracks) {
    if (!t) continue;
    const rawId = (t.id || '').trim().toLowerCase();
    const rawTitle = (t.title || '').trim().toLowerCase();
    const rawArtist = (t.artist || '').trim().toLowerCase();

    if (rawId && seenIds.has(rawId)) {
      continue;
    }

    const titleKey = rawTitle ? `${rawTitle}___${rawArtist}` : '';
    if (titleKey && seenTitles.has(titleKey)) {
      continue;
    }

    if (rawTitle && seenTitles.has(rawTitle)) {
      continue;
    }

    if (rawId) seenIds.add(rawId);
    if (titleKey) seenTitles.add(titleKey);
    if (rawTitle) seenTitles.add(rawTitle);
    result.push(t);
  }

  return result;
}

/**
 * Returns either '#000000' or '#ffffff' depending on background brightness
 * to ensure maximum contrast and readability on any custom theme color.
 */
export function getContrastTextColor(hexColor?: string): '#000000' | '#ffffff' {
  if (!hexColor) return '#ffffff';
  const clean = hexColor.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#000000' : '#ffffff';
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.62 ? '#000000' : '#ffffff';
  }
  return '#ffffff';
}

/**
 * Optimizes thumbnail image URLs (e.g. YouTube maxresdefault -> mqdefault)
 * and rewrites blocked googleusercontent URLs when a YouTube video ID is available.
 */
export function optimizeThumbnailUrl(url: string | undefined, fallbackIdOrUrl?: string): string {
  const cleanVid = extractCleanYtId(fallbackIdOrUrl) || extractCleanYtId(url);
  if (!url || !url.trim()) {
    return cleanVid ? `https://i.ytimg.com/vi/${cleanVid}/mqdefault.jpg` : DEFAULT_COVER_FALLBACK;
  }
  if (url.includes('googleusercontent.com') && cleanVid) {
    return `https://i.ytimg.com/vi/${cleanVid}/mqdefault.jpg`;
  }
  if (url.includes('i.ytimg.com') || url.includes('img.youtube.com')) {
    return url.replace('maxresdefault', 'mqdefault').replace('hqdefault', 'mqdefault');
  }
  return url;
}

/**
 * Universal onError handler for <img> tags so broken thumbnail icons never appear.
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackIdOrUrl?: string
) {
  const img = e.currentTarget;
  const cleanVid = extractCleanYtId(fallbackIdOrUrl) || extractCleanYtId(img.src);

  if (cleanVid) {
    const hqUrl = `https://i.ytimg.com/vi/${cleanVid}/hqdefault.jpg`;
    if (img.src !== hqUrl && !img.dataset.triedHq) {
      img.dataset.triedHq = '1';
      img.src = hqUrl;
      return;
    }
  }

  if (img.src !== DEFAULT_COVER_FALLBACK) {
    img.src = DEFAULT_COVER_FALLBACK;
  }
}
