use crate::models::{HistoryItem, Track, User, UserStats};
use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use uuid::Uuid;

pub struct DatabaseManager {
    conn: Mutex<Connection>,
}

impl DatabaseManager {
    pub fn new() -> Result<Self, String> {
        // Safe location outside source folder to prevent tauri dev file-watcher reload loops
        let db_dir = std::env::var("LOCALAPPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| {
                std::env::var("APPDATA")
                    .map(std::path::PathBuf::from)
                    .unwrap_or_else(|_| std::env::temp_dir())
            })
            .join("Soundify");

        std::fs::create_dir_all(&db_dir).map_err(|e| e.to_string())?;
        let db_path = db_dir.join("soundify.db");

        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        // Initialize schema
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                display_name TEXT NOT NULL,
                avatar TEXT,
                google_id TEXT UNIQUE,
                email TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_favorites (
                user_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                track_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, track_id)
            );

            CREATE TABLE IF NOT EXISTS playback_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                track_title TEXT NOT NULL,
                artist TEXT NOT NULL,
                source TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                listened_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .map_err(|e| e.to_string())?;

        // Soft migrations if columns do not exist
        let _ = conn.execute("ALTER TABLE users ADD COLUMN google_id TEXT", []);
        let _ = conn.execute("ALTER TABLE users ADD COLUMN email TEXT", []);

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn hash_password(password: &str, salt: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(salt.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn register(
        &self,
        username: &str,
        email: Option<&str>,
        password: &str,
        display_name: &str,
    ) -> Result<User, String> {
        let username_clean = username.trim().to_lowercase();
        if username_clean.len() < 3 {
            return Err("Tên tài khoản phải từ 3 ký tự trở lên".to_string());
        }
        if password.len() < 6 {
            return Err("Mật khẩu phải từ 6 ký tự trở lên".to_string());
        }

        let email_clean = email.map(|e| e.trim().to_lowercase()).filter(|e| !e.is_empty());

        let salt = Uuid::new_v4().to_string();
        let password_hash = Self::hash_password(password, &salt);
        let user_id = Uuid::new_v4().to_string();
        let disp_name = if display_name.trim().is_empty() {
            username.trim()
        } else {
            display_name.trim()
        };

        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, salt, display_name) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![user_id, username_clean, email_clean, password_hash, salt, disp_name],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed: users.username") {
                "Tên tài khoản này đã được sử dụng".to_string()
            } else if e.to_string().contains("UNIQUE constraint failed: users.email") {
                "Email này đã được đăng ký tài khoản khác".to_string()
            } else {
                e.to_string()
            }
        })?;

        Ok(User {
            id: user_id,
            username: username_clean,
            display_name: disp_name.to_string(),
            avatar: None,
            created_at: "Vừa xong".to_string(),
        })
    }

    pub fn login(&self, identifier: &str, password: &str) -> Result<User, String> {
        let clean_id = identifier.trim().to_lowercase();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Support login by either username OR email!
        let mut stmt = conn
            .prepare("SELECT id, username, password_hash, salt, display_name, avatar, created_at FROM users WHERE username = ?1 OR email = ?1")
            .map_err(|e| e.to_string())?;

        let user_row = stmt
            .query_row(params![clean_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })
            .map_err(|_| "Tài khoản / Email hoặc mật khẩu không chính xác".to_string())?;

        let (id, uname, stored_hash, salt, display_name, avatar, created_at) = user_row;
        let input_hash = Self::hash_password(password, &salt);

        if input_hash != stored_hash {
            return Err("Tài khoản / Email hoặc mật khẩu không chính xác".to_string());
        }

        Ok(User {
            id,
            username: uname,
            display_name,
            avatar,
            created_at,
        })
    }

    pub fn google_login(
        &self,
        google_id: &str,
        email: &str,
        display_name: &str,
        avatar: Option<&str>,
    ) -> Result<User, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // 1. Check if user exists by google_id or email
        let mut stmt = conn
            .prepare("SELECT id, username, display_name, avatar, created_at FROM users WHERE google_id = ?1 OR email = ?2")
            .map_err(|e| e.to_string())?;

        let existing = stmt.query_row(params![google_id, email], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                avatar: row.get(3)?,
                created_at: row.get(4)?,
            })
        });

        match existing {
            Ok(user) => Ok(user),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 2. Create new user with Google account info
                let user_id = Uuid::new_v4().to_string();
                let username = email
                    .split('@')
                    .next()
                    .unwrap_or("google_user")
                    .to_lowercase();

                let salt = "GOOGLE_OAUTH";
                let hash = "GOOGLE_OAUTH";

                conn.execute(
                    "INSERT INTO users (id, username, password_hash, salt, display_name, avatar, google_id, email) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![user_id, username, hash, salt, display_name, avatar, google_id, email],
                )
                .map_err(|e| e.to_string())?;

                Ok(User {
                    id: user_id,
                    username,
                    display_name: display_name.to_string(),
                    avatar: avatar.map(|s| s.to_string()),
                    created_at: "Vừa xong".to_string(),
                })
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn get_user_by_id(&self, user_id: &str) -> Result<Option<User>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, username, display_name, avatar, created_at FROM users WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let res = stmt.query_row(params![user_id], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                avatar: row.get(3)?,
                created_at: row.get(4)?,
            })
        });

        match res {
            Ok(u) => Ok(Some(u)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn get_favorites(&self, user_id: &str) -> Result<Vec<Track>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT track_json FROM user_favorites WHERE user_id = ?1 ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![user_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for r in rows.flatten() {
            if let Ok(track) = serde_json::from_str::<Track>(&r) {
                tracks.push(track);
            }
        }
        Ok(tracks)
    }

    pub fn toggle_favorite(&self, user_id: &str, track: &Track) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM user_favorites WHERE user_id = ?1 AND track_id = ?2",
                params![user_id, track.id],
                |row| row.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false);

        if exists {
            conn.execute(
                "DELETE FROM user_favorites WHERE user_id = ?1 AND track_id = ?2",
                params![user_id, track.id],
            )
            .map_err(|e| e.to_string())?;
            Ok(false) // Unfavorited
        } else {
            let json = serde_json::to_string(track).map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO user_favorites (user_id, track_id, track_json) VALUES (?1, ?2, ?3)",
                params![user_id, track.id, json],
            )
            .map_err(|e| e.to_string())?;
            Ok(true) // Favorited
        }
    }

    pub fn add_history(&self, user_id: &str, track: &Track) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let source_str = format!("{:?}", track.source).to_lowercase();
        conn.execute(
            "INSERT INTO playback_history (user_id, track_id, track_title, artist, source, duration_secs) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![user_id, track.id, track.title, track.artist, source_str, track.duration_secs],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_history(&self, user_id: &str, limit: u32) -> Result<Vec<HistoryItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, user_id, track_id, track_title, artist, source, duration_secs, listened_at FROM playback_history WHERE user_id = ?1 ORDER BY listened_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![user_id, limit], |row| {
                Ok(HistoryItem {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    track_id: row.get(2)?,
                    track_title: row.get(3)?,
                    artist: row.get(4)?,
                    source: row.get(5)?,
                    duration_secs: row.get(6)?,
                    listened_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        Ok(rows.flatten().collect())
    }

    pub fn get_stats(&self, user_id: &str) -> Result<UserStats, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let total_played: u64 = conn
            .query_row(
                "SELECT COUNT(*) FROM playback_history WHERE user_id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let favorite_count: u64 = conn
            .query_row(
                "SELECT COUNT(*) FROM user_favorites WHERE user_id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let top_artist: Option<String> = conn
            .query_row(
                "SELECT artist FROM playback_history WHERE user_id = ?1 GROUP BY artist ORDER BY COUNT(*) DESC LIMIT 1",
                params![user_id],
                |row| row.get(0),
            )
            .ok();

        Ok(UserStats {
            total_played,
            favorite_count,
            top_artist,
        })
    }
}
