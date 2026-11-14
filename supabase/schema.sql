-- ==============================================================================
-- 🕵️‍♂️ SPYTIFY SPEC-OPS // SUPABASE CLOUD DATABASE SCHEMA
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- It creates the 4 cloud synchronization tables with Row Level Security policies.
-- ==============================================================================

-- 1. Profiles & UI Preferences Table
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

-- 2. User Albums Table
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

-- 3. User Favorites Table
CREATE TABLE IF NOT EXISTS public.spytify_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_favs_user_id ON public.spytify_favorites(user_id);

-- 4. User Playback History Table (Top 30 recent tracks with cover art & playback URLs)
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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.spytify_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for spytify_profiles" 
    ON public.spytify_profiles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write for spytify_albums" 
    ON public.spytify_albums FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write for spytify_favorites" 
    ON public.spytify_favorites FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write for spytify_history" 
    ON public.spytify_history FOR ALL USING (true) WITH CHECK (true);
