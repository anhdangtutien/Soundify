import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { invoke } from '@tauri-apps/api/core';
import { UserAlbum, Track, HistoryItem, User } from '../types';

// Default Supabase credentials (Can be overridden by user in Profile settings or .env)
const DEFAULT_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qlbsrzgbyclzzayfkaei.supabase.co';
const DEFAULT_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GVAkGRpbXs9N_ATIKEoscQ_DJ6QSSVX';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function cleanSupabaseUrl(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim();
  clean = clean.replace(/\/+$/, '');
  clean = clean.replace(/\/rest\/v1\/?$/, '');
  return clean.replace(/\/+$/, '');
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const url = cleanSupabaseUrl(localStorage.getItem('spytify_supabase_url') || DEFAULT_URL);
  const anonKey = (localStorage.getItem('spytify_supabase_anon_key') || DEFAULT_ANON_KEY).trim();
  return { url, anonKey };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string): void {
  const cleanedUrl = cleanSupabaseUrl(url);
  localStorage.setItem('spytify_supabase_url', cleanedUrl);
  localStorage.setItem('spytify_supabase_anon_key', anonKey.trim());
  cachedClient = null; // Reset client
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey || config.url.includes('example-spytify')) {
    return null;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

export const SUPABASE_SCHEMA_SQL = `-- 🕵️‍♂️ SPYTIFY SPEC-OPS // SUPABASE CLOUD DATABASE SCHEMA
CREATE TABLE IF NOT EXISTS public.spytify_profiles (
    id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    email TEXT,
    password_hash TEXT,
    salt TEXT,
    google_id TEXT,
    avatar TEXT,
    accent_color TEXT DEFAULT '#FF2A55',
    theme_mode TEXT DEFAULT 'dark',
    language TEXT DEFAULT 'vi',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Backward-compatibility migrations for existing tables
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE public.spytify_profiles ADD COLUMN IF NOT EXISTS google_id TEXT;

CREATE TABLE IF NOT EXISTS public.spytify_albums (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tracks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_albums_user_id ON public.spytify_albums(user_id);

CREATE TABLE IF NOT EXISTS public.spytify_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_favs_user_id ON public.spytify_favorites(user_id);

CREATE TABLE IF NOT EXISTS public.spytify_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    source TEXT NOT NULL,
    duration_secs INTEGER NOT NULL,
    path_or_url TEXT,
    cover_art TEXT,
    track_json JSONB,
    listened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_history_user_id ON public.spytify_history(user_id);

ALTER TABLE public.spytify_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for spytify_profiles" ON public.spytify_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spytify_albums" ON public.spytify_albums FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spytify_favorites" ON public.spytify_favorites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spytify_history" ON public.spytify_history FOR ALL USING (true) WITH CHECK (true);
`;

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Chưa cấu hình URL hoặc Anon Key hợp lệ.' };
  }
  try {
    const { error } = await client.from('spytify_profiles').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Kết nối được nhưng các bảng chưa được tạo. Hãy bấm "Sao chép mã SQL" và chạy trong Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Lỗi kết nối Supabase: ${error.message}` };
    }
    return { success: true, message: '🟢 Kết nối đám mây Supabase thành công và các bảng đã sẵn sàng!' };
  } catch (err: any) {
    return { success: false, message: `Không thể kết nối máy chủ: ${err?.message || err}` };
  }
}

// ──────────────── CLOUD DATA SYNC OPERATIONS ────────────────

export interface CloudUserData {
  albums: UserAlbum[];
  favorites: Track[];
  history?: HistoryItem[];
  username?: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  language?: string;
}

/**
 * Registers / Syncs user account credentials to Supabase Cloud
 */
export async function cloudRegisterUser(
  user: User,
  email: string | null,
  passwordHash: string,
  salt: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !user) return false;

  try {
    const { error } = await client.from('spytify_profiles').upsert({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: email || null,
      password_hash: passwordHash,
      salt: salt,
      avatar: user.avatar || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase cloudRegisterUser warning:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase cloudRegisterUser error:', err);
    return false;
  }
}

/**
 * Authenticates user against Supabase Cloud when local device SQLite does not have the account
 */
export async function cloudLoginUser(identifier: string, passwordPlain: string): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client || !identifier) return null;

  try {
    const cleanId = identifier.trim().toLowerCase();
    const { data: profile, error } = await client
      .from('spytify_profiles')
      .select('*')
      .or(`username.ilike.${cleanId},email.ilike.${cleanId}`)
      .maybeSingle();

    if (error || !profile) {
      return null;
    }

    if (!profile.password_hash || !profile.salt) {
      return null;
    }

    // Verify password hash
    const computedHash = await invoke<string>('auth_hash_password', {
      password: passwordPlain,
      salt: profile.salt,
    });

    if (computedHash !== profile.password_hash) {
      return null;
    }

    // Password matches! Import into local SQLite so it works offline
    const importedUser = await invoke<User>('auth_import_user', {
      id: profile.id,
      username: profile.username || cleanId,
      email: profile.email || null,
      passwordHash: profile.password_hash,
      salt: profile.salt,
      displayName: profile.display_name || profile.username || cleanId,
      avatar: profile.avatar || null,
    });

    return importedUser;
  } catch (err) {
    console.error('Supabase cloudLoginUser error:', err);
    return null;
  }
}

/**
 * Pushes local data (albums, favorites, history, avatar, settings) to Supabase Cloud
 */
export async function cloudSyncPush(userId: string, data: Partial<CloudUserData>): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    // 1. Sync User Profile / Settings
    const profilePayload: Record<string, any> = {
      id: userId,
      updated_at: new Date().toISOString(),
    };
    if (data.username) profilePayload.username = data.username;
    if (data.displayName) profilePayload.display_name = data.displayName;
    if (data.email) profilePayload.email = data.email;
    if (data.avatar) profilePayload.avatar = data.avatar;
    if (data.accentColor) profilePayload.accent_color = data.accentColor;
    if (data.themeMode) profilePayload.theme_mode = data.themeMode;
    if (data.language) profilePayload.language = data.language;

    if (Object.keys(profilePayload).length > 2) {
      await client.from('spytify_profiles').upsert(profilePayload, { onConflict: 'id' });
    }

    // 2. Sync Albums
    if (data.albums) {
      const albumRows = data.albums.map(a => ({
        id: a.id,
        user_id: userId,
        title: a.title,
        description: a.description || '',
        tracks: a.tracks,
        updated_at: new Date().toISOString(),
      }));

      if (albumRows.length > 0) {
        await client.from('spytify_albums').upsert(albumRows, { onConflict: 'id' });
      }
    }

    // 3. Sync Favorites
    if (data.favorites) {
      const favRows = data.favorites.map(t => ({
        id: `${userId}_${t.id}`,
        user_id: userId,
        track_id: t.id,
        track_json: t,
        updated_at: new Date().toISOString(),
      }));

      if (favRows.length > 0) {
        await client.from('spytify_favorites').upsert(favRows, { onConflict: 'id' });
      }
    }

    // 4. Sync History (Top 30 most recent tracks with cover_art & path_or_url)
    if (data.history && data.history.length > 0) {
      const histRows = data.history.slice(0, 30).map((h, i) => {
        let coverArt = (h as any).cover_art || null;
        let pathOrUrl = h.path_or_url || h.track_id;
        let fullTrack: any = null;

        if (h.track_json) {
          try {
            fullTrack = typeof h.track_json === 'string' ? JSON.parse(h.track_json) : h.track_json;
            coverArt = coverArt || fullTrack.cover_art;
            pathOrUrl = pathOrUrl || fullTrack.path_or_url;
          } catch {}
        }

        return {
          id: `${userId}_hist_${h.track_id}_${i}`,
          user_id: userId,
          track_id: h.track_id,
          track_title: h.track_title,
          artist: h.artist,
          source: h.source,
          duration_secs: h.duration_secs,
          path_or_url: pathOrUrl,
          cover_art: coverArt,
          track_json: fullTrack || h.track_json,
          listened_at: h.listened_at || new Date().toISOString(),
        };
      });

      if (histRows.length > 0) {
        await client.from('spytify_history').upsert(histRows, { onConflict: 'id' });
      }
    }

    return true;
  } catch (err) {
    console.error('Supabase cloud push failed:', err);
    return false;
  }
}

/**
 * Pulls all user data (albums, favorites, history, avatar, settings) from Supabase Cloud
 */
export async function cloudSyncPull(userId: string): Promise<CloudUserData | null> {
  const client = getSupabaseClient();
  if (!client || !userId) return null;

  try {
    const [profileRes, albumsRes, favsRes, histRes] = await Promise.all([
      client.from('spytify_profiles').select('*').eq('id', userId).maybeSingle(),
      client.from('spytify_albums').select('*').eq('user_id', userId),
      client.from('spytify_favorites').select('*').eq('user_id', userId),
      client.from('spytify_history').select('*').eq('user_id', userId).order('listened_at', { ascending: false }).limit(30),
    ]);

    const result: CloudUserData = {
      albums: [],
      favorites: [],
      history: [],
    };

    if (profileRes.data) {
      result.avatar = profileRes.data.avatar || undefined;
      result.accentColor = profileRes.data.accent_color || undefined;
      result.themeMode = profileRes.data.theme_mode || undefined;
      result.language = profileRes.data.language || undefined;
    }

    if (albumsRes.data) {
      result.albums = albumsRes.data.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description || '',
        tracks: row.tracks || [],
        created_at: row.created_at || new Date().toISOString(),
      }));
    }

    if (favsRes.data) {
      result.favorites = favsRes.data.map((row: any) => row.track_json as Track).filter(Boolean);
    }

    if (histRes.data) {
      result.history = histRes.data.map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        track_id: row.track_id,
        track_title: row.track_title,
        artist: row.artist,
        source: row.source,
        duration_secs: row.duration_secs,
        path_or_url: row.path_or_url,
        cover_art: row.cover_art,
        track_json: row.track_json ? (typeof row.track_json === 'string' ? row.track_json : JSON.stringify(row.track_json)) : undefined,
        listened_at: row.listened_at,
      }));
    }

    return result;
  } catch (err) {
    console.error('Supabase cloud pull failed:', err);
    return null;
  }
}
