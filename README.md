# 🕵️‍♂️ Spytify — Spy Music (v1.0.0 Space Jam Edition)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.0.0-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Rust Core](https://img.shields.io/badge/RUST-v1.85-DEA584?style=for-the-badge&logo=rust&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight, Hi-Fi Multi-source Music Player & Downloader with Discord-inspired Space Jam Voice HUD.**

[English](#-english) • [Tiếng Việt](#-tiếng-việt) • [Releases](https://github.com/anhdangtutien/Spytify/releases)

---

[🚀 **Download Latest Releases**](https://github.com/anhdangtutien/Spytify/releases) • [📥 **Windows Setup (.exe)**](https://github.com/anhdangtutien/Spytify/releases) • [🍏 **macOS Universal (.dmg)**](https://github.com/anhdangtutien/Spytify/releases)

</div>

---

# 🇬🇧 English

## 🌟 What's New in v1.0.0 — Space Jam Big Update

The **v1.0.0 Space Jam Release** marks the largest architectural and feature evolution of Spytify, transforming it from a personal stealth music player into a collaborative cyberpunk music social hub:

- 🚀 **Space Jam (Community Voice Lounges & DJ Bots)**:
  - Real-time Discord-style community servers and voice rooms with live user presence.
  - Interactive DJ Music Bots: right-click any DJ bot (like DJ CyberHawk) to "Listen Along" (`Nghe cùng`) and sync music playback in real-time.
  - Signature In-Call Floating Dock with quick mic mute, deafen, audio settings, and smooth disconnect controls.
  - Dynamic Server Theming: entering any Space Jam server instantly re-themes the entire application HUD to the server's cyberpunk palette; exiting seamlessly restores your personal theme.
- 👥 **Mutual Friend & Follow System**:
  - Send friend requests / follow real registered users from the SQLite/Cloud database or AI operatives.
  - Mutual follow confirmation: users only become official friends when both follow each other.
  - User profiles, direct status pings, and per-user microphone volume sliders.
- 🎚️ **Calibrated 0–100% Volume Ceiling**:
  - Unified audio gain ceiling strictly capped at 100% across microphone input, speaker output, user voice streams, and master music playback to prevent audio clipping or sudden loud bursts.
- 🖼️ **Album Creator & Cover Art Editor**:
  - Customize any playlist or album: edit title, description, and cover artwork with custom URLs or 1-click select from track artwork.
- 🖱️ **Mouse Side-Button Navigation Guard**:
  - Intercepts hardware mouse buttons 3 & 4 (forward / backward) to prevent Chromium/Tauri history desynchronization while maintaining smooth track switching.
- ⚡ **Skeleton Shimmer Loading**:
  - Sleek animated shimmer placeholders for Trending charts and Search results, eliminating visual flickering and mismatched track jumping during network requests.
- 🌊 **Fluid Waveform 60FPS**:
  - Multi-layer real-time frequency visualizer with Bass, Mid, and Treble spectrum animation dynamically color-synced with active themes.
- 🎧 **SoundCloud Top Charts & Audius Lossless**:
  - Added SoundCloud Top Trending Charts alongside YouTube Hi-Fi and Audius 320kbps streams.
- 🗜️ **Snug Floating Next-Track Dock**:
  - Re-anchored floating Next-Track widget to sit tightly above the player dock in both expanded and minimized states.

---

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

## ✨ Core Features

- 🎵 **Multi-source Music Playback**: Play local audio (FLAC, MP3, WAV, M4A, OGG) alongside online streaming from YouTube Hi-Fi (with video toggle), SoundCloud, and Audius 320kbps.
- ⚡ **Ultra Lightweight & RAM Friendly**: Consumes only ~110–180MB RAM while playing and drops to ~30–50MB when minimized to the system tray.
- 🔄 **In-App Recent Build Update Notification**: Automatically checks GitHub Releases for new builds (including incremental patches and bug fixes) based on release timestamps, providing 1-click installer download and release notes directly in the app.
- 🛑 **Flexible Close-to-Tray Setting**: Easily toggle between keeping music running in the system tray when closing the window or completely exiting the process.
- 💾 **Offline Music Downloader**: Download tracks with automated ID3 metadata tagging and embedded high-res cover art.
- 🎧 **Smart DJ & AI Recommendations**: Intelligent next-track suggestions and continuous playback tailored to your listening habits.
- 🎨 **Deep Customization**: Choose from 8 secret-agent accent colors or custom HEX codes, dark/light themes, and custom spy avatars.
- 🌐 **Global Multi-language**: Full native support for English, Vietnamese, Japanese, Chinese, and Korean.
- ☁️ **Cloud Sync (Optional)**: Free sync for Albums, Favorites, and Profiles across devices powered by Supabase with zero server maintenance.
- 🔒 **Single Instance**: Guaranteed single application process with automatic window focus on duplicate launches.

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

## 🌟 Điểm mới trong bản cập nhật lớn v1.0.0 — Space Jam

Bản phát hành **v1.0.0 Space Jam Edition** đánh dấu bước chuyển mình toàn diện của Spytify, mang đến không gian nghe nhạc cộng đồng phong cách Cyberpunk Discord cực ngầu:

- 🚀 **Space Jam (Trạm Sóng Voice & Bot DJ Phát Nhạc)**:
  - Tạo và tham gia các phòng trò chuyện trực tiếp (Voice Room) thời gian thực với bạn bè.
  - Bot DJ thông minh: Chuột phải vào DJ bot (ví dụ DJ CyberHawk) để chọn "Nghe cùng" đồng bộ âm nhạc trực tiếp theo phòng.
  - Thanh điều khiển nổi Bottom Dock phong cách Discord: Bật/tắt mic nhanh, điếc tai nghe (Deafen), mở cài đặt thiết bị và nút rời phòng tiện lợi.
  - Đồng bộ Theme Server tức thì: Khi vào phòng nào, toàn bộ giao diện app sẽ chuyển sang màu sắc chủ đạo của phòng đó; khi rời Space Jam sẽ lập tức trả về theme cá nhân của bạn.
- 👥 **Hệ thống Bạn Bè & Theo Dõi Hai Chiều**:
  - Tìm kiếm người dùng thật từ cơ sở dữ liệu SQLite/Cloud hoặc kết bạn với các đặc vụ mẫu.
  - Cơ chế Follow đối ứng: Khi nhấn Kết bạn sẽ gửi lời mời / theo dõi, chỉ khi cả hai cùng theo dõi nhau mới chính thức trở thành Bạn bè.
  - Xem hồ sơ mật vụ (Profile Modal), chỉnh âm lượng riêng cho từng người và kiểm tra độ trễ (ping).
- 🎚️ **Giới Hạn Âm Lượng Chuẩn 0–100%**:
  - Toàn bộ thanh trượt âm lượng Mic vào, Loa ra, âm lượng từng thành viên và âm lượng nhạc chính đều được cố định mức tối đa 100%, bảo vệ tai và chống vỡ tiếng.
- 🖼️ **Trình Chỉnh Sửa Album Toàn Diện**:
  - Tự do đổi tên Album, mô tả và ảnh bìa: dán URL ảnh trực tiếp hoặc bấm 1 chạm để lấy ảnh bài hát bất kỳ có trong album.
- 🖱️ **Khóa Nút Phụ Chuột (Mouse 4/5 Navigation Lock)**:
  - Chặn triệt để hiện tượng con chuột gaming bấm nút Back/Forward làm nhảy trang web / mất đồng bộ danh sách bài hát trong Tauri Chromium.
- ⚡ **Hiệu Ứng Khung Xương Đang Tải (Skeleton Shimmer)**:
  - Khi làm mới hoặc chuyển thể loại bài hát thịnh hành, app sẽ hiện khung xương chuyển động mượt mà thay vì nháy sai bài cũ rồi mới tải.
- 🌊 **Fluid Waveform 60FPS**:
  - Dải sóng âm thanh mượt mà 60 khung hình/giây, phân tách 3 dải Bass / Mid / Treble và đổi màu đồng bộ theo theme đang chọn.
- 🎧 **Bảng Xếp Hạng SoundCloud & Đa Nguồn Lossless**:
  - Tích hợp thêm Top bài hát SoundCloud vào Thịnh hành cùng với YouTube Hi-Fi và Audius 320kbps.
- 🗜️ **Khung Gợi Ý Bài Tiếp Theo Gọn Gàng**:
  - Căn chỉnh khoảng cách khung nổi Next Track nằm sát thanh phát nhạc, dù ở chế độ mở rộng hay thu nhỏ thanh phát.

---

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
- 🔄 **Thông báo cập nhật bản build mới ngay trên app**: Tự động so khớp thời gian phát hành trên GitHub Releases kèm Release Notes và tải nhanh file setup `.exe` chỉ với 1 click.
- 🛑 **Tùy chỉnh tắt app hoàn toàn / khay hệ thống**: Tự do chuyển đổi giữa việc bấm `[X]` để thu nhỏ vào Tray hay đóng và giải phóng hoàn toàn ứng dụng.
- 💾 **Tải nhạc Offline**: Tải bài hát trực tiếp về máy, tự động nhúng bìa album chất lượng cao và thẻ thông tin ID3.
- 🎧 **Smart DJ & Đề xuất AI**: Tự động gợi ý và phát liên tục các bản nhạc phù hợp theo gu âm nhạc của bạn.
- 🎨 **Cá nhân hóa độc đáo**: 8 màu sắc đặc vụ hoặc mã HEX tự chọn, chế độ Sáng/Tối (Light/Dark mode) và bộ avatar đặc nhiệm phong cách.
- 🌐 **Đa ngôn ngữ toàn cầu**: Hỗ trợ đầy đủ Tiếng Việt, English, 日本語, 简体中文, 한국어.
- ☁️ **Đồng bộ đám mây (Tùy chọn)**: Hỗ trợ kết nối cơ sở dữ liệu Supabase miễn phí để đồng bộ Album, bài hát Yêu thích trên nhiều máy tính.
- 🔒 **Single Instance**: Khởi chạy một tiến trình duy nhất, tự động khôi phục cửa sổ khi mở lại ứng dụng.

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
