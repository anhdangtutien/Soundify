export type TrackSource = 'local' | 'youtube' | 'soundcloud' | 'audius';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration_secs: number;
  path_or_url: string;
  cover_art?: string | null;
  source: TrackSource;
  file_size_bytes?: number | null;
}

export interface PlaybackStatus {
  is_playing: boolean;
  current_time_secs: number;
  duration_secs: number;
  volume: number;
  current_track: Track | null;
}

export interface SearchResult {
  title: string;
  artist: string;
  album: string;
  duration_secs: number;
  source: TrackSource;
  url_or_id: string;
  thumbnail?: string | null;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar?: string | null;
  created_at: string;
}

export interface UserStats {
  total_played: number;
  favorite_count: number;
  top_artist?: string | null;
}

export interface HistoryItem {
  id: number;
  user_id: string;
  track_id: string;
  track_title: string;
  artist: string;
  source: string;
  duration_secs: number;
  listened_at: string;
}

export interface RecommendationResult {
  track: Track;
  match_score: number;
  reason: string;
}

export interface TrainingReport {
  epochs: number;
  accuracy: number;
  tracks_analyzed: number;
  top_genres: string[];
  status: string;
}

export type ViewType =
  | 'library'
  | 'search'
  | 'local'
  | 'youtube'
  | 'audius'
  | 'favorites'
  | 'soundcloud'
  | 'profile'
  | 'ai_mix';
