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
async fn get_search_suggestions(query: String) -> Result<Vec<String>, String> {
    let clean = query.trim();
    if clean.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://suggestqueries.google.com/complete/search")
        .query(&[("client", "firefox"), ("ds", "yt"), ("q", clean)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let val = res.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    let mut suggestions = Vec::new();

    if let Some(arr) = val.get(1).and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                suggestions.push(s.to_string());
            }
        }
    }

    Ok(suggestions)
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

fn extract_core_song_title(raw_title: &str, artist: &str) -> String {
    let mut t = raw_title.trim().to_string();
    
    // If title is "Artist - Song Title", strip the artist part
    if let Some((_, song)) = t.split_once(" - ") {
        t = song.to_string();
    } else if let Some((_, song)) = t.split_once(" – ") {
        t = song.to_string();
    } else if let Some((_, song)) = t.split_once(" : ") {
        t = song.to_string();
    }

    // Strip out common clutter: (Official Video), [MV], (Lyric Video), feat., ft., etc.
    let patterns = [
        "(official", "[official", "(video", "[video", "(audio", "[audio",
        "(lyric", "[lyric", "(mv", "[mv", "(visualizer", "[visualizer",
        "(feat", "[feat", "(ft.", "[ft.", "(prod.", "[prod.", "official music video",
        "official audio", "official video", "lyrics", "full audio", "hd", "4k"
    ];

    let mut lower = t.to_lowercase();
    for p in patterns {
        if let Some(idx) = lower.find(p) {
            t.truncate(idx);
            lower.truncate(idx);
        }
    }

    // Remove artist name if it still lingers in title
    let art_lower = artist.to_lowercase();
    if !art_lower.is_empty() && lower.contains(&art_lower) {
        t = t.replace(artist, "");
    }

    let core = t.trim().trim_matches(|c: char| !c.is_alphanumeric()).trim().to_string();
    if core.is_empty() {
        raw_title.trim().to_string()
    } else {
        core
    }
}

#[tauri::command]
async fn get_related_tracks(title: String, artist: String) -> Result<Vec<SearchResult>, String> {
    let clean_artist = artist.trim();
    let clean_title = title.trim();
    let core_title = extract_core_song_title(clean_title, clean_artist);
    let core_lower = core_title.to_lowercase();

    // 1. Fetch diverse related music:
    // - Search 1: Other hits and popular songs by this artist / genre
    // - Search 2: Songs from similar artists in the same style
    // - Search 3: SoundCloud tracks in this genre
    // - Search 4: Audius open hi-fi tracks
    let yt_query1 = if !clean_artist.is_empty() && clean_artist.to_lowercase() != "unknown" {
        format!("{} top hits official audio", clean_artist)
    } else {
        format!("{} songs similar genre audio", core_title)
    };

    let yt_query2 = if !clean_artist.is_empty() && clean_artist.to_lowercase() != "unknown" {
        format!("artists similar to {} music hits", clean_artist)
    } else {
        format!("music like {} hits audio", core_title)
    };

    let sc_query = if !clean_artist.is_empty() && clean_artist.to_lowercase() != "unknown" {
        format!("{} remix hits", clean_artist)
    } else {
        format!("{} remix", core_title)
    };

    let audius_query = if !clean_artist.is_empty() && clean_artist.to_lowercase() != "unknown" {
        clean_artist.to_string()
    } else {
        "trending electronic pop".to_string()
    };

    let (yt_res1, yt_res2, sc_res, audius_res) = tokio::join!(
        sources::youtube::search_youtube(&yt_query1),
        sources::youtube::search_youtube(&yt_query2),
        sources::soundcloud::search_soundcloud(&sc_query),
        sources::audius::search_audius(&audius_query)
    );

    let mut combined: Vec<SearchResult> = Vec::new();

    if let Ok(yt1) = yt_res1 { combined.extend(yt1); }
    if let Ok(yt2) = yt_res2 { combined.extend(yt2); }
    if let Ok(sc) = sc_res { combined.extend(sc); }
    if let Ok(audius) = audius_res { combined.extend(audius); }

    // 2. Strict Duration and Same-Song Filter:
    // - Eliminate tracks that are just other versions/remixes of the SAME song (e.g. "Closer")
    // - Eliminate audio longer than 10 minutes (600s)
    // - Eliminate compilations / 1-hour / livestream tracks
    let long_indicators = [
        "1 hour", "1hour", "1 hr", "2 hour", "2hour", "3 hour", "10 hour",
        "full album", "compilation", "mixtape", "nonstop", "continuous mix",
        "podcast", "livestream", "24/7", "trực tiếp"
    ];

    combined.retain(|r| {
        let t = r.title.to_lowercase();

        // Strictly eliminate any song containing the core title keyword if core_title has at least 3 chars
        if core_lower.len() >= 3 && t.contains(&core_lower) {
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

    // Deduplicate by title similarity
    let mut unique: Vec<SearchResult> = Vec::new();
    for item in combined {
        let item_title_norm = item.title.trim().to_lowercase();
        if !unique.iter().any(|u| {
            let u_title_norm = u.title.trim().to_lowercase();
            u_title_norm == item_title_norm || u.url_or_id == item.url_or_id
        }) {
            unique.push(item);
        }
    }

    // 3. Shuffle results randomly
    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(42) as usize;

    if unique.len() > 1 {
        for i in (1..unique.len()).rev() {
            let j = (seed.wrapping_add(i * 7919)) % (i + 1);
            unique.swap(i, j);
        }
    }

    Ok(unique)
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
            get_search_suggestions,
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
