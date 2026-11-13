use crate::models::{Track, TrackSource};
use crate::scanner;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command as SyncCommand;
use tokio::process::Command as AsyncCommand;

pub struct Downloader;

impl Downloader {
    pub fn get_default_download_dir() -> PathBuf {
        let music_dir = dirs_fallback_music().unwrap_or_else(|| {
            std::env::var("USERPROFILE")
                .map(|p| PathBuf::from(p).join("Music"))
                .unwrap_or_else(|_| std::env::temp_dir())
        });
        let target = music_dir.join("Spytify");
        let _ = fs::create_dir_all(&target);
        target
    }

    pub fn sanitize_filename(name: &str) -> String {
        let forbidden = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
        let mut clean = String::new();
        for c in name.chars() {
            if forbidden.contains(&c) {
                clean.push('_');
            } else {
                clean.push(c);
            }
        }
        let trimmed = clean.trim().to_string();
        if trimmed.is_empty() {
            "track".to_string()
        } else {
            trimmed
        }
    }

    pub fn find_node_bin() -> Option<PathBuf> {
        // 1. Common Windows locations
        #[cfg(target_os = "windows")]
        {
            let d_node = PathBuf::from("D:\\NodeJS\\node.exe");
            if d_node.exists() {
                return Some(d_node);
            }
            let pf_node = PathBuf::from("C:\\Program Files\\nodejs\\node.exe");
            if pf_node.exists() {
                return Some(pf_node);
            }
        }

        // 2. Common macOS / Linux locations
        #[cfg(not(target_os = "windows"))]
        {
            for p in &["/usr/local/bin/node", "/opt/homebrew/bin/node", "/usr/bin/node"] {
                let pb = PathBuf::from(p);
                if pb.exists() {
                    return Some(pb);
                }
            }
        }

        // 3. Check system PATH
        #[cfg(target_os = "windows")]
        let cmd = "where";
        #[cfg(not(target_os = "windows"))]
        let cmd = "which";

        if let Ok(output) = SyncCommand::new(cmd).arg("node").output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = s.lines().next() {
                    let p = PathBuf::from(line.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
        None
    }

    pub fn find_ytdlp_bin() -> Option<PathBuf> {
        // 1. Check APPDATA or HOME
        #[cfg(target_os = "windows")]
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = PathBuf::from(appdata).join("snutify").join("bin").join("yt-dlp.exe");
            if p.exists() {
                return Some(p);
            }
        }
        #[cfg(not(target_os = "windows"))]
        if let Ok(home) = std::env::var("HOME") {
            let home_path = PathBuf::from(&home);
            let p = home_path.join(".local").join("bin").join("yt-dlp");
            if p.exists() {
                return Some(p);
            }
            let p2 = home_path.join(".spytify").join("bin").join("yt-dlp");
            if p2.exists() {
                return Some(p2);
            }
        }

        // 2. Common macOS Homebrew / Linux locations
        #[cfg(not(target_os = "windows"))]
        for p in &["/opt/homebrew/bin/yt-dlp", "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp"] {
            let pb = PathBuf::from(p);
            if pb.exists() {
                return Some(pb);
            }
        }

        // 3. Check current working directory / bin
        #[cfg(target_os = "windows")]
        let local_bin = PathBuf::from("bin").join("yt-dlp.exe");
        #[cfg(not(target_os = "windows"))]
        let local_bin = PathBuf::from("bin").join("yt-dlp");
        if local_bin.exists() {
            return Some(local_bin);
        }

        // 4. Check system PATH
        #[cfg(target_os = "windows")]
        let cmd = "where";
        #[cfg(not(target_os = "windows"))]
        let cmd = "which";

        if let Ok(output) = SyncCommand::new(cmd).arg("yt-dlp").output() {
            if output.status.success() {
                let s = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = s.lines().next() {
                    let p = PathBuf::from(line.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
        None
    }

    pub async fn ensure_ytdlp_available() -> Result<PathBuf, String> {
        if let Some(existing) = Self::find_ytdlp_bin() {
            return Ok(existing);
        }

        #[cfg(target_os = "windows")]
        let (bin_dir, dest, download_url) = {
            let appdata = std::env::var("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|_| std::env::temp_dir());
            let dir = appdata.join("snutify").join("bin");
            (dir.clone(), dir.join("yt-dlp.exe"), "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe")
        };

        #[cfg(target_os = "macos")]
        let (bin_dir, dest, download_url) = {
            let home = std::env::var("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| std::env::temp_dir());
            let dir = home.join(".spytify").join("bin");
            (dir.clone(), dir.join("yt-dlp"), "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos")
        };

        #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
        let (bin_dir, dest, download_url) = {
            let home = std::env::var("HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|_| std::env::temp_dir());
            let dir = home.join(".spytify").join("bin");
            (dir.clone(), dir.join("yt-dlp"), "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp")
        };

        let _ = fs::create_dir_all(&bin_dir);

        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(45))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        let res = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("Không thể kết nối tải bộ giải mã YouTube: {}", e))?;
        if !res.status().is_success() {
            return Err(format!("Lỗi tải công cụ YouTube: HTTP {}", res.status()));
        }

        let mut file = File::create(&dest).map_err(|e| format!("Không tạo được file yt-dlp: {}", e))?;
        let bytes = res.bytes().await.map_err(|e| format!("Lỗi tải dữ liệu: {}", e))?;
        file.write_all(&bytes).map_err(|e| format!("Lỗi lưu file: {}", e))?;
        file.flush().map_err(|e| format!("Lỗi hoàn tất: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = fs::metadata(&dest) {
                let mut perms = meta.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&dest, perms);
            }
        }

        Ok(dest)
    }

    fn find_downloaded_file(target_dir: &Path, base_filename: &str) -> Option<PathBuf> {
        let candidates = [
            target_dir.join(format!("{}.m4a", base_filename)),
            target_dir.join(format!("{}.mp3", base_filename)),
            target_dir.join(format!("{}.webm", base_filename)),
            target_dir.join(format!("{}.opus", base_filename)),
            target_dir.join(format!("{}.aac", base_filename)),
            target_dir.join(format!("{}.flac", base_filename)),
        ];

        if let Some(dest) = candidates.into_iter().find(|p| p.exists()) {
            return Some(dest);
        }

        // Fallback: check any recently created audio file in target_dir within 60 seconds
        if let Ok(entries) = fs::read_dir(target_dir) {
            let now = std::time::SystemTime::now();
            let mut recent_files: Vec<(PathBuf, std::time::Duration)> = Vec::new();
            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                if ["m4a", "mp3", "webm", "opus", "aac", "flac"].contains(&ext.as_str()) {
                    if let Ok(meta) = entry.metadata() {
                        if let Ok(modified) = meta.modified() {
                            if let Ok(elapsed) = now.duration_since(modified) {
                                if elapsed.as_secs() < 60 {
                                    recent_files.push((path, elapsed));
                                }
                            }
                        }
                    }
                }
            }
            recent_files.sort_by_key(|(_, elapsed)| *elapsed);
            if let Some((most_recent, _)) = recent_files.first() {
                return Some(most_recent.clone());
            }
        }
        None
    }

    pub async fn download(track: &Track, custom_target_dir: Option<String>) -> Result<Track, String> {
        let target_dir = match custom_target_dir {
            Some(dir) if !dir.trim().is_empty() => {
                let p = PathBuf::from(dir);
                let _ = fs::create_dir_all(&p);
                p
            }
            _ => Self::get_default_download_dir(),
        };

        let safe_title = Self::sanitize_filename(&track.title);
        let safe_artist = Self::sanitize_filename(&track.artist);
        let base_filename = format!("{} - {}", safe_artist, safe_title);

        match track.source {
            TrackSource::Audius => {
                // Audius provides direct 320kbps MP3 stream URL
                let dest_file = target_dir.join(format!("{}.mp3", base_filename));
                Self::download_http_stream(&track.path_or_url, &dest_file).await?;
                Self::make_local_track(&dest_file, track)
            }
            TrackSource::YouTube => {
                let video_id = if track.path_or_url.contains("v=") {
                    track.path_or_url.split("v=").nth(1).unwrap_or(&track.path_or_url).split('&').next().unwrap_or(&track.path_or_url)
                } else if track.path_or_url.starts_with("yt_") {
                    &track.path_or_url[3..]
                } else {
                    &track.path_or_url
                };

                // Fast Path 1: Resolve direct audio/mp4 stream via YouTube Music + VISIONOS API (no yt-dlp needed!)
                if let Ok(resolved) = crate::sources::youtube::resolve_youtube_music_stream(
                    video_id,
                    &track.title,
                    &track.artist,
                )
                .await
                {
                    if let Some(stream_url) = resolved.stream_url {
                        let dest_m4a = target_dir.join(format!("{}.m4a", base_filename));
                        if Self::download_http_stream(&stream_url, &dest_m4a).await.is_ok()
                            && dest_m4a.exists()
                        {
                            return Self::make_local_track(&dest_m4a, track);
                        }
                    }
                }

                // Fallback Path 2: yt-dlp binary with strict non-blocking async execution & timeout
                let ytdlp = Self::ensure_ytdlp_available().await?;

                let yt_url = format!("https://www.youtube.com/watch?v={}", video_id);
                let out_template = target_dir.join(format!("{}.%(ext)s", base_filename));
                let out_template_str = out_template.to_string_lossy().to_string();

                let mut args = vec![
                    "-f".to_string(), "ba[ext=m4a]/ba[ext=mp3]/ba".to_string(),
                    "--no-playlist".to_string(),
                    "--max-filesize".to_string(), "60M".to_string(),
                    "--socket-timeout".to_string(), "10".to_string(),
                    "--retries".to_string(), "3".to_string(),
                    "--no-warnings".to_string(),
                    "--no-cache-dir".to_string(),
                    "-o".to_string(), out_template_str.clone(),
                ];

                if let Some(node_path) = Self::find_node_bin() {
                    args.push("--js-runtimes".to_string());
                    args.push(format!("node:{}", node_path.to_string_lossy()));
                }

                args.push(yt_url);

                let mut cmd = AsyncCommand::new(&ytdlp);
                cmd.args(&args);
                cmd.stdin(std::process::Stdio::null());

                #[cfg(target_os = "windows")]
                {
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }

                let output_res = tokio::time::timeout(std::time::Duration::from_secs(45), cmd.output()).await;
                let output = match output_res {
                    Ok(Ok(out)) => out,
                    Ok(Err(e)) => return Err(format!("Lỗi chạy tiến trình tải: {}", e)),
                    Err(_) => return Err("Quá thời gian tải nhạc (Timeout 45s). Vui lòng thử lại.".to_string()),
                };

                // Locate the downloaded file
                if let Some(dest_file) = Self::find_downloaded_file(&target_dir, &base_filename) {
                    return Self::make_local_track(&dest_file, track);
                }

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    let error_line = stderr
                        .lines()
                        .find(|l| l.contains("ERROR:"))
                        .unwrap_or_else(|| stderr.lines().find(|l| !l.trim().is_empty()).unwrap_or("Lỗi tải không xác định"));
                    return Err(format!("Lỗi tải YouTube: {}", error_line));
                }

                Err("Không tìm thấy file sau khi tải về hoàn tất.".to_string())
            }
            TrackSource::SoundCloud => {
                if let Some(ytdlp) = Self::find_ytdlp_bin() {
                    let out_template = target_dir.join(format!("{}.%(ext)s", base_filename));
                    let out_template_str = out_template.to_string_lossy().to_string();

                    let mut cmd = AsyncCommand::new(&ytdlp);
                    cmd.args(&[
                        "-f", "ba[ext=m4a]/ba[ext=mp3]/ba",
                        "--no-playlist",
                        "--socket-timeout", "10",
                        "--retries", "3",
                        "--no-warnings",
                        "--no-cache-dir",
                        "-o", &out_template_str,
                        &track.path_or_url,
                    ]);
                    cmd.stdin(std::process::Stdio::null());

                    #[cfg(target_os = "windows")]
                    {
                        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                    }

                    let output_res = tokio::time::timeout(std::time::Duration::from_secs(45), cmd.output()).await;
                    if let Ok(Ok(out)) = output_res {
                        if let Some(dest_file) = Self::find_downloaded_file(&target_dir, &base_filename) {
                            return Self::make_local_track(&dest_file, track);
                        }
                        if !out.status.success() {
                            let stderr = String::from_utf8_lossy(&out.stderr);
                            let err_line = stderr.lines().find(|l| l.contains("ERROR:")).unwrap_or("Lỗi tải SoundCloud");
                            return Err(err_line.to_string());
                        }
                    }
                }

                // If direct http stream fallback
                if track.path_or_url.starts_with("http") {
                    let dest_file = target_dir.join(format!("{}.mp3", base_filename));
                    Self::download_http_stream(&track.path_or_url, &dest_file).await?;
                    Self::make_local_track(&dest_file, track)
                } else {
                    Err("Không thể xác định luồng âm thanh SoundCloud để tải.".to_string())
                }
            }
            TrackSource::Local => {
                // Already a local track on disk
                Ok(track.clone())
            }
        }
    }

    async fn download_http_stream(url: &str, dest_path: &Path) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(35))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        let res = client
            .get(url)
            .header("Origin", "https://www.youtube.com")
            .header("Referer", "https://www.youtube.com/")
            .send()
            .await
            .map_err(|e| format!("Lỗi kết nối tải: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Lỗi server HTTP: {}", res.status()));
        }

        let bytes = res.bytes().await.map_err(|e| format!("Lỗi tải dữ liệu: {}", e))?;
        let mut file = File::create(dest_path).map_err(|e| format!("Không tạo được file: {}", e))?;
        file.write_all(&bytes).map_err(|e| format!("Lỗi ghi đĩa: {}", e))?;
        file.flush().map_err(|e| format!("Lỗi hoàn tất ghi file: {}", e))?;
        Ok(())
    }

    fn make_local_track(file_path: &Path, original_track: &Track) -> Result<Track, String> {
        if let Some(mut local_track) = scanner::extract_track_info(file_path) {
            if local_track.artist == "Unknown Artist" || local_track.artist == "Local File" {
                local_track.artist = original_track.artist.clone();
            }
            if local_track.title == "Unknown Track" || local_track.title.is_empty() {
                local_track.title = original_track.title.clone();
            }
            if local_track.cover_art.is_none() {
                local_track.cover_art = original_track.cover_art.clone();
            }
            Ok(local_track)
        } else {
            let path_str = file_path.to_string_lossy().to_string();
            Ok(Track {
                id: format!("local_{}", uuid::Uuid::new_v4().simple()),
                title: original_track.title.clone(),
                artist: original_track.artist.clone(),
                album: "Spytify Downloads".to_string(),
                duration_secs: original_track.duration_secs,
                path_or_url: path_str,
                cover_art: original_track.cover_art.clone(),
                source: TrackSource::Local,
                file_size_bytes: fs::metadata(file_path).map(|m| m.len()).ok(),
            })
        }
    }
}

fn dirs_fallback_music() -> Option<PathBuf> {
    std::env::var("USERPROFILE")
        .ok()
        .map(|p| PathBuf::from(p).join("Music"))
}
