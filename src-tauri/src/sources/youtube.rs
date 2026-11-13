use crate::models::{SearchResult, TrackSource};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YoutubeAudioStream {
    pub stream_url: Option<String>,
    pub resolved_video_id: String,
    pub duration_secs: u64,
}

pub async fn search_youtube(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let q_lower = query.to_lowercase();
    let is_live_query = q_lower.contains("live") || q_lower.contains("24/7") || q_lower.contains("radio");

    // Run YouTube Music API (WEB_REMIX) + YouTube Innertube Web API concurrently
    let (ytm_res, yt_res) = tokio::join!(
        search_youtube_music(&client, query),
        search_innertube(&client, query)
    );

    let mut combined = Vec::new();
    let mut seen_ids = HashSet::new();

    if is_live_query {
        // For live/radio queries, prioritize standard YouTube (which includes 24/7 live streams)
        if let Ok(yt_list) = yt_res {
            for item in yt_list {
                if seen_ids.insert(item.url_or_id.clone()) {
                    combined.push(item);
                }
            }
        }
        if let Ok(ytm_list) = ytm_res {
            for item in ytm_list {
                if seen_ids.insert(item.url_or_id.clone()) {
                    combined.push(item);
                }
            }
        }
    } else {
        // Interleave YouTube Music Official Audio tracks with YouTube Video results
        let ytm_vec = ytm_res.unwrap_or_default();
        let yt_vec = yt_res.unwrap_or_default();
        let max_len = ytm_vec.len().max(yt_vec.len());

        for i in 0..max_len {
            if let Some(ytm_item) = ytm_vec.get(i) {
                if seen_ids.insert(ytm_item.url_or_id.clone()) {
                    combined.push(ytm_item.clone());
                }
            }
            if let Some(yt_item) = yt_vec.get(i) {
                if seen_ids.insert(yt_item.url_or_id.clone()) {
                    combined.push(yt_item.clone());
                }
            }
        }
    }

    if !combined.is_empty() {
        return Ok(combined);
    }

    // Strategy 2: YouTube HTML Scraping with video-only filter
    if let Ok(results) = search_html(&client, query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // Strategy 3: Invidious Public API fallback
    if let Ok(results) = search_invidious(&client, query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    Ok(Vec::new())
}

/// Official YouTube Music Innertube Search (`WEB_REMIX` client)
pub async fn search_youtube_music(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let (_, results) = search_youtube_music_with_visitor(client, query).await?;
    Ok(results)
}

async fn search_youtube_music_with_visitor(
    client: &reqwest::Client,
    query: &str,
) -> Result<(Option<String>, Vec<SearchResult>), String> {
    let payload = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20240717.01.00",
                "hl": "vi",
                "gl": "VN"
            }
        },
        "query": query,
        // Filter specifically for official YouTube Music Songs
        "params": "EgWKAQIIAWoKEAkQBRAKEAMQBA=="
    });

    let res = client
        .post("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header("Content-Type", "application/json")
        .header("Origin", "https://music.youtube.com")
        .header("Referer", "https://music.youtube.com/")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let val = res.json::<Value>().await.map_err(|e| e.to_string())?;
    let visitor_data = val
        .pointer("/responseContext/visitorData")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut results = Vec::new();

    if let Some(sections) = val
        .pointer("/contents/tabbedSearchResultsRenderer/tabs/0/tabRenderer/content/sectionListRenderer/contents")
        .and_then(|v| v.as_array())
    {
        for section in sections {
            if let Some(items) = section
                .pointer("/musicShelfRenderer/contents")
                .and_then(|v| v.as_array())
            {
                for item in items {
                    if let Some(m) = item.get("musicResponsiveListItemRenderer") {
                        if let Some(parsed) = parse_ytm_item(m) {
                            results.push(parsed);
                        }
                    }
                }
            }
        }
    }

    Ok((visitor_data, results))
}

fn parse_ytm_item(m: &Value) -> Option<SearchResult> {
    let video_id = m
        .pointer("/playlistItemData/videoId")
        .or_else(|| m.pointer("/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/videoId"))
        .and_then(|v| v.as_str())?;

    if video_id.is_empty() {
        return None;
    }

    let title = m
        .pointer("/flexColumns/0/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("YouTube Music Track");

    let mut artist = String::from("YouTube Music Artist");
    let mut album = String::from("YouTube Music Hi-Fi");
    let mut duration_secs = 210u64;

    if let Some(runs) = m
        .pointer("/flexColumns/1/musicResponsiveListItemFlexColumnRenderer/text/runs")
        .and_then(|v| v.as_array())
    {
        let parts: Vec<&str> = runs
            .iter()
            .filter_map(|r| r.get("text").and_then(|t| t.as_str()))
            .filter(|&s| s.trim() != "•" && !s.trim().is_empty())
            .collect();

        if let Some(&first) = parts.first() {
            artist = first.to_string();
        }
        for &part in parts.iter().skip(1) {
            if part.contains(':') && part.chars().all(|c| c.is_ascii_digit() || c == ':') {
                duration_secs = parse_duration_string(part);
            } else if album == "YouTube Music Hi-Fi" {
                album = format!("{} • YT Music", part);
            }
        }
    }

    let thumbnail = m
        .pointer("/thumbnail/musicThumbnailRenderer/thumbnail/thumbnails")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(|v| v.as_str())
        .map(|u| {
            u.replace("=w120-h120", "=w300-h300")
                .replace("=w60-h60", "=w300-h300")
        })
        .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id));

    Some(SearchResult {
        title: title.to_string(),
        artist,
        album,
        duration_secs,
        source: TrackSource::YouTube,
        url_or_id: video_id.to_string(),
        thumbnail: Some(thumbnail),
    })
}

/// Resolves a direct playable audio stream URL (`audio/mp4` / `audio/webm`) using YouTube Music (`WEB_REMIX`) + Innertube (`VISIONOS`)
pub async fn resolve_youtube_music_stream(
    video_id: &str,
    title: &str,
    artist: &str,
) -> Result<YoutubeAudioStream, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let clean_vid = extract_clean_video_id(video_id);
    let search_query = format!("{} {}", title, artist).trim().to_string();

    // 1. Query YouTube Music WEB_REMIX to obtain visitorData and official Song videoId candidates
    let (visitor_opt, ytm_tracks) = if !search_query.is_empty() {
        search_youtube_music_with_visitor(&client, &search_query)
            .await
            .unwrap_or((None, Vec::new()))
    } else {
        (None, Vec::new())
    };

    let visitor_data = visitor_opt.unwrap_or_default();

    // Build candidate video IDs: try the requested video_id first, then official YouTube Music song IDs
    let mut candidate_ids: Vec<String> = Vec::new();
    if !clean_vid.is_empty() {
        candidate_ids.push(clean_vid.clone());
    }
    for t in ytm_tracks.iter().take(4) {
        if !candidate_ids.contains(&t.url_or_id) {
            candidate_ids.push(t.url_or_id.clone());
        }
    }

    // 2. Try extracting direct audio stream via VISIONOS Innertube player endpoint
    for cid in &candidate_ids {
        if let Ok(Some((stream_url, dur))) = fetch_visionos_audio_stream(&client, cid, &visitor_data).await {
            return Ok(YoutubeAudioStream {
                stream_url: Some(stream_url),
                resolved_video_id: cid.clone(),
                duration_secs: dur,
            });
        }
    }

    // 3. Even if direct stream extraction failed, if YouTube Music found a different official Song ID, return it
    if let Some(first_ytm) = ytm_tracks.first() {
        return Ok(YoutubeAudioStream {
            stream_url: None,
            resolved_video_id: first_ytm.url_or_id.clone(),
            duration_secs: first_ytm.duration_secs,
        });
    }

    Err("Không thể trích xuất luồng âm thanh YouTube Music cho bài hát này.".to_string())
}

async fn fetch_visionos_audio_stream(
    client: &reqwest::Client,
    video_id: &str,
    visitor_data: &str,
) -> Result<Option<(String, u64)>, String> {
    let mut client_obj = serde_json::json!({
        "clientName": "VISIONOS",
        "clientVersion": "1.02",
        "deviceMake": "Apple",
        "deviceModel": "RealityDevice17,1",
        "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
        "osName": "visionOS",
        "osVersion": "26.5.23O471",
        "hl": "en",
        "timeZone": "UTC",
        "utcOffsetMinutes": 0
    });

    if !visitor_data.is_empty() {
        if let Some(map) = client_obj.as_object_mut() {
            map.insert("visitorData".to_string(), Value::String(visitor_data.to_string()));
        }
    }

    let payload = serde_json::json!({
        "context": {
            "client": client_obj
        },
        "videoId": video_id,
        "contentCheckOk": true,
        "racyCheckOk": true
    });

    let mut req = client
        .post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
        .header("Content-Type", "application/json")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
        )
        .header("X-Youtube-Client-Name", "101")
        .header("X-Youtube-Client-Version", "1.02")
        .header("Origin", "https://www.youtube.com");

    if !visitor_data.is_empty() {
        req = req.header("X-Goog-Visitor-Id", visitor_data);
    }

    let res = req.json(&payload).send().await.map_err(|e| e.to_string())?;
    let val = res.json::<Value>().await.map_err(|e| e.to_string())?;

    let status = val
        .pointer("/playabilityStatus/status")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if status != "OK" {
        return Ok(None);
    }

    let duration_secs = val
        .pointer("/videoDetails/lengthSeconds")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    if let Some(formats) = val
        .pointer("/streamingData/adaptiveFormats")
        .and_then(|v| v.as_array())
    {
        // Priority 1: itag 140 (audio/mp4 AAC ~128kbps - universal support in WebView2 HTML5 Audio & M4A downloader)
        for fmt in formats {
            let itag = fmt.get("itag").and_then(|v| v.as_i64()).unwrap_or(0);
            if itag == 140 {
                if let Some(url) = fmt.get("url").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        return Ok(Some((url.to_string(), duration_secs)));
                    }
                }
            }
        }

        // Priority 2: any audio/mp4 or audio/webm with direct URL
        for fmt in formats {
            let mime = fmt.get("mimeType").and_then(|v| v.as_str()).unwrap_or("");
            if mime.starts_with("audio/mp4") || mime.starts_with("audio/webm") || mime.starts_with("audio/") {
                if let Some(url) = fmt.get("url").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        return Ok(Some((url.to_string(), duration_secs)));
                    }
                }
            }
        }
    }

    // Fallback: check standard muxed formats if adaptiveFormats didn't have a direct URL
    if let Some(formats) = val.pointer("/streamingData/formats").and_then(|v| v.as_array()) {
        for fmt in formats {
            if let Some(url) = fmt.get("url").and_then(|v| v.as_str()) {
                if !url.is_empty() {
                    return Ok(Some((url.to_string(), duration_secs)));
                }
            }
        }
    }

    Ok(None)
}

fn extract_clean_video_id(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("v=") {
        trimmed
            .split("v=")
            .nth(1)
            .unwrap_or(trimmed)
            .split('&')
            .next()
            .unwrap_or(trimmed)
            .to_string()
    } else if let Some(stripped) = trimmed.strip_prefix("yt_") {
        stripped.to_string()
    } else {
        trimmed.to_string()
    }
}

async fn search_innertube(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let payload = serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240401.01.00",
                "hl": "vi",
                "gl": "VN"
            }
        },
        "query": query
    });

    let res = client
        .post("https://www.youtube.com/youtubei/v1/search")
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let val = res.json::<Value>().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    if let Some(contents) = val.pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
        .and_then(|v| v.as_array())
    {
        for section in contents {
            if let Some(items) = section.pointer("/itemSectionRenderer/contents").and_then(|v| v.as_array()) {
                for item in items {
                    if let Some(video) = item.get("videoRenderer") {
                        if let Some(parsed) = parse_video_renderer(video) {
                            results.push(parsed);
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

async fn search_html(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let encoded = urlencoding_simple(query);
    // sp=EgIQAQ%253D%253D filters by Video
    let url = format!("https://www.youtube.com/results?search_query={}&sp=EgIQAQ%253D%253D", encoded);

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let html = res.text().await.map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    if let Some(start) = html.find("var ytInitialData = ") {
        let json_part = &html[start + 20..];
        if let Some(end) = json_part.find(";</script>") {
            let json_str = &json_part[..end];
            if let Ok(val) = serde_json::from_str::<Value>(json_str) {
                if let Some(contents) = val.pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
                    .and_then(|v| v.as_array())
                {
                    for section in contents {
                        if let Some(items) = section.pointer("/itemSectionRenderer/contents").and_then(|v| v.as_array()) {
                            for item in items {
                                if let Some(video) = item.get("videoRenderer") {
                                    if let Some(parsed) = parse_video_renderer(video) {
                                        results.push(parsed);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}

async fn search_invidious(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let encoded = urlencoding_simple(query);
    let url = format!("https://inv.tux.pizza/api/v1/search?q={}&type=video", encoded);

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let items = res.json::<Vec<Value>>().await.map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for item in items.into_iter().take(15) {
        let video_id = item.get("videoId").and_then(|v| v.as_str()).unwrap_or("");
        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown Title");
        let artist = item.get("author").and_then(|v| v.as_str()).unwrap_or("YouTube Artist");
        let is_live_item = item.get("liveNow").and_then(|v| v.as_bool()).unwrap_or(false);
        let duration = if is_live_item {
            0
        } else {
            item.get("lengthSeconds").and_then(|v| v.as_u64()).unwrap_or(210)
        };

        if !video_id.is_empty() {
            results.push(SearchResult {
                title: title.to_string(),
                artist: artist.to_string(),
                album: "YouTube Music".to_string(),
                duration_secs: duration,
                source: TrackSource::YouTube,
                url_or_id: video_id.to_string(),
                thumbnail: Some(format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)),
            });
        }
    }

    Ok(results)
}

fn parse_video_renderer(video: &Value) -> Option<SearchResult> {
    let video_id = video.get("videoId").and_then(|v| v.as_str())?;
    
    let title = video.pointer("/title/runs/0/text")
        .or_else(|| video.pointer("/title/simpleText"))
        .and_then(|v| v.as_str())
        .unwrap_or("YouTube Track");

    let artist = video.pointer("/ownerText/runs/0/text")
        .or_else(|| video.pointer("/shortBylineText/runs/0/text"))
        .and_then(|v| v.as_str())
        .unwrap_or("YouTube Artist");

    let is_live_video = video.pointer("/badges").map(|b| b.to_string().to_lowercase().contains("live")).unwrap_or(false)
        || video.pointer("/thumbnailOverlays").map(|o| o.to_string().to_lowercase().contains("\"live\"")).unwrap_or(false)
        || (video.pointer("/lengthText").is_none() && video.pointer("/viewCountText/runs").is_some());
    let duration_secs = if is_live_video {
        0
    } else {
        video.pointer("/lengthText/simpleText")
            .and_then(|v| v.as_str())
            .map(parse_duration_string)
            .unwrap_or(210)
    };

    let thumbnail = video.pointer("/thumbnail/thumbnails")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id));

    Some(SearchResult {
        title: title.to_string(),
        artist: artist.to_string(),
        album: "YouTube Audio".to_string(),
        duration_secs,
        source: TrackSource::YouTube,
        url_or_id: video_id.to_string(),
        thumbnail: Some(thumbnail),
    })
}

fn parse_duration_string(s: &str) -> u64 {
    let parts: Vec<&str> = s.split(':').collect();
    match parts.len() {
        2 => {
            let mins = parts[0].parse::<u64>().unwrap_or(0);
            let secs = parts[1].parse::<u64>().unwrap_or(0);
            mins * 60 + secs
        }
        3 => {
            let hours = parts[0].parse::<u64>().unwrap_or(0);
            let mins = parts[1].parse::<u64>().unwrap_or(0);
            let secs = parts[2].parse::<u64>().unwrap_or(0);
            hours * 3600 + mins * 60 + secs
        }
        _ => 210,
    }
}

fn urlencoding_simple(s: &str) -> String {
    let mut encoded = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{:02X}", b)),
        }
    }
    encoded
}
