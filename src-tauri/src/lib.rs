pub mod ai;
pub mod audio;
pub mod db;
pub mod models;
pub mod oauth;
pub mod scanner;
pub mod sources;

use ai::MusicAiEngine;
use audio::AudioPlayerManager;
use db::DatabaseManager;
use models::{
    HistoryItem, PlaybackStatus, RecommendationResult, SearchResult, Track, TrainingReport, User,
    UserStats,
};
use tauri::State;

#[tauri::command]
fn scan_music_folder(folder_path: String) -> Result<Vec<Track>, String> {
    Ok(scanner::scan_folder(folder_path))
}

#[tauri::command]
fn play_track(track: Track, state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.play(track)
}

#[tauri::command]
fn pause_track(state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.pause()
}

#[tauri::command]
fn resume_track(state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.resume()
}

#[tauri::command]
fn stop_track(state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn set_volume(volume: f32, state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.set_volume(volume)
}

#[tauri::command]
fn seek_track(position_secs: u64, state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.seek(position_secs)
}

#[tauri::command]
fn get_playback_status(state: State<'_, AudioPlayerManager>) -> Result<PlaybackStatus, String> {
    Ok(state.get_status())
}

#[tauri::command]
async fn search_online(query: String, source: String) -> Result<Vec<SearchResult>, String> {
    match source.to_lowercase().as_str() {
        "youtube" => sources::youtube::search_youtube(&query).await,
        "audius" => sources::audius::search_audius(&query).await,
        "soundcloud" => sources::soundcloud::search_soundcloud(&query).await,
        _ => {
            let (yt_res, audius_res, sc_res) = tokio::join!(
                sources::youtube::search_youtube(&query),
                sources::audius::search_audius(&query),
                sources::soundcloud::search_soundcloud(&query),
            );
            let mut results = Vec::new();
            if let Ok(r) = yt_res { results.extend(r); }
            if let Ok(r) = audius_res { results.extend(r); }
            if let Ok(r) = sc_res { results.extend(r); }
            Ok(results)
        }
    }
}

#[tauri::command]
async fn get_trending_hits(category: String) -> Result<Vec<SearchResult>, String> {
    match category.to_lowercase().as_str() {
        "usuk" | "global" => {
            sources::youtube::search_youtube("billboard hot 100 hits us uk trending").await
        }
        "kpop_jpop" | "kpop" | "jpop" => {
            sources::youtube::search_youtube("top kpop jpop viral hits trending").await
        }
        "vpop" | "vietnam" => {
            sources::youtube::search_youtube("top hit vpop thinh hanh nhat hien nay").await
        }
        "audius" => sources::audius::get_trending_audius(20).await,
        "lofi" => {
            sources::youtube::search_youtube("lofi chill beats to relax study to").await
        }
        "edm" => {
            sources::youtube::search_youtube("top edm festival banger hits").await
        }
        _ => {
            // Priority: US/UK -> K-Pop/J-Pop -> V-Pop
            let (usuk_res, asian_res, vpop_res) = tokio::join!(
                sources::youtube::search_youtube("billboard hot 100 hits us uk trending"),
                sources::youtube::search_youtube("top trending kpop jpop hits"),
                sources::youtube::search_youtube("nhac tre thinh hanh top trending vietnam")
            );
            let mut list = Vec::new();
            if let Ok(usuk) = usuk_res {
                list.extend(usuk);
            }
            if let Ok(asian) = asian_res {
                list.extend(asian);
            }
            if let Ok(vpop) = vpop_res {
                list.extend(vpop);
            }
            Ok(list)
        }
    }
}

#[tauri::command]
async fn get_related_tracks(title: String, artist: String) -> Result<Vec<SearchResult>, String> {
    let clean_artist = artist.trim();
    let clean_title = title.trim();

    // 1. Fetch concurrently from ALL 3 SOURCES: YouTube, SoundCloud, and Audius
    let yt_query = format!("{} songs similar to {}", clean_artist, clean_title);
    let sc_query = format!("{} {}", clean_artist, clean_title);
    let audius_query = format!("{} chill", clean_artist);

    let (yt_res, sc_res, audius_res) = tokio::join!(
        sources::youtube::search_youtube(&yt_query),
        sources::soundcloud::search_soundcloud(&sc_query),
        sources::audius::search_audius(&audius_query)
    );

    let mut combined: Vec<SearchResult> = Vec::new();

    // YouTube results
    if let Ok(mut yt) = yt_res {
        if yt.is_empty() {
            if let Ok(extra) = sources::youtube::search_youtube(&format!("{} official audio", clean_artist)).await {
                yt = extra;
            }
        }
        combined.extend(yt);
    }

    // SoundCloud results (remixes, indie gems)
    if let Ok(sc) = sc_res {
        combined.extend(sc);
    }

    // Audius results (320kbps Lossless decentralized)
    if let Ok(audius) = audius_res {
        combined.extend(audius);
    }

    // 2. Strict Duration and Keyword Filter:
    // - Eliminate 1-hour / 2-hour long compilations, podcasts, non-stop mixes
    // - Strongly prioritize tracks under 10 minutes (<= 600s)
    let title_lower = clean_title.to_lowercase();
    let long_indicators = [
        "1 hour", "1hour", "1 hr", "2 hour", "2hour", "3 hour", "10 hour",
        "full album", "compilation", "mixtape", "nonstop", "continuous mix",
        "podcast", "livestream", "24/7", "trực tiếp"
    ];

    combined.retain(|r| {
        let t = r.title.to_lowercase();

        // Filter out same title
        if t == title_lower || t.contains(&title_lower) || title_lower.contains(&t) {
            return false;
        }

        // Filter out audio longer than 10 minutes (600 seconds)
        if r.duration_secs > 600 {
            return false;
        }

        // Filter out titles with 1-hour/compilation keywords
        if long_indicators.iter().any(|&k| t.contains(k)) {
            return false;
        }

        true
    });

    // 3. Shuffle & interleave all 3 sources randomly
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(42) as usize;

    if combined.len() > 1 {
        for i in (1..combined.len()).rev() {
            let j = (seed.wrapping_add(i * 7919)) % (i + 1);
            combined.swap(i, j);
        }
    }

    Ok(combined)
}

// ─── DATABASE & AUTH COMMANDS ────────────────────────────────────────────────

#[tauri::command]
fn auth_register(
    username: String,
    email: Option<String>,
    password: String,
    display_name: String,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.register(&username, email.as_deref(), &password, &display_name)
}

#[tauri::command]
fn auth_login(
    username: String,
    password: String,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.login(&username, &password)
}

#[tauri::command]
fn auth_google_login(
    google_id: String,
    email: String,
    display_name: String,
    avatar: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.google_login(&google_id, &email, &display_name, avatar.as_deref())
}

#[tauri::command]
async fn auth_start_google_oauth(
    custom_client_id: Option<String>,
    client_secret: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    oauth::perform_google_oauth(custom_client_id, client_secret, &db).await
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn auth_update_avatar(
    user_id: String,
    avatar: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.update_avatar(&user_id, &avatar)
}

#[tauri::command]
fn auth_get_current_user(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<Option<User>, String> {
    db.get_user_by_id(&user_id)
}

#[tauri::command]
fn db_get_favorites(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<Track>, String> {
    db.get_favorites(&user_id)
}

#[tauri::command]
fn db_toggle_favorite(
    user_id: String,
    track: Track,
    db: State<'_, DatabaseManager>,
) -> Result<bool, String> {
    db.toggle_favorite(&user_id, &track)
}

#[tauri::command]
fn db_add_history(
    user_id: String,
    track: Track,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.add_history(&user_id, &track)
}

#[tauri::command]
fn db_get_history(
    user_id: String,
    limit: Option<u32>,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<HistoryItem>, String> {
    db.get_history(&user_id, limit.unwrap_or(30))
}

#[tauri::command]
fn db_get_stats(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<UserStats, String> {
    db.get_stats(&user_id)
}

// ─── ON-DEVICE AI COMMANDS ───────────────────────────────────────────────────

#[tauri::command]
fn ai_train_model(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<TrainingReport, String> {
    Ok(MusicAiEngine::train_model(&user_id, &db))
}

#[tauri::command]
fn ai_recommend_tracks(
    user_id: String,
    candidates: Vec<Track>,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<RecommendationResult>, String> {
    Ok(MusicAiEngine::recommend(&user_id, &candidates, &db))
}

#[tauri::command]
fn ai_smart_dj_next(
    current_track: Track,
    candidates: Vec<Track>,
) -> Result<Option<Track>, String> {
    Ok(MusicAiEngine::smart_dj_next(&current_track, &candidates))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_manager = AudioPlayerManager::new();
    let db_manager = DatabaseManager::new().expect("Failed to initialize SQLite database");

    tauri::Builder::default()
        .manage(audio_manager)
        .manage(db_manager)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_music_folder,
            play_track,
            pause_track,
            resume_track,
            stop_track,
            set_volume,
            seek_track,
            get_playback_status,
            search_online,
            get_related_tracks,
            get_trending_hits,
            auth_register,
            auth_login,
            auth_google_login,
            auth_start_google_oauth,
            auth_get_current_user,
            auth_update_avatar,
            save_text_file,
            read_text_file,
            db_get_favorites,
            db_toggle_favorite,
            db_add_history,
            db_get_history,
            db_get_stats,
            ai_train_model,
            ai_recommend_tracks,
            ai_smart_dj_next
        ])
        .run(tauri::generate_context!())
        .expect("error while running soundify application");
}
