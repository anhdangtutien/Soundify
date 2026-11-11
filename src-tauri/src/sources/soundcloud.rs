use crate::models::{SearchResult, TrackSource};
use serde::Deserialize;
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

const FALLBACK_CLIENT_IDS: &[&str] = &[
    "LvWUX1xVoJew8GCcu1uo6fljeb7Nu1rJ",
    "2t9loNfh0ekOfHG3RDuNuXJJdg1Oaika",
    "a3e059563d7fd3372b49b37f00a00bcf",
    "b46b25aa3721345d1ba73d6e4271809e",
    "iZIs9mchVcX5lhVR1EzGCddqq8gw2cgU",
    "fDoItMDbsbZz8dY16ZzARCZmzgHBPotA",
    "J15z0gW97w8bF4Q75hN4xXy9Yl0oU4hT",
    "N2eGoF4b0Xn1j2sU7K1W6Q7b4G7v3A2c",
];

static ACTIVE_CLIENT_INDEX: AtomicUsize = AtomicUsize::new(0);
static CACHED_DYNAMIC_CLIENT_ID: Mutex<Option<String>> = Mutex::new(None);

pub async fn search_soundcloud(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    // Strategy 1: SoundCloud API v2 with full browser headers & dynamic client_id
    if let Ok(results) = search_via_api_v2(&client, query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // Strategy 2: Scrape window.__sc_hydration
    if let Ok(results) = search_via_hydration(&client, query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // Strategy 3: DuckDuckGo site:soundcloud.com Search (Unblockable & Bulletproof)
    if let Ok(results) = search_via_duckduckgo(&client, query).await {
        if !results.is_empty() {
            return Ok(results);
        }
    }

    // Strategy 4: Raw HTML anchor parsing
    search_via_html_scraping(&client, query).await
}

async fn get_or_fetch_client_id(client: &reqwest::Client) -> Option<String> {
    if let Ok(guard) = CACHED_DYNAMIC_CLIENT_ID.lock() {
        if let Some(id) = guard.as_ref() {
            return Some(id.clone());
        }
    }

    // Try extracting dynamic client_id from soundcloud.com homepage assets
    if let Ok(res) = client.get("https://soundcloud.com").send().await {
        if let Ok(html) = res.text().await {
            // Find asset js files
            let mut script_urls = Vec::new();
            for part in html.split("<script crossorigin src=\"") {
                if let Some(end) = part.find(".js\"") {
                    let url = &part[..end + 3];
                    if url.starts_with("https://") && url.contains("sndcdn.com") {
                        script_urls.push(url.to_string());
                    }
                }
            }

            // Inspect the last 2 scripts
            for script_url in script_urls.into_iter().rev().take(3) {
                if let Ok(s_res) = client.get(&script_url).send().await {
                    if let Ok(js_code) = s_res.text().await {
                        if let Some(idx) = js_code.find("client_id:\"") {
                            let sub = &js_code[idx + 11..];
                            if let Some(end_quote) = sub.find('"') {
                                let found_id = sub[..end_quote].to_string();
                                if found_id.len() >= 30 {
                                    if let Ok(mut guard) = CACHED_DYNAMIC_CLIENT_ID.lock() {
                                        *guard = Some(found_id.clone());
                                    }
                                    return Some(found_id);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

async fn search_via_api_v2(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let encoded = urlencoding_simple(query);

    // Try dynamic client_id first if found
    if let Some(dyn_id) = get_or_fetch_client_id(client).await {
        if let Ok(results) = query_api_endpoint(client, &encoded, &dyn_id).await {
            if !results.is_empty() {
                return Ok(results);
            }
        }
    }

    // Fallback through known static client IDs
    let start_idx = ACTIVE_CLIENT_INDEX.load(Ordering::Relaxed) % FALLBACK_CLIENT_IDS.len();
    for i in 0..FALLBACK_CLIENT_IDS.len() {
        let idx = (start_idx + i) % FALLBACK_CLIENT_IDS.len();
        let client_id = FALLBACK_CLIENT_IDS[idx];

        if let Ok(results) = query_api_endpoint(client, &encoded, client_id).await {
            if !results.is_empty() {
                ACTIVE_CLIENT_INDEX.store(idx, Ordering::Relaxed);
                return Ok(results);
            }
        }
    }

    Err("All SoundCloud API v2 attempts failed".to_string())
}

async fn query_api_endpoint(client: &reqwest::Client, encoded_query: &str, client_id: &str) -> Result<Vec<SearchResult>, String> {
    let url = format!(
        "https://api-v2.soundcloud.com/search/tracks?q={}&client_id={}&limit=25&offset=0&linked_partitioning=1&app_version=1719000000&app_locale=en",
        encoded_query, client_id
    );

    let res = client
        .get(&url)
        .header("Accept", "application/json, text/javascript, */*; q=0.01")
        .header("Accept-Language", "en-US,en;q=0.9,vi;q=0.8")
        .header("Origin", "https://soundcloud.com")
        .header("Referer", "https://soundcloud.com/")
        .header("Sec-Fetch-Dest", "empty")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Site", "same-site")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        if let Ok(val) = res.json::<Value>().await {
            if let Some(collection) = val.get("collection").and_then(|v| v.as_array()) {
                let results: Vec<SearchResult> = collection
                    .iter()
                    .filter_map(parse_sc_track)
                    .collect();

                if !results.is_empty() {
                    return Ok(results);
                }
            }
        }
    }

    Err("Failed to fetch or parse API response".to_string())
}

// ─── DUCKDUCKGO BULLETPROOF SOUNDCLOUD SEARCH ───────────────────────────────
async fn search_via_duckduckgo(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let ddg_query = format!("site:soundcloud.com {}", query);
    let url = format!("https://html.duckduckgo.com/html/?q={}", urlencoding_simple(&ddg_query));

    let res = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.5")
        .header("Referer", "https://html.duckduckgo.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let html = res.text().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    // DuckDuckGo results are in <a class="result__url" href="..."> or <a class="result__snippet" ...>
    for part in html.split("class=\"result__body") {
        if let Some(href_pos) = part.find("class=\"result__url\" href=\"") {
            let after_href = &part[href_pos + 26..];
            if let Some(end_href) = after_href.find('"') {
                let raw_url = after_href[..end_href].trim();
                // DuckDuckGo redirects: //duckduckgo.com/l/?uddg=https%3A%2F%2Fsoundcloud.com%2F...
                let target_url = if raw_url.contains("uddg=") {
                    let encoded = raw_url.split("uddg=").nth(1).unwrap_or("").split('&').next().unwrap_or("");
                    urldecode_simple(encoded)
                } else if raw_url.starts_with("http") {
                    raw_url.to_string()
                } else {
                    format!("https://{}", raw_url.trim_start_matches("//"))
                };

                if target_url.contains("soundcloud.com/") && !target_url.contains("/search") && !target_url.contains("/tags") {
                    // Extract title from snippet or title link
                    let title = if let Some(title_pos) = part.find("class=\"result__title\">") {
                        let after_t = &part[title_pos + 22..];
                        clean_html_text(after_t.split("</a>").next().unwrap_or("SoundCloud Track"))
                    } else {
                        "SoundCloud Track".to_string()
                    };

                    let artist = target_url
                        .split("soundcloud.com/")
                        .nth(1)
                        .and_then(|p| p.split('/').next())
                        .unwrap_or("SoundCloud Artist")
                        .replace('-', " ");

                    results.push(SearchResult {
                        title,
                        artist,
                        album: "SoundCloud".to_string(),
                        duration_secs: 180,
                        source: TrackSource::SoundCloud,
                        url_or_id: target_url,
                        thumbnail: None,
                    });
                }
            }
        }
        if results.len() >= 20 {
            break;
        }
    }

    if !results.is_empty() {
        Ok(results)
    } else {
        Err("DuckDuckGo returned no SoundCloud results".to_string())
    }
}

async fn search_via_hydration(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let encoded = urlencoding_simple(query);
    let url = format!("https://soundcloud.com/search/sounds?q={}", encoded);

    let res = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let html = res.text().await.map_err(|e| e.to_string())?;

    let marker = "window.__sc_hydration = ";
    if let Some(start) = html.find(marker) {
        let after_marker = &html[start + marker.len()..];
        if after_marker.starts_with('[') {
            let json_slice = if let Some(end_script) = after_marker.find("</script>") {
                let s = after_marker[..end_script].trim();
                s.strip_suffix(';').unwrap_or(s)
            } else if let Some(semi) = after_marker.find(";\n") {
                &after_marker[..semi]
            } else {
                after_marker
            };

            let mut de = serde_json::Deserializer::from_str(json_slice);
            if let Ok(val) = Value::deserialize(&mut de) {
                if let Some(arr) = val.as_array() {
                    for item in arr {
                        if item.get("hydratable").and_then(|v| v.as_str()) == Some("collection") {
                            if let Some(collection) = item.get("data").and_then(|v| v.as_array()) {
                                let results: Vec<SearchResult> = collection
                                    .iter()
                                    .filter_map(|it| parse_sc_track(it.get("track").unwrap_or(it)))
                                    .collect();
                                if !results.is_empty() {
                                    return Ok(results);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Err("Failed to parse SoundCloud hydration JSON".to_string())
}

async fn search_via_html_scraping(client: &reqwest::Client, query: &str) -> Result<Vec<SearchResult>, String> {
    let encoded = urlencoding_simple(query);
    let url = format!("https://soundcloud.com/search/sounds?q={}", encoded);

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let html = res.text().await.map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for part in html.split("<article") {
        if let Some(href_idx) = part.find("href=\"/") {
            let sub = &part[href_idx + 6..];
            if let Some(end_href) = sub.find('"') {
                let path = &sub[..end_href];
                if path.contains('/') && !path.starts_with("search") && !path.starts_with("terms") {
                    let full_url = format!("https://soundcloud.com/{}", path);
                    let title = path.split('/').nth(1).unwrap_or("SoundCloud Track").replace('-', " ");
                    let artist = path.split('/').next().unwrap_or("Artist").replace('-', " ");

                    results.push(SearchResult {
                        title,
                        artist,
                        album: "SoundCloud".to_string(),
                        duration_secs: 180,
                        source: TrackSource::SoundCloud,
                        url_or_id: full_url,
                        thumbnail: None,
                    });
                }
            }
        }
        if results.len() >= 20 {
            break;
        }
    }

    if !results.is_empty() {
        Ok(results)
    } else {
        Err("No SoundCloud tracks found".to_string())
    }
}

fn parse_sc_track(track: &Value) -> Option<SearchResult> {
    let title = track.get("title").and_then(|v| v.as_str())?;
    let permalink_url = track.get("permalink_url").and_then(|v| v.as_str())?;
    let duration_ms = track.get("duration").and_then(|v| v.as_u64()).unwrap_or(180_000);

    let artist = track
        .pointer("/user/username")
        .and_then(|v| v.as_str())
        .unwrap_or("SoundCloud Artist")
        .to_string();

    let artwork = track
        .get("artwork_url")
        .and_then(|v| v.as_str())
        .map(|url| url.replace("-large", "-t300x300").replace("-t67x67", "-t300x300"))
        .or_else(|| {
            track
                .pointer("/user/avatar_url")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });

    Some(SearchResult {
        title: title.to_string(),
        artist,
        album: "SoundCloud".to_string(),
        duration_secs: duration_ms / 1000,
        source: TrackSource::SoundCloud,
        url_or_id: permalink_url.to_string(),
        thumbnail: artwork,
    })
}

fn clean_html_text(raw: &str) -> String {
    let mut clean = String::new();
    let mut in_tag = false;
    for c in raw.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            clean.push(c);
        }
    }
    clean
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_string()
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

fn urldecode_simple(s: &str) -> String {
    let mut res = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                res.push(byte as char);
            }
        } else if c == '+' {
            res.push(' ');
        } else {
            res.push(c);
        }
    }
    res
}
