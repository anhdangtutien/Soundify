# 🕵️‍♂️ Spytify — Spy Music

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v0.1.1-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Rust Core](https://img.shields.io/badge/RUST-v1.85-DEA584?style=for-the-badge&logo=rust&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

Trình phát nhạc Hi-Fi đa nguồn, giao diện tối giản phong cách Discord, siêu nhẹ và tối ưu bộ nhớ.

[📥 **Tải bản cài đặt Windows (.exe)**](https://github.com/anhdangtutien/Spytify/raw/main/installers/Spytify_0.1.1_x64-setup.exe) • [🍏 **Bản cài đặt macOS (.dmg)**](#-hướng-dẫn-cài-đặt--chạy-từ-mã-nguồn) • [✨ **Tính năng nổi bật**](#-tính-năng-nổi-bật)

</div>

---

## 📥 Tải về cài đặt (Direct Download)

| Hệ điều hành | Định dạng | Dung lượng | Tải trực tiếp |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | `.exe` (NSIS Installer) | `~3.8 MB` | [📥 **Tải Spytify_0.1.1_x64-setup.exe**](https://github.com/anhdangtutien/Spytify/raw/main/installers/Spytify_0.1.1_x64-setup.exe) |
| **macOS (Apple Silicon & Intel)** | `.dmg` / `.app` | `~15 MB` | [🍏 **Xem trong GitHub Releases / Actions**](https://github.com/anhdangtutien/Spytify/actions) |

---

## ✨ Tính năng nổi bật

- 🎵 **Đa nguồn âm nhạc**: Nghe nhạc Lossless trên máy (FLAC, MP3, WAV, M4A), YouTube Hi-Fi (hỗ trợ xem MV), SoundCloud và Audius 320kbps.
- 🚀 **Siêu nhẹ & Tiết kiệm RAM**: Chỉ chiếm ~110-180MB RAM khi nghe nhạc và giảm sâu xuống còn ~30-50MB khi ẩn xuống khay hệ thống (System Tray).
- 🔒 **Single Instance**: Chỉ mở duy nhất 1 ứng dụng xuyên suốt, tự động phục hồi cửa sổ khi khởi chạy lại.
- 💾 **Tải nhạc offline & Ghi nhớ thư mục**: Tải bài hát trực tiếp về máy không cần ffmpeg; tự động ghi nhớ và quét thư mục nhạc nội bộ mỗi khi mở lại app.
- ⚡ **Thao tác nhanh**: Click 1 chạm trên danh sách bài hát để phát hoặc tạm dừng tức thì.
- 🎨 **Cá nhân hóa**: Đổi màu Accent (8 màu đặc vụ hoặc mã HEX tùy chọn), chế độ Dark/Light mode, hiệu ứng radar khởi động phong cách Discord.
- 🌐 **Đa ngôn ngữ**: Hỗ trợ đầy đủ Tiếng Việt, English, 日本語, 简体中文,...
- ☁️ **Đồng bộ đám mây (Tùy chọn)**: Hỗ trợ kết nối cơ sở dữ liệu Supabase miễn phí để đồng bộ Album, bài hát Yêu thích trên nhiều thiết bị.

---

## 🛠️ Hướng dẫn cài đặt & Chạy từ mã nguồn

### Yêu cầu:
- Node.js 18+ và Rust (cargo)

### 1. Dành cho Windows:
```bash
git clone https://github.com/anhdangtutien/Spytify.git
cd Spytify
npm install
npm run tauri dev
```
Đóng gói bộ cài đặt Windows:
```bash
npm run tauri build
```
File `.exe` sẽ nằm trong `src-tauri/target/release/bundle/nsis/`.

### 2. Dành cho macOS (MacBook):
```bash
git clone https://github.com/anhdangtutien/Spytify.git
cd Spytify
npm install
npm run tauri build
```
File `.dmg` sẽ nằm trong `src-tauri/target/release/bundle/dmg/`.

> **Lưu ý**: Bạn có thể chạy GitHub Actions workflow `Build & Release Spytify` trực tiếp trên GitHub để tự động build file `.dmg` Universal (chạy mượt trên cả chip M1/M2/M3/M4 và Intel).

---

## 📜 Giấy phép
Phát hành theo giấy phép [MIT](LICENSE). Tự do sử dụng và đóng góp!
