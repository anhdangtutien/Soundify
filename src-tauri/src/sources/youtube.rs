use crate::models::{SearchResult, TrackSource};
use serde_json::Value;

pub async fn search_youtube(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Strategy 1: YouTube Innertube API (official Web API used by YouTube Web Client)
    if let Ok(results) = search_innertube(&client, query).await {
        if !results.is_empty() {
            return Ok(results);
        }
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

