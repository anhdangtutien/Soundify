use crate::db::DatabaseManager;
use crate::models::User;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

// Default Google OAuth Client ID for desktop applications (or user-provided)
const DEFAULT_CLIENT_ID: &str = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

#[derive(Deserialize, Debug)]
struct GoogleTokenResponse {
    access_token: Option<String>,
}

#[derive(Deserialize, Debug)]
struct GoogleUserInfo {
    sub: String, // Google unique ID
    email: String,
    name: Option<String>,
    picture: Option<String>,
}

pub async fn perform_google_oauth(
    custom_client_id: Option<String>,
    client_secret: Option<String>,
    db: &DatabaseManager,
) -> Result<User, String> {
    let client_id = custom_client_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_CLIENT_ID.to_string());

    if client_id == DEFAULT_CLIENT_ID {
        return Err(
            "Cần cấu hình Google Client ID từ Google Cloud Console để kích hoạt đăng nhập Google OAuth chính thức."
                .to_string(),
        );
    }

    // 1. Bind local listener on 127.0.0.1:8989
    let redirect_uri = "http://127.0.0.1:8989/oauth/callback";
    let listener = TcpListener::bind("127.0.0.1:8989")
        .await
        .map_err(|e| format!("Không thể mở cổng 8989 để nhận callback Google: {}", e))?;

    // 2. Build official Google OAuth 2.0 Auth URL
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=select_account",
        client_id, redirect_uri
    );

    // Open user's default browser to Google login page
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(&["/C", "start", &auth_url])
            .spawn();
    }

    // 3. Wait for browser callback with timeout (90 seconds)
    let timeout = Duration::from_secs(90);
    let code = tokio::time::timeout(timeout, async {
        if let Ok((mut stream, _)) = listener.accept().await {
            let mut buf = [0u8; 2048];
            if let Ok(n) = stream.read(&mut buf).await {
                let req_text = String::from_utf8_lossy(&buf[..n]);
                // Parse GET /oauth/callback?code=4/0A...
                if let Some(first_line) = req_text.lines().next() {
                    if let Some(query_start) = first_line.find("?code=") {
                        let query = &first_line[query_start + 6..];
                        let code_val = query.split('&').next().unwrap_or("").split(' ').next().unwrap_or("");

                        // Respond to browser with friendly message
                        let response_body = "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Soundify - Đăng nhập thành công</title><style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column}h1{color:#00e5ff;margin-bottom:8px}p{color:#888}</style></head><body><h1>✓ Đăng nhập Soundify thành công!</h1><p>Bạn có thể đóng tab này và quay lại ứng dụng.</p></body></html>";
                        let response = format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            response_body.len(),
                            response_body
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                        let _ = stream.flush().await;

                        return Ok(code_val.to_string());
                    }
                }
            }
        }
        Err("Không nhận được mã xác thực từ Google".to_string())
    })
    .await
    .map_err(|_| "Hết thời gian chờ đăng nhập từ trình duyệt Google (90s)".to_string())??;

    // 4. Exchange code for access token
    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("code", code.as_str());
    params.insert("client_id", client_id.as_str());
    params.insert("redirect_uri", redirect_uri);
    params.insert("grant_type", "authorization_code");
    if let Some(secret) = client_secret.as_deref() {
        params.insert("client_secret", secret);
    }

    let token_res = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Lỗi trao đổi token Google: {}", e))?;

    let token_data: GoogleTokenResponse = token_res
        .json()
        .await
        .map_err(|e| format!("Phản hồi token không hợp lệ từ Google: {}", e))?;

    let access_token = token_data
        .access_token
        .ok_or_else(|| "Google không trả về access_token hợp lệ".to_string())?;

    // 5. Fetch verified Google user info
    let user_info_res = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Lỗi lấy thông tin Google User: {}", e))?;

    let user_info: GoogleUserInfo = user_info_res
        .json()
        .await
        .map_err(|e| format!("Dữ liệu người dùng Google không hợp lệ: {}", e))?;

    // 6. Save or login user in SQLite
    let name = user_info.name.unwrap_or_else(|| user_info.email.split('@').next().unwrap_or("Google User").to_string());
    db.google_login(&user_info.sub, &user_info.email, &name, user_info.picture.as_deref())
}
