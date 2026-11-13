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

## ☁️ Cấu hình đồng bộ Supabase Cloud (Tùy chọn)

Spytify hoạt động **100% offline với SQLite** không phụ thuộc internet. Nếu bạn muốn đồng bộ Album, bài hát Yêu thích và Lịch sử nghe nhạc đa thiết bị miễn phí:

1. Tạo dự án miễn phí tại [Supabase](https://supabase.com).
2. Vào mục **SQL Editor** trong bảng điều khiển Supabase, dán đoạn mã bên dưới (hoặc mở file [`supabase/schema.sql`](supabase/schema.sql)) và nhấn **Run**:

<details>
<summary><b>📋 Bấm vào đây để xem / sao chép mã SQL khởi tạo Supabase</b></summary>

```sql
-- 1. Profiles & UI Preferences Table
CREATE TABLE IF NOT EXISTS public.spytify_profiles (
    id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    avatar TEXT,
    accent_color TEXT DEFAULT '#FF2A55',
    theme_mode TEXT DEFAULT 'dark',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. User Albums Table
CREATE TABLE IF NOT EXISTS public.spytify_albums (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    tracks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_albums_user_id ON public.spytify_albums(user_id);

-- 3. User Favorites Table
CREATE TABLE IF NOT EXISTS public.spytify_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_favs_user_id ON public.spytify_favorites(user_id);

-- 4. User Playback History Table
CREATE TABLE IF NOT EXISTS public.spytify_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    source TEXT NOT NULL,
    duration_secs INTEGER NOT NULL,
    path_or_url TEXT,
    cover_art TEXT,
    track_json JSONB,
    listened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_spytify_history_user_id ON public.spytify_history(user_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.spytify_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spytify_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-write for spytify_profiles" ON public.spytify_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spytify_albums" ON public.spytify_albums FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spytify_favorites" ON public.spytify_favorites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for spytify_history" ON public.spytify_history FOR ALL USING (true) WITH CHECK (true);
```

</details>

3. Trong Spytify, chuyển sang trang **Tài khoản**, dán **Project URL** và **Anon Public Key** (lấy từ *Project Settings -> API* trên Supabase) là xong!

---

## 📜 Giấy phép
Phát hành theo giấy phép [MIT](LICENSE). Tự do sử dụng và đóng góp!
