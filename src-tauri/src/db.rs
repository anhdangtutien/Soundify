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
            .join("Spytify");

        std::fs::create_dir_all(&db_dir).map_err(|e| e.to_string())?;
        let db_path = db_dir.join("spytify.db");

        // Seamless migration from Soundify database if available
        if !db_path.exists() {
            if let Some(parent) = db_dir.parent() {
                let old_db = parent.join("Soundify").join("soundify.db");
                if old_db.exists() {
                    let _ = std::fs::copy(&old_db, &db_path);
                }
            }
        }

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
        let _ = conn.execute("ALTER TABLE playback_history ADD COLUMN path_or_url TEXT", []);
        let _ = conn.execute("ALTER TABLE playback_history ADD COLUMN track_json TEXT", []);

        // Automatic migration: Convert any legacy random UUID user IDs to deterministic user IDs
        // so that accounts seamlessly match across all devices and Google login
        if let Ok(mut stmt) = conn.prepare("SELECT id, username, email FROM users") {
            let legacy_users: Vec<(String, String, Option<String>)> = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                })
                .ok()
                .map(|rows| rows.filter_map(Result::ok).collect())
                .unwrap_or_default();

            for (old_id, username, email) in legacy_users {
                if !old_id.starts_with("usr_") {
                    let seed = email.as_deref().unwrap_or(&username);
                    let new_id = Self::generate_deterministic_user_id(seed);
                    if new_id != old_id {
                        let exists: bool = conn
                            .query_row(
                                "SELECT 1 FROM users WHERE id = ?1",
                                params![new_id],
                                |_| Ok(true),
                            )
                            .unwrap_or(false);

                        if exists {
                            let _ = conn.execute(
                                "UPDATE OR IGNORE user_favorites SET user_id = ?1 WHERE user_id = ?2",
                                params![new_id, old_id],
                            );
                            let _ = conn.execute(
                                "DELETE FROM user_favorites WHERE user_id = ?1",
                                params![old_id],
                            );
                            let _ = conn.execute(
                                "UPDATE playback_history SET user_id = ?1 WHERE user_id = ?2",
                                params![new_id, old_id],
                            );
                            let _ = conn.execute("DELETE FROM users WHERE id = ?1", params![old_id]);
                        } else {
                            let _ = conn.execute(
                                "UPDATE users SET id = ?1 WHERE id = ?2",
                                params![new_id, old_id],
                            );
                            let _ = conn.execute(
                                "UPDATE user_favorites SET user_id = ?1 WHERE user_id = ?2",
                                params![new_id, old_id],
                            );
                            let _ = conn.execute(
                                "UPDATE playback_history SET user_id = ?1 WHERE user_id = ?2",
                                params![new_id, old_id],
                            );
                        }
                    }
                }
            }
        }

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn hash_password(password: &str, salt: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(salt.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn generate_deterministic_user_id(identifier: &str) -> String {
        let clean = identifier.trim().to_lowercase();
        let mut hasher = Sha256::new();
        hasher.update(b"spytify_user_id_v2:");
        hasher.update(clean.as_bytes());
        let hex = format!("{:x}", hasher.finalize());
        format!("usr_{}", &hex[..18])
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
        
        // Unified deterministic user ID based on email (or username) so it matches across all devices & Google login
        let seed = email_clean.as_deref().unwrap_or(&username_clean);
        let user_id = Self::generate_deterministic_user_id(seed);

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
            } else if e.to_string().contains("UNIQUE constraint failed: users.id") {
                "Tài khoản hoặc email này đã tồn tại trên thiết bị".to_string()
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
            email: email_clean,
        })
    }

    pub fn login(&self, identifier: &str, password: &str) -> Result<User, String> {
        let clean_id = identifier.trim().to_lowercase();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Support login by either username OR email!
        let mut stmt = conn
            .prepare("SELECT id, username, password_hash, salt, display_name, avatar, created_at, email FROM users WHERE username = ?1 OR email = ?1")
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
                    row.get::<_, Option<String>>(7)?,
                ))
            })
            .map_err(|_| "Tài khoản / Email hoặc mật khẩu không chính xác".to_string())?;

        let (id, uname, stored_hash, salt, display_name, avatar, created_at, email) = user_row;
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
            email,
        })
    }

    pub fn google_login(
        &self,
        google_id: &str,
        email: &str,
        display_name: &str,
        avatar: Option<&str>,
    ) -> Result<User, String> {
        let clean_email = email.trim().to_lowercase();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // 1. Check if user exists by google_id or email
        let mut stmt = conn
            .prepare("SELECT id, username, display_name, avatar, created_at, email FROM users WHERE google_id = ?1 OR email = ?2")
            .map_err(|e| e.to_string())?;

        let existing = stmt.query_row(params![google_id, clean_email], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                avatar: row.get(3)?,
                created_at: row.get(4)?,
                email: row.get(5)?,
            })
        });

        match existing {
            Ok(mut user) => {
                // Link google_id and update avatar/display_name if empty
                let _ = conn.execute(
                    "UPDATE users SET google_id = ?1, avatar = COALESCE(avatar, ?2) WHERE id = ?3",
                    params![google_id, avatar, user.id],
                );
                if user.avatar.is_none() {
                    user.avatar = avatar.map(|s| s.to_string());
                }
                Ok(user)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 2. Create new user with deterministic user_id based on email so it seamlessly matches other devices!
                let user_id = Self::generate_deterministic_user_id(&clean_email);
                let username = clean_email
                    .split('@')
                    .next()
                    .unwrap_or("google_user")
                    .to_lowercase();

                let salt = "GOOGLE_OAUTH";
                let hash = "GOOGLE_OAUTH";

                conn.execute(
                    "INSERT INTO users (id, username, password_hash, salt, display_name, avatar, google_id, email)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                     ON CONFLICT(id) DO UPDATE SET
                        google_id = excluded.google_id,
                        avatar = COALESCE(users.avatar, excluded.avatar)",
                    params![user_id, username, hash, salt, display_name, avatar, google_id, clean_email],
                )
                .map_err(|e| e.to_string())?;

                Ok(User {
                    id: user_id,
                    username,
                    display_name: display_name.to_string(),
                    avatar: avatar.map(|s| s.to_string()),
                    created_at: "Vừa xong".to_string(),
                    email: Some(clean_email),
                })
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn import_user(
        &self,
        id: &str,
        username: &str,
        email: Option<&str>,
        password_hash: &str,
        salt: &str,
        display_name: &str,
        avatar: Option<&str>,
    ) -> Result<User, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Purge any stale local account with conflicting username or email but different id
        // to prevent UNIQUE constraint failure when importing from cloud
        let _ = conn.execute(
            "DELETE FROM users WHERE (LOWER(username) = LOWER(?1) OR (email IS NOT NULL AND LOWER(email) = LOWER(?2))) AND id != ?3",
            params![username, email.unwrap_or(""), id],
        );

        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, salt, display_name, avatar)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                email = excluded.email,
                password_hash = excluded.password_hash,
                salt = excluded.salt,
                display_name = excluded.display_name,
                avatar = COALESCE(users.avatar, excluded.avatar)",
            params![id, username, email, password_hash, salt, display_name, avatar],
        )
        .map_err(|e| e.to_string())?;

        Ok(User {
            id: id.to_string(),
            username: username.to_string(),
            display_name: display_name.to_string(),
            avatar: avatar.map(|s| s.to_string()),
            created_at: "Đồng bộ từ Cloud".to_string(),
            email: email.map(|s| s.to_string()),
        })
    }

    pub fn get_user_credentials(&self, user_id: &str) -> Option<(String, String)> {
        let conn = self.conn.lock().ok()?;
        let mut stmt = conn.prepare("SELECT password_hash, salt FROM users WHERE id = ?1").ok()?;
        stmt.query_row(params![user_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).ok()
    }

    pub fn get_user_by_id(&self, user_id: &str) -> Result<Option<User>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, username, display_name, avatar, created_at, email FROM users WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let res = stmt.query_row(params![user_id], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                display_name: row.get(2)?,
                avatar: row.get(3)?,
                created_at: row.get(4)?,
                email: row.get(5)?,
            })
        });

        match res {
            Ok(u) => Ok(Some(u)),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // Fallback: If user ID was migrated from UUID to deterministic ID, return active user
                let mut fallback_stmt = conn
                    .prepare("SELECT id, username, display_name, avatar, created_at, email FROM users ORDER BY created_at DESC LIMIT 1")
                    .map_err(|e| e.to_string())?;
                let fallback = fallback_stmt.query_row([], |row| {
                    Ok(User {
                        id: row.get(0)?,
                        username: row.get(1)?,
                        display_name: row.get(2)?,
                        avatar: row.get(3)?,
                        created_at: row.get(4)?,
                        email: row.get(5)?,
                    })
                }).ok();
                Ok(fallback)
            }
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn update_avatar(&self, user_id: &str, avatar: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE users SET avatar = ?1 WHERE id = ?2",
            rusqlite::params![avatar, user_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
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

    pub fn add_favorite_if_missing(&self, user_id: &str, track: &Track) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string(track).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO user_favorites (user_id, track_id, track_json) VALUES (?1, ?2, ?3)",
            params![user_id, track.id, json],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn add_history(&self, user_id: &str, track: &Track) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let source_str = format!("{:?}", track.source).to_lowercase();
        let track_json = serde_json::to_string(track).unwrap_or_default();
        conn.execute(
            "INSERT INTO playback_history (user_id, track_id, track_title, artist, source, duration_secs, path_or_url, track_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![user_id, track.id, track.title, track.artist, source_str, track.duration_secs, track.path_or_url, track_json],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_history(&self, user_id: &str, limit: u32) -> Result<Vec<HistoryItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, user_id, track_id, track_title, artist, source, duration_secs, listened_at, path_or_url, track_json FROM playback_history WHERE user_id = ?1 ORDER BY listened_at DESC LIMIT ?2")
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
                    path_or_url: row.get(8).unwrap_or(None),
                    track_json: row.get(9).unwrap_or(None),
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
