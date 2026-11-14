pub mod ai;
pub mod audio;
pub mod db;
pub mod downloader;
pub mod models;
pub mod oauth;
pub mod rust_ui;
pub mod scanner;
pub mod sources;

use ai::MusicAiEngine;
use audio::AudioPlayerManager;
use db::DatabaseManager;
use rust_ui::{RustUiEngine, RustUiSnapshot};
use models::{
    HistoryItem, PlaybackStatus, RecommendationResult, SearchResult, Track, TrainingReport, User,
    UserStats,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WindowEvent,
};
use std::collections::HashMap;
use std::sync::Mutex;

static RELATED_CACHE: Mutex<Option<HashMap<String, Vec<SearchResult>>>> = Mutex::new(None);

#[cfg(target_os = "windows")]
mod win_mem {
    #[repr(C)]
    pub struct ProcessEntry32W {
        pub dw_size: u32,
        pub cnt_usage: u32,
        pub th32_process_id: u32,
        pub th32_default_heap_id: usize,
        pub th32_module_id: u32,
        pub cnt_threads: u32,
        pub th32_parent_process_id: u32,
        pub pc_pri_class_base: i32,
        pub dw_flags: u32,
        pub sz_exe_file: [u16; 260],
    }

    #[repr(C)]
    pub struct ProcessMemoryCounters {
        pub cb: u32,
        pub page_fault_count: u32,
        pub peak_working_set_size: usize,
        pub working_set_size: usize,
        pub quota_peak_paged_pool_usage: usize,
        pub quota_paged_pool_usage: usize,
        pub quota_peak_non_paged_pool_usage: usize,
        pub quota_non_paged_pool_usage: usize,
        pub pagefile_usage: usize,
        pub peak_pagefile_usage: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetCurrentProcess() -> isize;
        pub fn GetCurrentProcessId() -> u32;
        pub fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> isize;
        pub fn CloseHandle(object: isize) -> i32;
        pub fn K32EmptyWorkingSet(process: isize) -> i32;
        pub fn K32GetProcessMemoryInfo(process: isize, counters: *mut ProcessMemoryCounters, cb: u32) -> i32;
        pub fn CreateToolhelp32Snapshot(flags: u32, process_id: u32) -> isize;
        pub fn Process32FirstW(snapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
        pub fn Process32NextW(snapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
    }
}

#[cfg(target_os = "windows")]
fn get_tree_pids(root_pid: u32) -> std::collections::HashSet<u32> {
    use win_mem::*;
    let mut tree_pids = std::collections::HashSet::new();
    tree_pids.insert(root_pid);

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if snapshot != -1 && snapshot != 0 {
            let mut entries: Vec<(u32, u32)> = Vec::new();
            let mut entry: ProcessEntry32W = std::mem::zeroed();
            entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    entries.push((entry.th32_process_id, entry.th32_parent_process_id));
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            let mut added = true;
            while added {
                added = false;
                for &(pid, ppid) in &entries {
                    if tree_pids.contains(&ppid) && !tree_pids.contains(&pid) {
                        tree_pids.insert(pid);
                        added = true;
                    }
                }
            }
        }
    }
    tree_pids
}

#[cfg(target_os = "windows")]
pub fn get_tree_working_set() -> usize {
    use win_mem::*;
    let mut total_bytes = 0usize;
    unsafe {
        let root_pid = GetCurrentProcessId();
        let tree_pids = get_tree_pids(root_pid);

        for pid in tree_pids {
            let h_proc = if pid == root_pid {
                GetCurrentProcess()
            } else {
                OpenProcess(0x0400 | 0x1000, 0, pid) // PROCESS_QUERY_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION
            };
            if h_proc != 0 {
                let mut counters: ProcessMemoryCounters = std::mem::zeroed();
                counters.cb = std::mem::size_of::<ProcessMemoryCounters>() as u32;
                if K32GetProcessMemoryInfo(h_proc, &mut counters, counters.cb) != 0 {
                    total_bytes += counters.working_set_size;
                }
                if pid != root_pid {
                    CloseHandle(h_proc);
                }
            }
        }
    }
    total_bytes
}

#[cfg(target_os = "windows")]
pub fn trim_single_process_tree() {
    use win_mem::*;
    unsafe {
        let root_pid = GetCurrentProcessId();
        let tree_pids = get_tree_pids(root_pid);

        for pid in tree_pids {
            let h_proc = if pid == root_pid {
                GetCurrentProcess()
            } else {
                OpenProcess(0x0400 | 0x0100, 0, pid) // PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA
            };
            if h_proc != 0 {
                K32EmptyWorkingSet(h_proc);
                if pid != root_pid {
                    CloseHandle(h_proc);
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn trim_process_memory() {
    trim_single_process_tree();
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(450));
        trim_single_process_tree();
    });
}

#[cfg(not(target_os = "windows"))]
pub fn trim_process_memory() {}

#[tauri::command]
fn trim_memory() -> Result<(), String> {
    trim_process_memory();
    Ok(())
}

#[tauri::command]
async fn resolve_youtube_music_stream(
    video_id: String,
    title: String,
    artist: String,
) -> Result<sources::youtube::YoutubeAudioStream, String> {
    sources::youtube::resolve_youtube_music_stream(&video_id, &title, &artist).await
}

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

fn filter_actual_songs(results: Vec<SearchResult>) -> Vec<SearchResult> {
    let banned_keywords = [
        "bảng xếp hạng", "bxh", "ranking", "xếp hạng", "top 10 ", "top 10:", "top 10 -",
        "top 20", "top 50", "top 100", "top 100:", "top 50:", "countdown", "leaderboard",
        "compilation", "tổng hợp", "những bài hát", "full album", "mixtape", "nonstop",
        "liên khúc", "review", "reaction", "mashup", "hay nhất mọi thời đại", "tuyển tập",
        "ca khúc hay nhất", "bài hát hay nhất", "best songs of", "top songs of", "top hits of",
        "billboard hot 100 top", "billboard 2024", "billboard 2025", "10 hour", "1 hour",
        "2 hour", "3 hour", "podcast", "livestream", "24/7", "trực tiếp", "karaoke", "beat chuẩn"
    ];

    let mut unique: Vec<SearchResult> = Vec::new();
    for r in results {
        let t = r.title.to_lowercase();
        if banned_keywords.iter().any(|&k| t.contains(k)) {
            continue;
        }
        if r.duration_secs < 60 || r.duration_secs > 480 {
            continue;
        }
        let t_norm = r.title.trim().to_lowercase();
        if !unique.iter().any(|u| u.url_or_id == r.url_or_id || u.title.trim().to_lowercase() == t_norm) {
            unique.push(r);
        }
    }
    unique
}

#[tauri::command]
async fn get_trending_hits(category: String) -> Result<Vec<SearchResult>, String> {
    let raw = match category.to_lowercase().as_str() {
        "cortisol" | "low_cortisol" => {
            return sources::youtube::search_youtube("low cortisol playlist peaceful chill study relax aesthetic").await;
        }
        "working" | "deep_focus" => {
            return sources::youtube::search_youtube("deep focus music for working study coding lofi ambient chill").await;
        }
        "lockin" | "grind" => {
            return sources::youtube::search_youtube("lock in playlist study grind phonk focus aesthetic beats").await;
        }
        "gym" | "workout" => {
            return sources::youtube::search_youtube("gym workout motivation aggressive phonk edm beast mode bass").await;
        }
        "nightdrive" => {
            return sources::youtube::search_youtube("late night drive synthwave phonk chill playlist aesthetic").await;
        }
        "usuk" | "global" => {
            sources::youtube::search_youtube("global top hits official music video audio").await
        }
        "kpop_jpop" | "kpop" | "jpop" => {
            sources::youtube::search_youtube("kpop jpop viral hits official mv audio").await
        }
        "vpop" | "vietnam" => {
            sources::youtube::search_youtube("vpop thinh hanh official music video").await
        }
        "audius" => return sources::audius::get_trending_audius(20).await,
        "lofi" => {
            return sources::youtube::search_youtube("lofi hip hop radio beats to relax study to live chill").await;
        }
        "edm" => {
            sources::youtube::search_youtube("festival edm electronic dance banger official audio").await
        }
        _ => {
            // Priority: US/UK -> K-Pop/J-Pop -> V-Pop
            let (usuk_res, asian_res, vpop_res) = tokio::join!(
                sources::youtube::search_youtube("global top hits official music video audio"),
                sources::youtube::search_youtube("kpop jpop viral hits official mv audio"),
                sources::youtube::search_youtube("vpop thinh hanh official music video")
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
    };

    match raw {
        Ok(list) => Ok(filter_actual_songs(list)),
        Err(e) => Err(e),
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
        "official audio", "official video", "lyrics", "full audio", "hd", "4k",
        "(edit", "[edit", "(remix", "[remix", "(cover", "[cover",
        "(slowed", "[slowed", "(sped up", "[sped up", "(tiktok", "[tiktok",
        "(live", "[live", "(acoustic", "[acoustic"
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

    // 0. Instant in-memory cache check (0ms response)
    let cache_key = format!("{}::{}", clean_artist.to_lowercase(), core_lower);
    if let Ok(guard) = RELATED_CACHE.lock() {
        if let Some(map) = guard.as_ref() {
            if let Some(cached) = map.get(&cache_key) {
                if !cached.is_empty() {
                    return Ok(cached.clone());
                }
            }
        }
    }

    // 1. Fetch diverse related music:
    // Focus strongly on the actual song's genre and artist, avoiding obscure cover channel names
    let has_valid_artist = !clean_artist.is_empty() 
        && clean_artist.to_lowercase() != "unknown" 
        && !clean_artist.to_lowercase().contains("topic")
        && !clean_artist.to_lowercase().contains("vevo")
        && !clean_artist.to_lowercase().contains("records");

    let yt_query1 = if has_valid_artist {
        format!("music like {} {} top hits official audio", clean_artist, core_title)
    } else {
        format!("songs like {} hits official audio", core_title)
    };

    let yt_query2 = if has_valid_artist {
        format!("{} top tracks official music video audio", clean_artist)
    } else {
        format!("{} similar music hits playlist", core_title)
    };

    let sc_query = if has_valid_artist {
        format!("{} {} remix hits", clean_artist, core_title)
    } else {
        format!("{} remix hits", core_title)
    };

    let audius_query = if has_valid_artist {
        clean_artist.to_string()
    } else {
        core_title.clone()
    };

    // Fast-path: YouTube is our primary provider (~200ms). Secondary sources get a 1500ms timeout.
    let yt_fut1 = tokio::time::timeout(tokio::time::Duration::from_millis(3000), sources::youtube::search_youtube(&yt_query1));
    let yt_fut2 = tokio::time::timeout(tokio::time::Duration::from_millis(3000), sources::youtube::search_youtube(&yt_query2));
    let sc_fut = tokio::time::timeout(tokio::time::Duration::from_millis(1500), sources::soundcloud::search_soundcloud(&sc_query));
    let audius_fut = tokio::time::timeout(tokio::time::Duration::from_millis(1500), sources::audius::search_audius(&audius_query));

    let (yt_res1, yt_res2, sc_res, audius_res) = tokio::join!(yt_fut1, yt_fut2, sc_fut, audius_fut);

    let mut yt_list: Vec<SearchResult> = Vec::new();
    if let Ok(Ok(yt1)) = yt_res1 { yt_list.extend(yt1); }
    if let Ok(Ok(yt2)) = yt_res2 { yt_list.extend(yt2); }

    let sc_list: Vec<SearchResult> = match sc_res {
        Ok(Ok(sc)) => sc,
        _ => Vec::new(),
    };

    let audius_list: Vec<SearchResult> = match audius_res {
        Ok(Ok(audius)) => audius,
        _ => Vec::new(),
    };

    // 2. Strict Duration and Same-Song Filter:
    // - Eliminate tracks that are just other versions/remixes of the SAME song (e.g. "Closer")
    // - Eliminate audio longer than 10 minutes (600s)
    // - Eliminate compilations / 1-hour / livestream tracks
    let long_indicators = [
        "1 hour", "1hour", "1 hr", "2 hour", "2hour", "3 hour", "10 hour",
        "full album", "compilation", "mixtape", "nonstop", "continuous mix",
        "podcast", "livestream", "24/7", "trực tiếp"
    ];

    let filter_track = |r: &SearchResult| -> bool {
        let t = r.title.to_lowercase();
        if core_lower.len() >= 3 && t.contains(&core_lower) {
            return false;
        }
        if r.duration_secs > 600 {
            return false;
        }
        if long_indicators.iter().any(|&k| t.contains(k)) {
            return false;
        }
        true
    };

    yt_list.retain(filter_track);
    let mut sc_filtered = sc_list;
    sc_filtered.retain(filter_track);
    let mut audius_filtered = audius_list;
    audius_filtered.retain(filter_track);

    // Multi-source round-robin interleaving:
    // Guarantees rich variety across YouTube, SoundCloud, and Audius 320K
    let mut combined: Vec<SearchResult> = Vec::new();
    let max_len = yt_list.len().max(sc_filtered.len()).max(audius_filtered.len());

    for i in 0..max_len {
        if i < yt_list.len() {
            combined.push(yt_list[i].clone());
        }
        if i < sc_filtered.len() {
            combined.push(sc_filtered[i].clone());
        }
        if i < audius_filtered.len() {
            combined.push(audius_filtered[i].clone());
        }
    }

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

    // 3. Keep highest-relevance hits first, gently shuffle remaining alternatives
    let mut prioritized: Vec<SearchResult> = Vec::new();
    if !unique.is_empty() {
        prioritized.push(unique.remove(0));
    }
    if !unique.is_empty() {
        prioritized.push(unique.remove(0));
    }

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
    prioritized.extend(unique);

    if let Ok(mut guard) = RELATED_CACHE.lock() {
        let map = guard.get_or_insert_with(HashMap::new);
        if map.len() > 100 {
            map.clear();
        }
        map.insert(cache_key, prioritized.clone());
    }

    Ok(prioritized)
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
fn auth_import_user(
    id: String,
    username: String,
    email: Option<String>,
    password_hash: String,
    salt: String,
    display_name: String,
    avatar: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.import_user(&id, &username, email.as_deref(), &password_hash, &salt, &display_name, avatar.as_deref())
}

#[tauri::command]
fn auth_hash_password(password: String, salt: String) -> String {
    DatabaseManager::hash_password(&password, &salt)
}

#[tauri::command]
fn auth_get_credentials(user_id: String, db: State<'_, DatabaseManager>) -> Option<(String, String)> {
    db.get_user_credentials(&user_id)
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

#[tauri::command]
fn get_default_download_directory() -> Result<String, String> {
    Ok(downloader::Downloader::get_default_download_dir().to_string_lossy().to_string())
}

#[tauri::command]
async fn download_track(track: Track, target_dir: Option<String>) -> Result<Track, String> {
    downloader::Downloader::download(&track, target_dir).await
}

#[tauri::command]
fn rust_ui_get_snapshot(
    user_id: Option<String>,
    local_tracks: Option<Vec<Track>>,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
    db: State<'_, DatabaseManager>,
) -> Result<RustUiSnapshot, String> {
    if let Some(uid) = user_id {
        rust_ui.sync_from_db(&db, &uid);
    }
    if let Some(locals) = local_tracks {
        rust_ui.set_local_tracks(locals);
    }
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_switch_tab(
    tab: String,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.switch_tab(&tab);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_filter(
    query: String,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.set_search_query(&query);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
async fn rust_ui_search_online(
    query: String,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    let (yt_res, audius_res) = tokio::join!(
        sources::youtube::search_youtube(&query),
        sources::audius::search_audius(&query)
    );
    let mut combined = Vec::new();
    if let Ok(yt) = yt_res {
        combined.extend(yt);
    }
    if let Ok(au) = audius_res {
        combined.extend(au);
    }
    rust_ui.set_search_results(combined);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_play_index(
    index: usize,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<Option<Track>, String> {
    if let Some(track) = rust_ui.get_track_by_index(index) {
        audio.play(track.clone())?;
        return Ok(Some(track));
    }
    Ok(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_manager = AudioPlayerManager::new();
    let db_manager = DatabaseManager::new().expect("Failed to initialize SQLite database");
    let rust_ui_engine = RustUiEngine::new();

    tauri::Builder::default()
        .manage(audio_manager)
        .manage(db_manager)
        .manage(rust_ui_engine)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                let _ = window.emit("app-window-state", "normal");
            }
        }))
        .setup(|app| {
            // Setup System Tray
            let show_i = MenuItem::with_id(app, "show", "Hiện Spytify", true, None::<&str>)?;
            let toggle_play_i = MenuItem::with_id(app, "toggle_play", "Tạm dừng / Phát tiếp", true, None::<&str>)?;
            let prev_i = MenuItem::with_id(app, "prev", "Bài trước đó", true, None::<&str>)?;
            let next_i = MenuItem::with_id(app, "next", "Bài tiếp theo", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Thoát ứng dụng", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &toggle_play_i, &prev_i, &next_i, &quit_i])?;

            let mut builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Spytify - Spy Music")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit("app-window-state", "normal");
                            }
                        }
                        "toggle_play" => {
                            let _ = app.emit("tray-toggle-play", ());
                        }
                        "prev" => {
                            let _ = app.emit("tray-prev-track", ());
                        }
                        "next" => {
                            let _ = app.emit("tray-next-track", ());
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("app-window-state", "normal");
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            builder.build(app)?;

            // Background dynamic RAM watchdog (Keeps foreground RAM around ~200MB, tray ~30-60MB)
            #[cfg(target_os = "windows")]
            {
                std::thread::spawn(|| {
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(15));
                        // If total process tree exceeds ~210MB, gently trim back down to maintain ~200MB range
                        if get_tree_working_set() > 210 * 1024 * 1024 {
                            trim_single_process_tree();
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    // Hide window to tray on close to allow background audio playback
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.emit("app-window-state", "hidden");
                    trim_process_memory();
                }
                WindowEvent::Resized(_) => {
                    if let Ok(true) = window.is_minimized() {
                        let _ = window.emit("app-window-state", "minimized");
                        trim_process_memory();
                    } else {
                        let _ = window.emit("app-window-state", "normal");
                    }
                }
                _ => {}
            }
        })
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
            auth_import_user,
            auth_hash_password,
            auth_get_credentials,
            save_text_file,
            read_text_file,
            db_get_favorites,
            db_toggle_favorite,
            db_add_history,
            db_get_history,
            db_get_stats,
            ai_train_model,
            ai_recommend_tracks,
            ai_smart_dj_next,
            get_default_download_directory,
            download_track,
            trim_memory,
            resolve_youtube_music_stream,
            rust_ui_get_snapshot,
            rust_ui_switch_tab,
            rust_ui_filter,
            rust_ui_search_online,
            rust_ui_play_index
        ])
        .run(tauri::generate_context!())
        .expect("error while running soundify application");
}
