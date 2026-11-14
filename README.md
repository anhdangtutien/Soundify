# 🕵️‍♂️ Spytify — Spy Music

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v0.1.1-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Rust Core](https://img.shields.io/badge/RUST-v1.85-DEA584?style=for-the-badge&logo=rust&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight, Hi-Fi Multi-source Music Player & Downloader with Discord-inspired Cyberpunk HUD.**

[English](#-english) • [Tiếng Việt](#-tiếng-việt) • [Releases](https://github.com/anhdangtutien/Spytify/releases)

---

[🚀 **Download Latest Releases**](https://github.com/anhdangtutien/Spytify/releases) • [📥 **Windows Setup (.exe)**](https://github.com/anhdangtutien/Spytify/releases) • [🍏 **macOS Universal (.dmg)**](https://github.com/anhdangtutien/Spytify/releases)

</div>

---

# 🇬🇧 English

## 📖 Introduction
**Spytify** is a modern, ultra-fast, and memory-efficient desktop music player crafted with **Tauri v2**, **Rust**, and **React 19**. It unifies your favorite music sources into a sleek, stealthy, Discord-inspired dark-mode user interface.

Whether you are listening to your local lossless library (FLAC, WAV, MP3, M4A) or streaming high-fidelity audio from online platforms, Spytify provides zero latency, minimal CPU usage, and virtually zero memory bloat.

---

## 📥 Download & Installation

Visit the [GitHub Releases](https://github.com/anhdangtutien/Spytify/releases) page to download the latest builds:

| Operating System | Package Format | Direct Download |
| :--- | :--- | :--- |
| **Windows 10 / 11** | `.exe` (NSIS Installer) | [📥 **Download Windows (.exe)**](https://github.com/anhdangtutien/Spytify/releases) |
| **macOS (M-Series & Intel)** | `.dmg` (Universal Package) | [🍏 **Download macOS (.dmg)**](https://github.com/anhdangtutien/Spytify/releases) |

---

## ✨ Key Features

- 🎵 **Multi-source Music Playback**: Play local audio (FLAC, MP3, WAV, M4A, OGG) alongside online streaming from YouTube Hi-Fi (with video toggle), SoundCloud, and Audius 320kbps.
- ⚡ **Ultra Lightweight & RAM Friendly**: Consumes only ~110–180MB RAM while playing and drops to ~30–50MB when minimized to the system tray.
- 🔄 **In-App Recent Build Update Notification**: Automatically checks GitHub Releases for new builds (including incremental patches and bug fixes) based on release timestamps, providing 1-click installer download and release notes directly in the app.
- 🛑 **Flexible Close-to-Tray Setting**: Easily toggle between keeping music running in the system tray when closing the window or completely exiting the process.
- 💾 **Offline Music Downloader**: Download tracks with automated ID3 metadata tagging and embedded high-res cover art.
- 🎧 **Smart DJ & AI Recommendations**: Intelligent next-track suggestions and continuous playback tailored to your listening habits.
- 🎨 **Deep Customization**: Choose from 8 secret-agent accent colors or custom HEX codes, dark/light themes, and custom spy avatars.
- 🌐 **Global Multi-language**: Full native support for English, Vietnamese, Japanese, Chinese, and more.
- ☁️ **Cloud Sync (Optional)**: Free sync for Albums, Favorites, and Profiles across devices powered by Supabase with zero server maintenance.
- 🔒 **Single Instance**: Guaranteed single application process with automatic window focus on duplicate launches.

---

## ☁️ Cloud Sync Setup (Optional)

Spytify works **100% offline out of the box** using embedded SQLite. If you want multi-device synchronization:

1. Create a free account and project at [Supabase](https://supabase.com).
2. Inside Spytify, navigate to **Profile > Cloud Sync Hub** and click **"Copy Initial SQL"** (or use [`supabase/schema.sql`](supabase/schema.sql)).
3. Paste and run the SQL in your Supabase **SQL Editor**.
4. In Spytify, enter your **Project URL** and **Publishable (anon) Key** (found in *Supabase Project Settings > API*).

---

## 🛠️ Build from Source

### Prerequisites
- Node.js 18+ and npm
- Rust 1.77+ (`cargo`)

```bash
# 1. Clone repository
git clone https://github.com/anhdangtutien/Spytify.git
cd Spytify

# 2. Install dependencies
npm install

# 3. Run in development mode
npm run tauri dev

# 4. Build production installer
npm run tauri build
```
Compiled bundles will be generated under `src-tauri/target/release/bundle/`.

---

# 🇻🇳 Tiếng Việt

## 📖 Giới thiệu
**Spytify** là trình phát nhạc Desktop Hi-Fi siêu nhẹ, đa nguồn âm thanh, được xây dựng trên nền tảng **Tauri v2**, **Rust**, và **React 19**. Ứng dụng mang giao diện Cyberpunk bí mật tối giản phong cách Discord, tối ưu hoá tối đa hiệu năng và mức tiêu hao bộ nhớ.

Dù bạn đang nghe thư viện nhạc chất lượng cao trên ổ cứng (FLAC, WAV, MP3, M4A) hay thưởng thức âm nhạc trực tuyến, Spytify luôn mang lại trải nghiệm mượt mà, phản hồi tức thì và không lo giật lag.

---

## 📥 Tải về & Cài đặt

Truy cập trang [GitHub Releases](https://github.com/anhdangtutien/Spytify/releases) để tải các bản cài đặt mới nhất:

| Hệ điều hành | Định dạng | Tải trực tiếp từ Releases |
| :--- | :--- | :--- |
| **Windows 10 / 11** | `.exe` (Bộ cài đặt NSIS) | [📥 **Tải Spytify Windows (.exe)**](https://github.com/anhdangtutien/Spytify/releases) |
| **macOS (M1/M2/M3/M4 & Intel)** | `.dmg` (Universal Package) | [🍏 **Tải Spytify macOS (.dmg)**](https://github.com/anhdangtutien/Spytify/releases) |

---

## ✨ Tính năng nổi bật

- 🎵 **Âm nhạc đa nguồn**: Phát nhạc Lossless offline (FLAC, MP3, WAV, M4A, OGG) và trực tuyến chất lượng cao từ YouTube (hỗ trợ bật/tắt xem MV), SoundCloud và Audius 320kbps.
- ⚡ **Siêu nhẹ & Tiết kiệm tài nguyên**: Chỉ chiếm ~110–180MB RAM khi phát nhạc và giảm xuống còn ~30–50MB khi ẩn dưới khay hệ thống (System Tray).
- 🔄 **Thông báo cập nhật bản build mới ngay trên app**: Tự động so khớp thời gian phát hành trên GitHub Releases (nhận diện được cả các bản vá lỗi patch cùng phiên bản) kèm Release Notes và tải nhanh file setup `.exe` chỉ với 1 click.
- 🛑 **Tùy chỉnh tắt app hoàn toàn / khay hệ thống**: Tự do chuyển đổi giữa việc bấm `[X]` để thu nhỏ vào Tray hay đóng và giải phóng hoàn toàn ứng dụng.
- 💾 **Tải nhạc Offline**: Tải bài hát trực tiếp về máy, tự động nhúng bìa album chất lượng cao và thẻ thông tin ID3.
- 🎧 **Smart DJ & Đề xuất AI**: Tự động gợi ý và phát liên tục các bản nhạc phù hợp theo gu âm nhạc của bạn.
- 🎨 **Cá nhân hóa độc đáo**: 8 màu sắc đặc vụ hoặc mã HEX tự chọn, chế độ Sáng/Tối (Light/Dark mode) và bộ avatar đặc nhiệm phong cách.
- 🌐 **Đa ngôn ngữ toàn cầu**: Hỗ trợ đầy đủ Tiếng Việt, English, 日本語, 简体中文,...
- ☁️ **Đồng bộ đám mây (Tùy chọn)**: Hỗ trợ kết nối cơ sở dữ liệu Supabase miễn phí để đồng bộ Album, bài hát Yêu thích trên nhiều máy tính.
- 🔒 **Single Instance**: Khởi chạy một tiến trình duy nhất, tự động khôi phục cửa sổ khi mở lại ứng dụng.

---

## ☁️ Cấu hình đồng bộ Supabase Cloud (Tùy chọn)

Spytify hoạt động **100% offline với SQLite** có sẵn trong máy. Nếu bạn muốn đồng bộ dữ liệu qua máy tính khác:

1. Đăng ký tài khoản miễn phí tại [Supabase](https://supabase.com).
2. Trong Spytify, vào **Hồ sơ > Đồng bộ Đám mây** và bấm nút **"Sao chép SQL khởi tạo bảng"** (hoặc xem tại [`supabase/schema.sql`](supabase/schema.sql)).
3. Dán và nhấn **Run** trong mục **SQL Editor** trên Supabase.
4. Nhập **Project URL** và **Anon Public Key** (lấy tại *Supabase Project Settings > API*) vào app là hoàn tất.

---

## 🛠️ Biên dịch từ mã nguồn

### Yêu cầu:
- Node.js 18+ và npm
- Rust 1.77+ (`cargo`)

```bash
# 1. Clone repository
git clone https://github.com/anhdangtutien/Spytify.git
cd Spytify

# 2. Cài đặt các gói phụ thuộc
npm install

# 3. Chạy ở môi trường phát triển (Dev)
npm run tauri dev

# 4. Đóng gói bộ cài đặt Release
npm run tauri build
```
Bộ cài đặt sau khi đóng gói sẽ nằm trong thư mục `src-tauri/target/release/bundle/`.

---

## 📜 License
Phát hành theo giấy phép [MIT](LICENSE). Tự do sử dụng, chỉnh sửa và đóng góp!
