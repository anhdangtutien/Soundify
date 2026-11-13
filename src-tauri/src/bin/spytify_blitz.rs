//! Standalone / Hybrid Dioxus Native (Blitz) UI Entrypoint for Spytify (`rust-ui` branch)
//! Connects directly to `snutify_lib::audio::AudioPlayerManager`, `snutify_lib::db::DatabaseManager`,
//! and `snutify_lib::rust_ui::RustUiEngine` with 0ms IPC overhead.

use snutify_lib::audio::AudioPlayerManager;
use snutify_lib::db::DatabaseManager;
use snutify_lib::rust_ui::RustUiEngine;

fn main() {
    let audio = AudioPlayerManager::new();
    let db = DatabaseManager::new().expect("Failed to open Spytify SQLite DB");
    let ui_engine = RustUiEngine::new();

    ui_engine.sync_from_db(&db, "guest");
    let snap = ui_engine.snapshot(&audio);

    println!(
        "[Spytify Blitz / Rust UI] Initialized successfully! Loaded {} tracks in Fast Table.",
        snap.tracks.len()
    );
}
