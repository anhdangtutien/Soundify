# ⚡ Spytify - Ultra Hi-Fi Invincible Music Player & Browser

<div align="center">

![Spytify Banner](https://img.shields.io/badge/Spytify-Invincible%20Hi--Fi-FFE600?style=for-the-badge&logo=music&logoColor=black)
![Hero Cyan](https://img.shields.io/badge/Accent-Electric%20Cyan-00E5FF?style=for-the-badge)
![Tauri v2](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-Core-dea584?style=for-the-badge&logo=rust&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-rusqlite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

**Spytify** là trình phát nhạc tối giản (Minimalist), hiệu năng cao mang phong cách siêu anh hùng **Invincible**: nền đen OLED thuần khiết kết hợp dải màu kép **Vàng Electric (`#FFE600`)** xen kẽ **Xanh lơ Cyan (`#00E5FF`)**.

Được xây dựng trên nền tảng **Rust + Tauri v2 + React 19**, Spytify mang đến trải nghiệm nghe nhạc đỉnh cao không quảng cáo, tích hợp AI khuyến nghị tự huấn luyện 100% trên thiết bị (On-Device) và cơ sở dữ liệu SQLite nhúng.

*Tác giả:* **[anhdangtutien](https://github.com/anhdangtutien)**

</div>

---

## ⚡ Tính năng nổi bật

### 1. 🦸‍♂️ Giao diện Phong cách Siêu anh hùng Invincible
* **Tông màu biểu tượng:** Nền đen OLED tương phản cao kết hợp vàng hoàng gia rực rỡ (`#FFE600`) xen kẽ xanh điện tử (`#00E5FF`).
* **Sóng âm động Invincible Visualizer:** Waveform chuyển tiếp mượt mà từ trắng thuần khiết qua vàng hoàng kim và xanh lơ.
* **Thanh tiến trình Gradient:** Seekbar chuyển sắc mượt mà từ vàng sang xanh nhạt kèm hiệu ứng glow phát sáng khi hover.

### 2. 🌐 Nền tảng Âm nhạc Đa nguồn (Multi-Source Streaming)
* **Audius Open Music (320kbps MP3):** Tích hợp nền tảng âm nhạc mở phi tập trung hàng đầu thế giới. Phát toàn bộ bài hát chất lượng cao **320kbps Hi-Fi**, không bị giới hạn 30s preview, không cần API Key hay tài khoản trả phí.
* **YouTube Audio Stream:** Tìm kiếm và stream âm thanh chất lượng cao từ YouTube với chế độ phát ẩn hoặc mở cửa sổ video nổi linh hoạt.
* **SoundCloud Integration:** Tự động bắt link và đồng bộ điều khiển qua SoundCloud Widget API.
* **Local Lossless Engine (FLAC / WAV / MP3 / M4A / ALAC):** Quét thư mục nhạc cục bộ đa luồng siêu tốc bằng **Rayon** + **Lofty**, tự động trích xuất Cover Art dạng Base64 và thông tin Metadata trong tích tắc.

### 3. 🧠 AI Gợi ý Nhạc Tự Huấn luyện (On-Device Rust AI Engine)
* **Không dùng API trả phí:** Toàn bộ thuật toán AI chạy trực tiếp trong Rust core trên máy tính của bạn, đảm bảo tính bảo mật và quyền riêng tư tuyệt đối.
* **Vector hóa TF-IDF & Cosine Similarity:** Phân tích từ khóa tiêu đề, nghệ sĩ, thời lượng và thể loại để tính toán điểm tương đồng (`match_score` từ 0 - 100%).
* **AI Smart DJ Auto-Transition:** Tự động phân tích bài hát đang nghe để gợi ý bài tiếp theo mượt mà nhất trong hàng đợi.
* **Màn hình AI Discovery Mix:** Trực quan hóa quá trình huấn luyện theo thời gian thực (Epochs, Model Loss, Accuracy, Top Tags).

### 4. 🗄️ Cơ sở Dữ liệu Nhúng SQLite (`spytify.db`)
* Lưu trữ an toàn tại thư mục hệ thống người dùng `%LOCALAPPDATA%\Spytify\spytify.db` (tự động kế thừa từ Soundify nếu có).
* **Quản lý Tài khoản Cục bộ:** Hỗ trợ đăng ký / đăng nhập bằng Username hoặc Email, mã hóa mật khẩu an toàn với muối ngẫu nhiên (Salt + SHA-256).
* **Lịch sử & Yêu thích:** Tự động đồng bộ và lưu trữ danh sách bài hát yêu thích cùng lịch sử nghe nhạc.

### 5. 🎯 Trải nghiệm Phát nhạc Hoàn hảo (Zero Audio Overlap)
* **Triệt tiêu chồng chéo âm thanh:** Cơ chế ngắt dứt khoát tất cả các luồng âm thanh khác khi chuyển nguồn phát (YouTube, SoundCloud, Audius, Local).
* **Wall-Clock Time Tracking:** Tính thời gian phát chính xác dựa trên đồng hồ thực của hệ thống (`Date.now()`), không bị giật/kẹt seekbar khi người dùng chuyển sang tab khác hoặc thu nhỏ cửa sổ.
* **Instant Focus Resync:** Tự động đồng bộ lại trạng thái Play/Pause và thời gian phát ngay khi ứng dụng nhận lại focus.

---

## 🛠️ Ngăn xếp Công nghệ (Tech Stack)

| Thành phần | Công nghệ sử dụng |
|---|---|
| **Khung ứng dụng (Shell)** | [Tauri v2](https://tauri.app/) (Siêu nhẹ, ~40MB RAM so với >500MB của Electron) |
| **Backend Core** | [Rust](https://www.rust-lang.org/) (Tokyo runtime, Rusqlite, Rayon, Lofty, Rodio, Reqwest) |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Styling & Theme** | [Tailwind CSS v4](https://tailwindcss.com/) (Invincible Hero Palette: Black `#000000`, Gold `#FFE600`, Cyan `#00E5FF`) |
| **Bundler** | [Vite 8](https://vitejs.dev/) |
| **Cơ sở dữ liệu** | SQLite 3 (`rusqlite` bundled) |
| **Bộ Icon** | Lucide React |

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
Ứng dụng sẽ tự động biên dịch mã nguồn Rust, khởi động Vite dev server và mở cửa sổ Spytify với tính năng Hot Reload.

### 3. Đóng gói ứng dụng thành file cài đặt (Production Build)
```bash
npm run tauri build
```
Sau khi hoàn tất, bộ cài đặt và file thực thi sẽ được lưu tại:
* **Bộ cài Windows (NSIS / MSI):** `src-tauri/target/release/bundle/nsis/`
* **File chạy trực tiếp (Portable):** `src-tauri/target/release/Spytify.exe`

---

## 👤 Tác giả

* **GitHub:** [@anhdangtutien](https://github.com/anhdangtutien)
* **Dự án:** Spytify - Invincible Hi-Fi Music Player

---

## 📄 Bản quyền (License)

Dự án được phân phối dưới giấy phép [MIT License](LICENSE). Tự do sử dụng, chỉnh sửa và đóng góp!
