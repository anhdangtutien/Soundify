# 🎵 Soundify - Ultra Hi-Fi Minimalist Music Player & Browser

<div align="center">

![Soundify Banner](https://img.shields.io/badge/Soundify-Hi--Fi%20Audio-00E5FF?style=for-the-badge&logo=music)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-Core-dea584?style=for-the-badge&logo=rust&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-rusqlite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

**Soundify** là trình phát nhạc tối giản (Minimalist), hiệu năng cao lấy cảm hứng từ phong cách thuần đen OLED của **TIDAL** kết hợp điểm nhấn **Electric Cyan** của **Amazon Music Ultra HD**.

Được xây dựng trên nền tảng **Rust + Tauri v2 + React 19**, Soundify mang đến trải nghiệm nghe nhạc không quảng cáo, tích hợp AI khuyến nghị tự huấn luyện 100% trên thiết bị (On-Device) và cơ sở dữ liệu SQLite nhúng.

*Tác giả:* **[anhdangtutien](https://github.com/anhdangtutien)**

</div>

---

## ⚡ Tính năng nổi bật

### 1. 🌐 Nền tảng Âm nhạc Đa nguồn (Multi-Source Streaming)
* **Audius Open Music (320kbps MP3):** Tích hợp nền tảng âm nhạc mở phi tập trung hàng đầu thế giới. Phát toàn bộ bài hát chất lượng cao **320kbps Hi-Fi**, không bị giới hạn 30s preview, không cần API Key hay tài khoản trả phí.
* **YouTube Audio Stream:** Tìm kiếm và stream âm thanh chất lượng cao từ YouTube với chế độ phát ẩn hoặc mở cửa sổ video nổi linh hoạt.
* **SoundCloud Integration:** Tự động bắt link và đồng bộ điều khiển qua SoundCloud Widget API.
* **Local Lossless Engine (FLAC / WAV / MP3 / M4A / ALAC):** Quét thư mục nhạc cục bộ đa luồng siêu tốc bằng **Rayon** + **Lofty**, tự động trích xuất Cover Art dạng Base64 và thông tin Metadata trong tích tắc.

### 2. 🧠 AI Gợi ý Nhạc Tự Huấn luyện (On-Device Rust AI Engine)
* **Không dùng API trả phí:** Toàn bộ thuật toán AI chạy trực tiếp trong Rust core trên máy tính của bạn, đảm bảo tính bảo mật và quyền riêng tư tuyệt đối.
* **Vector hóa TF-IDF & Cosine Similarity:** Phân tích từ khóa tiêu đề, nghệ sĩ, thời lượng và thể loại để tính toán điểm tương đồng (`match_score` từ 0 - 100%).
* **AI Smart DJ Auto-Transition:** Tự động phân tích bài hát đang nghe để gợi ý bài tiếp theo mượt mà nhất trong hàng đợi.
* **Màn hình AI Discovery Mix:** Trực quan hóa quá trình huấn luyện theo thời gian thực (Epochs, Model Loss, Accuracy, Top Tags).

### 3. 🗄️ Cơ sở Dữ liệu Nhúng SQLite (`soundify.db`)
* Lưu trữ an toàn tại thư mục hệ thống người dùng `%LOCALAPPDATA%\Soundify\soundify.db` (tránh reload lặp).
* **Quản lý Tài khoản Cục bộ:** Hỗ trợ đăng ký / đăng nhập bằng Username hoặc Email, mã hóa mật khẩu an toàn với muối ngẫu nhiên (Salt + SHA-256).
* **Lịch sử & Yêu thích:** Tự động đồng bộ và lưu trữ danh sách bài hát yêu thích cùng lịch sử nghe nhạc.

### 4. 🎯 Trải nghiệm Phát nhạc Hoàn hảo (Zero Audio Overlap)
* **Triệt tiêu chồng chéo âm thanh:** Cơ chế ngắt dứt khoát tất cả các luồng âm thanh khác khi chuyển nguồn phát (YouTube, SoundCloud, Audius, Local).
* **Wall-Clock Time Tracking:** Tính thời gian phát chính xác dựa trên đồng hồ thực của hệ thống (`Date.now()`), không bị giật/kẹt seekbar khi người dùng chuyển sang tab khác hoặc thu nhỏ cửa sổ.
* **Instant Focus Resync:** Tự động đồng bộ lại trạng thái Play/Pause và thời gian phát ngay khi ứng dụng nhận lại focus.
* **Sóng âm động (Hi-Fi Visualizer):** Hiệu ứng visualizer sóng âm thời gian thực với dải màu chuyển tiếp từ Pure White sang Electric Cyan rực rỡ.

---

## 🛠️ Ngăn xếp Công nghệ (Tech Stack)

| Thành phần | Công nghệ sử dụng |
|---|---|
| **Khung ứng dụng (Shell)** | [Tauri v2](https://tauri.app/) (Siêu nhẹ, ~40MB RAM so với >500MB của Electron) |
| **Backend Core** | [Rust](https://www.rust-lang.org/) (Tokyo runtime, Rusqlite, Rayon, Lofty, Rodio, Reqwest) |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Styling & Theme** | [Tailwind CSS v4](https://tailwindcss.com/) (TIDAL Minimalist OLED Black `#000000` + Electric Cyan `#00E5FF`) |
| **Bundler** | [Vite 8](https://vitejs.dev/) |
| **Cơ sở dữ liệu** | SQLite 3 (`rusqlite` bundled) |
| **Bộ Icon** | Lucide React |

---

## 📁 Cấu trúc Thư mục

```text
Snutify/
├── src/                          # Mã nguồn Frontend (React 19 + TypeScript)
│   ├── components/               # Các UI component (Sidebar, PlayerBar, TrackTable, SearchView, AiMixView, AuthModal...)
│   ├── types/                    # Định nghĩa kiểu dữ liệu TypeScript
│   ├── App.tsx                   # Trình điều khiển trung tâm & Quản lý phát nhạc đa nguồn
│   └── index.css                 # Phong cách TIDAL OLED Black & thanh cuộn tối giản
├── src-tauri/                    # Mã nguồn Backend (Rust)
│   ├── src/
│   │   ├── ai/                   # Engine AI gợi ý nhạc & Smart DJ (TF-IDF & Cosine Similarity)
│   │   ├── sources/              # Module tìm kiếm & stream (Audius, YouTube, SoundCloud)
│   │   ├── audio.rs              # Bộ máy phát nhạc Local lossless (Rodio)
│   │   ├── scanner.rs            # Bộ quét file nhạc đa luồng (Rayon + Lofty)
│   │   ├── db.rs                 # Quản trị cơ sở dữ liệu SQLite & Xác thực người dùng
│   │   └── lib.rs                # Cầu nối IPC Tauri (Commands & State)
│   ├── icons/                    # Biểu tượng ứng dụng đa kích cỡ
│   ├── Cargo.toml                # Cấu hình dependency Rust & tối ưu hóa Release
│   └── tauri.conf.json           # Cấu hình cửa sổ & đóng gói ứng dụng
└── package.json
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu hệ thống
* **Node.js:** v18+ trở lên
* **Rust:** v1.75+ (Cài đặt qua [rustup.rs](https://rustup.rs/))
* **Hệ điều hành:** Windows 10/11 (hỗ trợ cả macOS & Linux)

### 1. Cài đặt các thư viện phụ thuộc
```bash
npm install
```

### 2. Khởi chạy chế độ Phát triển (Development)
```bash
npm run tauri dev
```
Ứng dụng sẽ tự động biên dịch mã nguồn Rust, khởi động Vite dev server và mở cửa sổ Soundify với tính năng Hot Reload.

### 3. Đóng gói ứng dụng thành file cài đặt (Production Build)
```bash
npm run tauri build
```
Sau khi hoàn tất, bộ cài đặt và file thực thi sẽ được lưu tại:
* **Bộ cài Windows (NSIS / MSI):** `src-tauri/target/release/bundle/nsis/`
* **File chạy trực tiếp (Portable):** `src-tauri/target/release/Soundify.exe`

---

## 👤 Tác giả

* **GitHub:** [@anhdangtutien](https://github.com/anhdangtutien)
* **Dự án:** Soundify - Minimalist Hi-Fi Music Player

---

## 📄 Bản quyền (License)

Dự án được phân phối dưới giấy phép [MIT License](LICENSE). Tự do sử dụng, chỉnh sửa và đóng góp!
