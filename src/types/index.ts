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
  is_downloaded?: boolean;
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
  email?: string | null;
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
  path_or_url?: string;
  cover_art?: string | null;
  track_json?: string;
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

export interface UserAlbum {
  id: string;
  title: string;
  description?: string;
  cover_art?: string | null;
  tracks: Track[];
  created_at: string;
}

export type ViewType =
  | 'library'
  | 'search'
  | 'local'
  | 'youtube'
  | 'audius'
  | 'favorites'
  | 'albums'
  | 'soundcloud'
  | 'profile'
  | 'ai_mix'
  | 'community';

export interface CommunityChannel {
  id: string;
  name: string;
  type: 'text' | 'stage' | 'voice';
  topic?: string;
}

export interface VoiceParticipant {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  isHost?: boolean;
}

export interface CommunityServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  badge?: string;
  accent_color: string;
  channels: CommunityChannel[];
  is_verified?: boolean;
}

export interface CommunityMessage {
  id: string;
  server_id: string;
  channel_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string | null;
  content: string;
  created_at: string;
  track_embed?: Track | null;
}

export interface StageSession {
  server_id: string;
  channel_id: string;
  host_user_id: string;
  host_name: string;
  current_track: Track | null;
  position_secs: number;
  is_playing: boolean;
  listener_count: number;
  updated_at: number;
}
