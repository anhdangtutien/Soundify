use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: u64,
    pub path_or_url: String,
    pub cover_art: Option<String>,
    pub source: TrackSource,
    pub file_size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TrackSource {
    Local,
    YouTube,
    Audius,
    SoundCloud,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackStatus {
    pub is_playing: bool,
    pub current_time_secs: f64,  // f64 for smooth sub-second precision
    pub duration_secs: u64,
    pub volume: f32,
    pub current_track: Option<Track>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: u64,
    pub source: TrackSource,
    pub url_or_id: String,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub avatar: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStats {
    pub total_played: u64,
    pub favorite_count: u64,
    pub top_artist: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    pub id: i64,
    pub user_id: String,
    pub track_id: String,
    pub track_title: String,
    pub artist: String,
    pub source: String,
    pub duration_secs: u64,
    pub listened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationResult {
    pub track: Track,
    pub match_score: f32, // 0.0 to 100.0%
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingReport {
    pub epochs: u32,
    pub accuracy: f32,
    pub tracks_analyzed: usize,
    pub top_genres: Vec<String>,
    pub status: String,
}
