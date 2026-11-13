use crate::models::{Track, TrackSource};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::probe::Probe;
use lofty::tag::{Accessor, Tag, TagExt};
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

            // Fallback for cover art if not embedded in audio tags: check companion image files in folder
            if cover_art.is_none() {
                if let Some(parent) = file_path.parent() {
                    let candidates = [
                        file_path.with_extension("jpg"),
                        file_path.with_extension("jpeg"),
                        file_path.with_extension("png"),
                        parent.join("cover.jpg"),
                        parent.join("cover.png"),
                        parent.join("folder.jpg"),
                    ];
                    for c in &candidates {
                        if c.exists() && c.is_file() {
                            if let Ok(data) = fs::read(c) {
                                if !data.is_empty() && data.len() <= 5 * 1024 * 1024 {
                                    let mime = if c.extension().map(|e| e == "png").unwrap_or(false) {
                                        "image/png"
                                    } else {
                                        "image/jpeg"
                                    };
                                    cover_art = Some(format!("data:{};base64,{}", mime, BASE64.encode(&data)));
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Fallback: If artist is unknown, missing, or generic ("Unknown Artist", "Local File", etc.), parse from filename
            let is_artist_generic = artist == "Unknown Artist" || artist == "Local File" || artist.trim().is_empty();
            let is_title_generic = title == "Unknown Track" || title == filename || title.trim().is_empty();

            if is_artist_generic {
                let (parsed_artist, parsed_title) = parse_artist_title_from_filename(&filename);
                artist = parsed_artist;
                if is_title_generic {
                    title = parsed_title;
                }
                // Save resolved metadata to file tags so future scans & external music players recognize it
                let _ = write_metadata(file_path, &title, &artist, &album, None);
            }

            if album == "Unknown Album" || album.trim().is_empty() {
                album = "Spytify Library".to_string();
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
            let (parsed_artist, parsed_title) = parse_artist_title_from_filename(&filename);
            let album = "Spytify Library".to_string();
            let _ = write_metadata(file_path, &parsed_title, &parsed_artist, &album, None);

            Some(Track {
                id,
                title: parsed_title,
                artist: parsed_artist,
                album,
                duration_secs: 0,
                path_or_url: path_str,
                cover_art: None,
                source: TrackSource::Local,
                file_size_bytes: file_size,
            })
        }
    }
}

pub fn parse_artist_title_from_filename(filename: &str) -> (String, String) {
    let raw = filename.trim();
    if raw.is_empty() {
        return ("Local Artist".to_string(), "Unknown Track".to_string());
    }

    // Split by common delimiters: " - ", " -- ", or " – "
    let delimiter = if raw.contains(" - ") {
        " - "
    } else if raw.contains(" -- ") {
        " -- "
    } else if raw.contains(" – ") {
        " – "
    } else {
        ""
    };

    if delimiter.is_empty() {
        return ("Local Artist".to_string(), raw.to_string());
    }

    let parts: Vec<&str> = raw
        .split(delimiter)
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if parts.len() == 1 {
        return ("Local Artist".to_string(), parts[0].to_string());
    }

    if parts.len() == 2 {
        return clean_artist_title_pair(parts[0], parts[1]);
    }

    // parts.len() >= 3:
    // Check if parts[0] duplicates parts[1] (e.g. "The Weeknd - The Weeknd - The Hills" or "Ngọt - Ngọt - HẾT THỜI")
    let p0_lower = parts[0].to_lowercase();
    let p1_lower = parts[1].to_lowercase();

    if p0_lower == p1_lower || p0_lower.contains(&p1_lower) || p1_lower.contains(&p0_lower) {
        let artist_part = if parts[1].len() <= parts[0].len() { parts[1] } else { parts[0] };
        let rest_title = parts[2..].join(" - ");
        return clean_artist_title_pair(artist_part, &rest_title);
    }

    // Check if parts[0] is an aggregator/channel/label name:
    // e.g. "BBCRadio1VEVO", "R&BHype", "HYBE LABELS", "1 Giờ Chill", "Lofi Fruits Music", "K8V"
    let is_curator = p0_lower.contains("vevo")
        || p0_lower.contains("official")
        || p0_lower.contains("hype")
        || p0_lower.contains("labels")
        || p0_lower.contains("records")
        || p0_lower.contains("fruits")
        || p0_lower.contains("chill")
        || p0_lower.contains("studio")
        || p0_lower.contains("channel")
        || p0_lower.contains("và ")
        || p0_lower.contains(" & ")
        || parts[0].len() <= 4;

    if is_curator {
        let rest_title = parts[2..].join(" - ");
        return clean_artist_title_pair(parts[1], &rest_title);
    }

    // Default 3+ parts: parts[0] is artist, parts[1..] is title
    clean_artist_title_pair(parts[0], &parts[1..].join(" - "))
}

fn clean_artist_title_pair(raw_artist: &str, raw_title: &str) -> (String, String) {
    let mut artist = raw_artist.trim().to_string();
    let mut title = raw_title.trim().to_string();

    // Clean artist:
    let lower_artist = artist.to_lowercase();
    if lower_artist.starts_with("official ") {
        artist = artist[9..].trim().to_string();
    } else if lower_artist.ends_with(" official") {
        let len = artist.len();
        artist = artist[..len - 9].trim().to_string();
    } else if lower_artist.ends_with(" vevo") {
        let len = artist.len();
        artist = artist[..len - 5].trim().to_string();
    }

    // Clean title:
    let lower_title = title.to_lowercase();
    let lower_artist_clean = artist.to_lowercase();
    let redundant_prefix = format!("{} - ", lower_artist_clean);
    if lower_title.starts_with(&redundant_prefix) {
        title = title[redundant_prefix.len()..].trim().to_string();
    }

    if artist.is_empty() {
        artist = "Local Artist".to_string();
    }
    if title.is_empty() {
        title = "Unknown Track".to_string();
    }

    (artist, title)
}

// Simple fast hash for track IDs
fn md5_hash(input: &str) -> u64 {
    let mut hash: u64 = 5381;
    for byte in input.bytes() {
        hash = ((hash << 5).wrapping_add(hash)).wrapping_add(byte as u64);
    }
    hash
}

pub fn write_metadata(
    file_path: &Path,
    title: &str,
    artist: &str,
    album: &str,
    cover_art_bytes: Option<(&[u8], &str)>,
) -> Result<(), Box<dyn std::error::Error>> {
    let probe = Probe::open(file_path)?;
    let mut tagged_file = probe.read()?;

    let tag = if let Some(t) = tagged_file.primary_tag_mut() {
        t
    } else if let Some(t) = tagged_file.first_tag_mut() {
        t
    } else {
        let tag_type = tagged_file.primary_tag_type();
        tagged_file.insert_tag(Tag::new(tag_type));
        match tagged_file.primary_tag_mut() {
            Some(t) => t,
            None => return Ok(()),
        }
    };

    tag.set_title(title.to_string());
    tag.set_artist(artist.to_string());
    tag.set_album(album.to_string());

    if let Some((bytes, mime_str)) = cover_art_bytes {
        if !bytes.is_empty() {
            let mime = if mime_str.contains("png") {
                MimeType::Png
            } else {
                MimeType::Jpeg
            };
            let pic = Picture::new_unchecked(
                PictureType::CoverFront,
                Some(mime),
                None,
                bytes.to_vec(),
            );
            tag.push_picture(pic);
        }
    }

    let _ = tag.save_to_path(file_path, WriteOptions::default());
    Ok(())
}
