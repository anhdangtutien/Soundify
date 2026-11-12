use crate::models::{Track, TrackSource};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma", "webm"];

pub fn scan_folder<P: AsRef<Path>>(folder_path: P) -> Vec<Track> {
    let path = folder_path.as_ref();
    if !path.exists() || !path.is_dir() {
        return Vec::new();
    }

    // Step 1: Collect all audio candidate file paths using walkdir
    let audio_files: Vec<PathBuf> = WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| {
            let path = e.path();
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    return Some(path.to_path_buf());
                }
            }
            None
        })
        .collect();

    // Step 2: Extract metadata in parallel across all CPU cores with Rayon
    audio_files
        .par_iter()
        .filter_map(|file_path| extract_track_info(file_path))
        .collect()
}

pub fn extract_track_info(file_path: &Path) -> Option<Track> {
    let file_size = fs::metadata(file_path).map(|m| m.len()).ok();
    let filename = file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown Track")
        .to_string();

    let path_str = file_path.to_string_lossy().to_string();
    let id = format!("local_{:x}", md5_hash(&path_str));

    // Try reading metadata tags with lofty
    match Probe::open(file_path).and_then(|p| p.read()) {
        Ok(tagged_file) => {
            let duration = tagged_file.properties().duration().as_secs();
            let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

            let mut title = filename.clone();
            let mut artist = "Unknown Artist".to_string();
            let mut album = "Unknown Album".to_string();
            let mut cover_art = None;

            if let Some(t) = tag {
                if let Some(t_title) = t.title() {
                    let s = t_title.trim();
                    if !s.is_empty() {
                        title = s.to_string();
                    }
                }
                if let Some(t_artist) = t.artist() {
                    let s = t_artist.trim();
                    if !s.is_empty() {
                        artist = s.to_string();
                    }
                }
                if let Some(t_album) = t.album() {
                    let s = t_album.trim();
                    if !s.is_empty() {
                        album = s.to_string();
                    }
                }

                if let Some(pic) = t.pictures().first() {
                    let mime = pic.mime_type().map(|m| m.as_str()).unwrap_or("image/jpeg");
                    let b64 = BASE64.encode(pic.data());
                    cover_art = Some(format!("data:{};base64,{}", mime, b64));
                }
            }

            Some(Track {
                id,
                title,
                artist,
                album,
                duration_secs: duration,
                path_or_url: path_str,
                cover_art,
                source: TrackSource::Local,
                file_size_bytes: file_size,
            })
        }
        Err(_) => {
            // Fallback for audio files without valid tags
            Some(Track {
                id,
                title: filename,
                artist: "Local File".to_string(),
                album: "Local Music".to_string(),
                duration_secs: 0,
                path_or_url: path_str,
                cover_art: None,
                source: TrackSource::Local,
                file_size_bytes: file_size,
            })
        }
    }
}

// Simple fast hash for track IDs
fn md5_hash(input: &str) -> u64 {
    let mut hash: u64 = 5381;
    for byte in input.bytes() {
        hash = ((hash << 5).wrapping_add(hash)).wrapping_add(byte as u64);
    }
    hash
}
