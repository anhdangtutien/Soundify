use crate::models::{SearchResult, TrackSource};
use serde_json::Value;

pub async fn search_audius(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Spytify/1.0")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let encoded = urlencoding_simple(query);
    // Audius Open Music Decentralized Discovery API (Free & 100% Open, 320kbps Streams)
    let url = format!(
        "https://discoveryprovider.audius.co/v1/tracks/search?query={}&app_name=Spytify",
        encoded
    );

    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Audius API returned status: {}", res.status()));
    }

    let val = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(parse_audius_items(&val))
}

pub async fn get_trending_audius(limit: usize) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Spytify/1.0")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://discoveryprovider.audius.co/v1/tracks/trending?app_name=Spytify&limit={}",
        limit
    );

    let res = client
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Audius Trending API status: {}", res.status()));
    }

    let val = res.json::<Value>().await.map_err(|e| e.to_string())?;
    Ok(parse_audius_items(&val))
}

fn parse_audius_items(val: &Value) -> Vec<SearchResult> {
    let mut results = Vec::new();
    if let Some(items) = val.get("data").and_then(|v| v.as_array()) {
        for item in items {
            let track_id = item.get("id").and_then(|v| v.as_str());
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Audius Track");
            let artist = item.pointer("/user/name").and_then(|v| v.as_str()).unwrap_or("Audius Artist");
            let duration_secs = item.get("duration").and_then(|v| v.as_u64()).unwrap_or(180);
            
            let artwork = item.pointer("/artwork/480x480")
                .and_then(|v| v.as_str())
                .or_else(|| item.pointer("/artwork/150x150").and_then(|v| v.as_str()))
                .map(|s| s.to_string());

            if let Some(tid) = track_id {
                let stream_url = format!("https://discoveryprovider.audius.co/v1/tracks/{}/stream?app_name=Spytify", tid);
                results.push(SearchResult {
                    title: title.to_string(),
                    artist: artist.to_string(),
                    album: "Audius Open Music".to_string(),
                    duration_secs,
                    source: TrackSource::Audius,
                    url_or_id: stream_url,
                    thumbnail: artwork,
                });
            }
        }
    }
    results
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
