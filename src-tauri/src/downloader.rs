use crate::models::{Track, TrackSource};
use crate::scanner;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

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
        // 1. Check D:\NodeJS\node.exe
        let d_node = PathBuf::from("D:\\NodeJS\\node.exe");
        if d_node.exists() {
            return Some(d_node);
        }
        // 2. Check Program Files
        let pf_node = PathBuf::from("C:\\Program Files\\nodejs\\node.exe");
        if pf_node.exists() {
            return Some(pf_node);
        }
        // 3. Check system PATH
        if let Ok(output) = Command::new("where").arg("node").output() {
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
        // 1. Check APPDATA/snutify/bin/yt-dlp.exe
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = PathBuf::from(appdata).join("snutify").join("bin").join("yt-dlp.exe");
            if p.exists() {
                return Some(p);
            }
        }
        // 2. Check current working directory / bin
        let local_bin = PathBuf::from("bin").join("yt-dlp.exe");
        if local_bin.exists() {
            return Some(local_bin);
        }
        // 3. Check system PATH
        if let Ok(output) = Command::new("where").arg("yt-dlp").output() {
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

        // Auto-download standalone yt-dlp.exe from GitHub into APPDATA/snutify/bin/yt-dlp.exe
        let appdata = std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir());
        let bin_dir = appdata.join("snutify").join("bin");
        let _ = fs::create_dir_all(&bin_dir);
        let dest = bin_dir.join("yt-dlp.exe");

        let download_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 Spytify Downloader")
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

        Ok(dest)
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
                let ytdlp = Self::ensure_ytdlp_available().await?;

                let video_id = if track.path_or_url.contains("v=") {
                    track.path_or_url.split("v=").nth(1).unwrap_or(&track.path_or_url).split('&').next().unwrap_or(&track.path_or_url)
                } else if track.path_or_url.starts_with("yt_") {
                    &track.path_or_url[3..]
                } else {
                    &track.path_or_url
                };

                let yt_url = format!("https://www.youtube.com/watch?v={}", video_id);
                let out_template = target_dir.join(format!("{}.%(ext)s", base_filename));
                let out_template_str = out_template.to_string_lossy().to_string();

                let mut args = vec![
                    "-f".to_string(), "ba[ext=m4a]/ba[ext=mp3]/ba".to_string(),
                    "--no-playlist".to_string(),
                    "--max-filesize".to_string(), "60M".to_string(),
                    "-o".to_string(), out_template_str.clone(),
                ];

                if let Some(node_path) = Self::find_node_bin() {
                    args.push("--js-runtimes".to_string());
                    args.push(format!("node:{}", node_path.to_string_lossy()));
                }

                args.push(yt_url);

                let mut cmd = Command::new(&ytdlp);
                cmd.args(&args);

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }

                let output = cmd.output().map_err(|e| format!("Lỗi khởi chạy tải: {}", e))?;

                // Locate the downloaded file (could be .m4a, .webm, or .mp3)
                let candidates = [
                    target_dir.join(format!("{}.m4a", base_filename)),
                    target_dir.join(format!("{}.mp3", base_filename)),
                    target_dir.join(format!("{}.webm", base_filename)),
                    target_dir.join(format!("{}.opus", base_filename)),
                ];

                if let Some(dest_file) = candidates.into_iter().find(|p| p.exists()) {
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

                    let mut cmd = Command::new(&ytdlp);
                    cmd.args(&[
                        "-f", "ba[ext=m4a]/ba[ext=mp3]/ba",
                        "--no-playlist",
                        "-o", &out_template_str,
                        &track.path_or_url,
                    ]);

                    #[cfg(target_os = "windows")]
                    {
                        use std::os::windows::process::CommandExt;
                        cmd.creation_flags(0x08000000);
                    }

                    let output = cmd.output().map_err(|e| format!("Lỗi tải SoundCloud: {}", e))?;
                    let candidates = [
                        target_dir.join(format!("{}.m4a", base_filename)),
                        target_dir.join(format!("{}.mp3", base_filename)),
                        target_dir.join(format!("{}.webm", base_filename)),
                        target_dir.join(format!("{}.opus", base_filename)),
                    ];
                    if let Some(dest_file) = candidates.into_iter().find(|p| p.exists()) {
                        return Self::make_local_track(&dest_file, track);
                    }
                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr);
                        let err_line = stderr.lines().find(|l| l.contains("ERROR:")).unwrap_or("Lỗi tải SoundCloud");
                        return Err(err_line.to_string());
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
            .user_agent("Mozilla/5.0 Spytify Audio Downloader")
            .build()
            .map_err(|e| e.to_string())?;

        let mut res = client.get(url).send().await.map_err(|e| format!("Lỗi kết nối tải: {}", e))?;
        if !res.status().is_success() {
            return Err(format!("Lỗi server HTTP: {}", res.status()));
        }

        let mut file = File::create(dest_path).map_err(|e| format!("Không tạo được file: {}", e))?;
        while let Some(chunk) = res.chunk().await.map_err(|e| format!("Lỗi tải dữ liệu: {}", e))? {
            file.write_all(&chunk).map_err(|e| format!("Lỗi ghi đĩa: {}", e))?;
        }
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
