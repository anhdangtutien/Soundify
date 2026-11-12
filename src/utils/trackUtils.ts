import { Track } from '../types';

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

    // Check ID duplicate
    if (rawId && seenIds.has(rawId)) {
      continue;
    }

    // Check Title + Artist duplicate
    const titleKey = rawTitle ? `${rawTitle}___${rawArtist}` : '';
    if (titleKey && seenTitles.has(titleKey)) {
      continue;
    }

    // Also check exact title alone if artist is generic or same
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
