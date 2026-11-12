import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { User, UserStats, HistoryItem, Track } from '../types';
import { 
  User as UserIcon, LogOut, Clock, Heart, Headphones, 
  Music, RefreshCw, Disc, Palette, Camera, Upload, Trash2, 
  Check, Sparkles, Shield, Sun, Moon, Download, Database, HardDriveDownload,
  Cloud, CloudLightning, Key, ChevronDown, ChevronUp
} from 'lucide-react';
import { 
  getStoredSupabaseConfig, saveStoredSupabaseConfig, isSupabaseConfigured,
  cloudSyncPush, cloudSyncPull
} from '../services/supabase';

interface ProfileViewProps {
  currentUser: User | null;
  accentColor: string;
  themeMode: 'dark' | 'light';
  onUpdateAccentColor: (color: string) => void;
  onToggleThemeMode: () => void;
  onUpdateAvatar: (avatarBase64: string) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onPlayTrack: (track: Track) => void;
}

// 8 Curated Spy / Classified Theme Colors
export const THEME_PALETTE = [
  { name: 'Crimson Red', hex: '#FF2A55', desc: 'Báo động đỏ (Mặc định)' },
  { name: 'Cyber Cyan', hex: '#00E5FF', desc: 'Công nghệ Neon' },
  { name: 'Solar Gold', hex: '#FFE600', desc: 'Đặc vụ Hoàng kim' },
  { name: 'Matrix Green', hex: '#10B981', desc: 'Mạng ngầm Terminal' },
  { name: 'Phantom Violet', hex: '#A855F7', desc: 'Bóng ma Tàng hình' },
  { name: 'Titanium White', hex: '#FFFFFF', desc: 'Đơn sắc Tối giản' },
  { name: 'Agent Orange', hex: '#FF6B00', desc: 'Tác chiến Sa mạc' },
  { name: 'Cobalt Blue', hex: '#3B82F6', desc: 'Tình báo Biển sâu' },
];

// 6 Secret Agent SVG Preset Avatars
export const SPY_AVATARS = [
  {
    id: '007',
    name: 'Mật vụ 007',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230c0c10" rx="20"/><ellipse cx="50" cy="40" rx="35" ry="7" fill="%23ff2a55"/><path d="M28 40 C28 20 72 20 72 40 Z" fill="%23ffffff"/><path d="M28 36 C35 34 65 34 72 36" stroke="%23ff2a55" stroke-width="3" fill="none"/><rect x="30" y="47" width="17" height="10" rx="3" fill="%23111" stroke="%23fff" stroke-width="1.5"/><rect x="53" y="47" width="17" height="10" rx="3" fill="%23111" stroke="%23fff" stroke-width="1.5"/><line x1="47" y1="50" x2="53" y2="50" stroke="%23fff" stroke-width="2"/><polygon points="50,68 35,95 65,95" fill="%23ffffff"/><polygon points="50,75 42,95 58,95" fill="%23000000"/><circle cx="50" cy="74" r="3" fill="%23ff2a55"/></svg>`
  },
  {
    id: 'cyber',
    name: 'Cyber Hacker',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23050a0a" rx="20"/><circle cx="50" cy="45" r="24" fill="%230f1717" stroke="%2300e5ff" stroke-width="2"/><path d="M30 42 C35 39 65 39 70 42 L68 52 C60 55 40 55 32 52 Z" fill="%2300e5ff"/><line x1="20" y1="75" x2="80" y2="75" stroke="%2300e5ff" stroke-width="1" stroke-dasharray="3,3"/><path d="M25 90 C25 72 75 72 75 90 Z" fill="%230a1919" stroke="%2300e5ff" stroke-width="1.5"/><circle cx="50" cy="47" r="2" fill="%23fff"/></svg>`
  },
  {
    id: 'gold',
    name: 'Golden Eye',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23121006" rx="20"/><circle cx="50" cy="50" r="32" fill="none" stroke="%23ffe600" stroke-width="2" stroke-dasharray="6,4"/><circle cx="50" cy="50" r="20" fill="%231c1808" stroke="%23ffe600" stroke-width="3"/><circle cx="50" cy="50" r="10" fill="%23ffe600"/><circle cx="47" cy="47" r="3" fill="%23ffffff"/><line x1="12" y1="50" x2="88" y2="50" stroke="%23ffe600" stroke-width="1.5"/><line x1="50" y1="12" x2="50" y2="88" stroke="%23ffe600" stroke-width="1.5"/></svg>`
  },
  {
    id: 'ninja',
    name: 'Phantom Shadow',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230e0a14" rx="20"/><path d="M22 90 C22 30 78 30 78 90 Z" fill="%23191224" stroke="%23a855f7" stroke-width="2"/><path d="M32 46 C35 43 65 43 68 46 L66 56 C60 58 40 58 34 56 Z" fill="%2307050a"/><polygon points="36,50 44,48 43,52" fill="%23a855f7"/><polygon points="64,50 56,48 57,52" fill="%23a855f7"/><circle cx="40" cy="50" r="1.5" fill="%23fff"/><circle cx="60" cy="50" r="1.5" fill="%23fff"/></svg>`
  },
  {
    id: 'dj',
    name: 'Covert DJ',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230a120d" rx="20"/><path d="M25 45 A 25 25 0 0 1 75 45" fill="none" stroke="%2310b981" stroke-width="5" stroke-linecap="round"/><rect x="20" y="40" width="10" height="22" rx="5" fill="%2310b981"/><rect x="70" y="40" width="10" height="22" rx="5" fill="%2310b981"/><circle cx="50" cy="50" r="18" fill="%23122419"/><path d="M37 50 L42 46 L47 54 L52 45 L57 53 L63 50" fill="none" stroke="%2310b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'viper',
    name: 'Viper Spec-Ops',
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23120c08" rx="20"/><polygon points="50,22 76,36 76,68 50,86 24,68 24,36" fill="%231f1610" stroke="%23ff6b00" stroke-width="2.5"/><line x1="32" y1="48" x2="68" y2="48" stroke="%23ff6b00" stroke-width="3"/><line x1="38" y1="56" x2="62" y2="56" stroke="%23ff6b00" stroke-width="2"/><circle cx="50" cy="48" r="4" fill="%23ffffff"/><circle cx="50" cy="48" r="8" fill="none" stroke="%23ff6b00" stroke-width="1.5" stroke-dasharray="2,2"/></svg>`
  }
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  accentColor,
  themeMode,
  onUpdateAccentColor,
  onToggleThemeMode,
  onUpdateAvatar,
  onLogout,
  onOpenAuth,
  onPlayTrack,
}) => {
  const [stats, setStats] = useState<UserStats>({ total_played: 0, favorite_count: 0, top_artist: null });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Supabase Cloud State
  const [supabaseConfig, setSupabaseConfig] = useState(getStoredSupabaseConfig());
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string | null>(null);

  const loadUserData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        invoke<UserStats>('db_get_stats', { userId: currentUser.id }),
        invoke<HistoryItem[]>('db_get_history', { userId: currentUser.id, limit: 30 }),
      ]);
      setStats(s);
      setHistory(h);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [currentUser]);

  // Handle image upload from computer: resize to 256x256 Base64 JPEG
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minSide = Math.min(img.width, img.height);
          const startX = (img.width - minSide) / 2;
          const startY = (img.height - minSide) / 2;
          ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, 256, 256);
          const base64Jpeg = canvas.toDataURL('image/jpeg', 0.85);
          onUpdateAvatar(base64Jpeg);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearAvatar = () => {
    onUpdateAvatar('');
  };

  // ──────────────── SUPABASE CLOUD SYNC ACTIONS ────────────────
  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSupabaseConfig(supabaseConfig.url, supabaseConfig.anonKey);
    setCloudStatusMsg('Đã lưu cấu hình Supabase Cloud!');
    setTimeout(() => setCloudStatusMsg(null), 3000);
  };

  const handleTriggerCloudSync = async () => {
    if (!currentUser) {
      alert('Vui lòng đăng nhập tài khoản trước khi đồng bộ Cloud.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setShowSupabaseSettings(true);
      alert('Vui lòng nhập Supabase Project URL và Anon Key bên dưới để bắt đầu đồng bộ.');
      return;
    }

    setIsCloudSyncing(true);
    setCloudStatusMsg('Đang đồng bộ dữ liệu với Supabase Cloud...');

    try {
      // 1. Pull data from Cloud first
      const cloudData = await cloudSyncPull(currentUser.id);
      if (cloudData) {
        if (cloudData.albums && cloudData.albums.length > 0) {
          localStorage.setItem('spytify_user_albums', JSON.stringify(cloudData.albums));
        }
        if (cloudData.avatar && !currentUser.avatar) {
          onUpdateAvatar(cloudData.avatar);
        }
        if (cloudData.accentColor && cloudData.accentColor !== accentColor) {
          onUpdateAccentColor(cloudData.accentColor);
        }
      }

      // 2. Push current local state to Cloud
      const storedAlbums = localStorage.getItem('spytify_user_albums');
      const localAlbums = storedAlbums ? JSON.parse(storedAlbums) : [];
      await cloudSyncPush(currentUser.id, {
        albums: localAlbums,
        avatar: currentUser.avatar || '',
        accentColor: accentColor,
        themeMode: themeMode,
      });

      setCloudStatusMsg('Đồng bộ Cloud thành công 100%!');
      setTimeout(() => setCloudStatusMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setCloudStatusMsg('Lỗi khi đồng bộ Cloud.');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const applyBackupContent = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.albums && Array.isArray(data.albums)) {
        localStorage.setItem('spytify_user_albums', JSON.stringify(data.albums));
      }
      if (data.avatar) {
        onUpdateAvatar(data.avatar);
      }
      if (data.accentColor) {
        onUpdateAccentColor(data.accentColor);
      }
      if (data.themeMode && data.themeMode !== themeMode) {
        onToggleThemeMode();
      }
      alert('Đã khôi phục hồ sơ và Album Spytify thành công từ tệp sao lưu!');
      window.location.reload();
    } catch (err) {
      alert('Tệp sao lưu không hợp lệ hoặc sai định dạng JSON: ' + err);
    }
  };

  // Cross-Device Backup: Export Vault to JSON using Native Windows Dialog
  const handleExportBackup = async () => {
    try {
      const storedAlbums = localStorage.getItem('spytify_user_albums');
      const albumsData = storedAlbums ? JSON.parse(storedAlbums) : [];
      const backupData = {
        app: 'Spytify',
        version: '1.0',
        exported_at: new Date().toISOString(),
        user: currentUser,
        avatar: currentUser?.avatar || localStorage.getItem('spytify_guest_avatar') || '',
        accentColor: accentColor,
        themeMode: themeMode,
        albums: albumsData,
        history: history,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);

      // 1. Try Native Tauri save file dialog
      try {
        const filePath = await save({
          filters: [{ name: 'Spytify Backup Vault', extensions: ['json'] }],
          defaultPath: `spytify_vault_${currentUser?.username || 'agent'}_backup.json`,
        });
        if (filePath) {
          await invoke('save_text_file', { path: filePath, content: jsonStr });
          alert('Đã lưu tệp sao lưu thành công tại:\n' + filePath);
          return;
        }
      } catch (nativeErr) {
        console.warn('Native save dialog fallback:', nativeErr);
      }

      // 2. Browser DOM fallback
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spytify_vault_${currentUser?.username || 'agent'}_backup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Lỗi xuất tệp sao lưu: ' + err);
    }
  };

  // Cross-Device Backup: Import Vault from JSON using Native Windows Dialog
  const handleNativeImportBackup = async () => {
    try {
      let content = '';
      try {
        const selected = await open({
          multiple: false,
          filters: [{ name: 'Spytify Backup Vault', extensions: ['json'] }],
        });
        if (selected && typeof selected === 'string') {
          content = await invoke<string>('read_text_file', { path: selected });
        }
      } catch (nativeErr) {
        console.warn('Native open dialog fallback:', nativeErr);
      }

      if (content) {
        applyBackupContent(content);
        return;
      }

      // Fallback to HTML input
      backupInputRef.current?.click();
    } catch (err) {
      console.error('Failed to import backup:', err);
      backupInputRef.current?.click();
    }
  };

  const handleHtmlFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      applyBackupContent(event.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto select-none space-y-8">
      {/* Hidden File Inputs */}
      <input 
        ref={fileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleImageFileChange} 
        className="hidden" 
      />
      <input 
        ref={backupInputRef} 
        type="file" 
        accept=".json" 
        onChange={handleHtmlFileChange} 
        className="hidden" 
      />

      {/* Profile Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#141418]">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div 
              className="w-20 h-20 rounded-2xl overflow-hidden border border-white/20 flex items-center justify-center text-black font-black text-3xl shadow-lg transition-transform group-hover:scale-105"
              style={{ 
                background: currentUser?.avatar ? 'transparent' : `linear-gradient(135deg, ${accentColor} 0%, #ffffff 100%)`,
                boxShadow: `0 0 20px ${accentColor}40`
              }}
            >
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser ? currentUser.display_name.charAt(0).toUpperCase() : 'S'}</span>
              )}
            </div>

            {/* Hover overlay to change avatar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Tải ảnh mới từ máy tính"
              className="absolute inset-0 bg-black/70 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer border border-white/40"
            >
              <Camera className="w-5 h-5 mb-1" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Đổi ảnh</span>
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {currentUser ? currentUser.display_name : 'Khách Đặc Nhiệm'}
              </h2>
              <span 
                className="text-[10px] px-2.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider border"
                style={{ 
                  color: accentColor, 
                  backgroundColor: `${accentColor}15`,
                  borderColor: `${accentColor}40` 
                }}
              >
                {currentUser ? 'SQLite Sync' : 'Chế độ Khách'}
              </span>
            </div>
            <p className="text-xs text-[#8e8e9f] font-mono mt-1">
              {currentUser ? `@${currentUser.username}` : 'Đăng nhập để đồng bộ dữ liệu nghe nhạc & playlist cá nhân'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentUser ? (
            <>
              <button
                onClick={loadUserData}
                title="Làm mới thống kê"
                className="p-2.5 rounded-xl bg-[#0e0e12] hover:bg-[#181820] text-[#777] hover:text-white border border-[#1a1a22] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2.5 rounded-xl bg-[#0e0e12] hover:bg-red-500/10 text-[#888] hover:text-red-400 border border-[#1a1a22] hover:border-red-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="py-2.5 px-6 font-bold uppercase tracking-wider text-xs rounded-xl text-black transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
              style={{ 
                backgroundColor: accentColor, 
                color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
                boxShadow: `0 0 15px ${accentColor}50` 
              }}
            >
              Đăng nhập / Đăng ký
            </button>
          )}
        </div>
      </div>

      {/* ──────────────── CÁ NHÂN HÓA GIAO DIỆN (PERSONALIZATION) ──────────────── */}
      <div className="space-y-6 bg-[#08080b] border border-[#181822] rounded-2xl p-6">
        <div className="flex items-center justify-between border-b border-[#141418] pb-4">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5" style={{ color: accentColor }} />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Cá nhân hóa giao diện (Spy Customization)
              </h3>
              <p className="text-[11px] text-[#777] mt-0.5">
                Tùy chỉnh chế độ sáng/tối, màu sắc chủ đạo và ảnh đại diện đặc nhiệm (Lưu trữ 100% nội bộ SQLite & Local)
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#101018] text-[#888] font-mono border border-[#222]">
            Offline 100%
          </span>
        </div>

        {/* 0. Light / Dark Mode Toggle */}
        <div>
          <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
            <Sun className="w-3.5 h-3.5" style={{ color: accentColor }} />
            Chế độ hiển thị (Display Theme Mode)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => themeMode === 'light' && onToggleThemeMode()}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                themeMode === 'dark'
                  ? 'bg-[#15151e] border-white shadow-[0_0_12px_rgba(255,255,255,0.15)] scale-[1.01]'
                  : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#333] hover:bg-[#121218]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#000000] border border-[#333] flex items-center justify-center text-white">
                <Moon className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white">🌙 Điệp vụ Ban đêm (Dark Stealth)</p>
                <p className="text-[10px] text-[#777] font-mono">Nền đen huyền bí, bảo vệ mắt khi nghe nhạc đêm</p>
              </div>
            </button>

            <button
              onClick={() => themeMode === 'dark' && onToggleThemeMode()}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3.5 transition-all cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-white border-black text-black shadow-[0_0_12px_rgba(0,0,0,0.1)] scale-[1.01]'
                  : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#333] hover:bg-[#121218]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-[#ccc] flex items-center justify-center text-black">
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white">☀️ Hồ sơ Mật Ban ngày (Light Dossier)</p>
                <p className="text-[10px] text-[#777] font-mono">Giao diện giấy hồ sơ tình báo trang nhã, sắc nét</p>
              </div>
            </button>
          </div>
        </div>

        {/* 1. Theme Accent Color Picker */}
        <div className="pt-4 border-t border-[#141418]">
          <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
            Tông màu chủ đạo (Accent Color)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEME_PALETTE.map((theme) => {
              const isSelected = accentColor.toUpperCase() === theme.hex.toUpperCase();
              return (
                <button
                  key={theme.hex}
                  onClick={() => onUpdateAccentColor(theme.hex)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-[#15151e] border-white shadow-[0_0_12px_rgba(255,255,255,0.15)] scale-[1.02]' 
                      : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#333] hover:bg-[#121218]'
                  }`}
                >
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: theme.hex }}
                  >
                    {isSelected && (
                      <Check className={`w-4 h-4 ${theme.hex === '#FFFFFF' ? 'text-black' : 'text-white'}`} />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">{theme.name}</p>
                    <p className="text-[10px] text-[#777] truncate font-mono">{theme.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Hex Color Picker */}
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-[#0c0c10] border border-[#1b1b24]">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => onUpdateAccentColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 outline-none"
              title="Chọn màu tùy biến bất kỳ"
            />
            <div className="flex-1">
              <p className="text-xs font-semibold text-white">Tùy chọn mã màu tùy biến</p>
              <p className="text-[10px] text-[#777] font-mono">Bấm vào ô màu để chọn tự do theo sở thích cá nhân</p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#161620] border border-[#262634] text-white">
              {accentColor.toUpperCase()}
            </span>
          </div>
        </div>

        {/* 2. Avatar Customization */}
        <div className="pt-4 border-t border-[#141418]">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Ảnh đại diện (Avatar Đặc Nhiệm)
            </label>
            {currentUser?.avatar && (
              <button
                onClick={handleClearAvatar}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa ảnh & dùng ký tự mặc định</span>
              </button>
            )}
          </div>

          {/* Upload Button */}
          <div className="mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-[#2b2b3a] hover:border-white/50 bg-[#0c0c10] hover:bg-[#121218] transition-all flex items-center justify-center gap-2.5 text-xs font-semibold text-white cursor-pointer group"
            >
              <Upload className="w-4 h-4 text-[#888] group-hover:text-white transition-colors" />
              <span>Tải ảnh từ máy tính (Tự động nén 256x256 & lưu SQLite)</span>
            </button>
          </div>

          {/* Preset Secret Agent Avatars */}
          <div>
            <p className="text-[11px] text-[#777] font-mono mb-2">Hoặc chọn nhanh từ bộ sưu tập Đặc nhiệm Spytify:</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {SPY_AVATARS.map((preset) => {
                const isSelected = currentUser?.avatar === preset.svg;
                return (
                  <button
                    key={preset.id}
                    onClick={() => onUpdateAvatar(preset.svg)}
                    title={preset.name}
                    className={`p-2 rounded-xl border text-center flex flex-col items-center gap-2 transition-all cursor-pointer group ${
                      isSelected 
                        ? 'bg-[#181824] border-white shadow-[0_0_12px_rgba(255,255,255,0.2)] scale-105' 
                        : 'bg-[#0d0d12] border-[#1e1e28] hover:border-[#38384a] hover:bg-[#13131b]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#252535] group-hover:border-white/40 transition-colors">
                      <img src={preset.svg} alt={preset.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-bold text-[#aaa] group-hover:text-white truncate w-full">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Supabase Cloud Sync Hub */}
        <div className="pt-4 border-t border-[#141418]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Cloud className="w-3.5 h-3.5" style={{ color: accentColor }} />
                Đồng bộ Đám mây Supabase (Cross-Device Cloud Sync)
              </label>
              <p className="text-[11px] text-[#777] mt-0.5">
                Tự động đồng bộ Album, Bài hát yêu thích và Avatar qua máy khác theo thời gian thực (Miễn phí 100%)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono border ${
                isSupabaseConfigured() 
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {isSupabaseConfigured() ? '🟢 Cloud Ready' : '⚪ Chưa kết nối'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleTriggerCloudSync}
              disabled={isCloudSyncing}
              className="py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-md transition-transform hover:scale-105 disabled:opacity-50"
              style={{
                backgroundColor: accentColor,
                color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
              }}
            >
              <CloudLightning className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span>{isCloudSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Cloud ngay'}</span>
            </button>

            <button
              onClick={() => setShowSupabaseSettings(p => !p)}
              className="py-2.5 px-3 rounded-xl bg-[#0c0c12] hover:bg-[#15151e] border border-[#222230] text-xs font-semibold text-[#aaa] hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Cài đặt khóa Supabase</span>
              {showSupabaseSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {cloudStatusMsg && (
            <p className="text-[11px] font-mono text-emerald-400 mb-3 animate-pulse">
              {cloudStatusMsg}
            </p>
          )}

          {/* Collapsible Supabase Key Inputs */}
          {showSupabaseSettings && (
            <form onSubmit={handleSaveSupabase} className="p-4 rounded-xl bg-[#0c0c12] border border-[#1e1e28] space-y-3 mb-3 animate-in fade-in duration-200">
              <div>
                <label className="text-[11px] font-mono text-[#888] block mb-1">
                  Supabase Project URL (ví dụ: https://xyzcompany.supabase.co)
                </label>
                <input
                  type="text"
                  placeholder="https://your-project.supabase.co"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full py-2 px-3 rounded-lg bg-[#070709] border border-[#262634] text-xs text-white outline-none focus:border-white/50 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-[#888] block mb-1">
                  Supabase Anon Public API Key (eyJhbGciOi...)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={supabaseConfig.anonKey}
                  onChange={(e) => setSupabaseConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                  className="w-full py-2 px-3 rounded-lg bg-[#070709] border border-[#262634] text-xs text-white outline-none focus:border-white/50 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-[#666] font-mono">
                  File schema SQL khởi tạo nằm tại <code className="text-white">supabase/schema.sql</code>
                </p>
                <button
                  type="submit"
                  className="py-1.5 px-4 rounded-lg bg-white text-black font-bold text-xs hover:bg-[#ddd] transition-colors cursor-pointer"
                >
                  Lưu cấu hình
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 4. Cross-Device Vault Sync & Backup */}
        <div className="pt-4 border-t border-[#141418]">
          <div className="mb-3">
            <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Database className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Sao lưu két sắt thủ công (.json)
            </label>
            <p className="text-[11px] text-[#777] mt-1">
              Bạn cũng có thể xuất tệp sao lưu JSON để chuyển qua máy khác hoàn toàn ngoại tuyến không cần mạng:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExportBackup}
              className="p-3.5 rounded-xl border border-[#222230] bg-[#0c0c12] hover:bg-[#14141c] hover:border-white/40 flex items-center gap-3 transition-all cursor-pointer group"
            >
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                <Download className="w-4 h-4" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-bold text-white group-hover:text-white transition-colors">
                  Xuất tệp sao lưu (.json)
                </p>
                <p className="text-[10px] text-[#777] font-mono">Tải về két sắt Album, Avatar, Yêu thích</p>
              </div>
            </button>

            <button
              onClick={handleNativeImportBackup}
              className="p-3.5 rounded-xl border border-[#222230] bg-[#0c0c12] hover:bg-[#14141c] hover:border-white/40 flex items-center gap-3 transition-all cursor-pointer group"
            >
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                <HardDriveDownload className="w-4 h-4" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-xs font-bold text-white group-hover:text-white transition-colors">
                  Nạp bản sao lưu vào máy này
                </p>
                <p className="text-[10px] text-[#777] font-mono">Khôi phục toàn bộ dữ liệu từ máy cũ</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────── THỐNG KÊ NGHE NHẠC (STATS GRID) ──────────────── */}
      {currentUser && (
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
            <Disc className="w-3.5 h-3.5" style={{ color: accentColor }} />
            Thống kê tài khoản
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#161620] flex items-center gap-3.5">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#222]"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-[#777] font-mono uppercase">Tổng lượt nghe</p>
                <p className="text-lg font-bold text-white mt-0.5">{stats.total_played}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#161620] flex items-center gap-3.5">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#222]"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-[#777] font-mono uppercase">Bài hát yêu thích</p>
                <p className="text-lg font-bold text-white mt-0.5">{stats.favorite_count}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0a0d] border border-[#161620] flex items-center gap-3.5">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center border border-[#222]"
                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
              >
                <Disc className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] text-[#777] font-mono uppercase">Nghệ sĩ nghe nhiều nhất</p>
                <p className="text-sm font-bold text-white mt-0.5 truncate">{stats.top_artist || 'Chưa xác định'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── LỊCH SỬ PHÁT GẦN ĐÂY ──────────────── */}
      {currentUser && (
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5" style={{ color: accentColor }} />
            Lịch sử phát gần đây (Bấm để phát lại)
          </h3>

          {history.length === 0 ? (
            <div className="text-center py-8 text-[#555] text-xs">Chưa có lịch sử phát nhạc.</div>
          ) : (
            <div className="space-y-1">
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (h.track_json) {
                      try {
                        const parsed = JSON.parse(h.track_json);
                        onPlayTrack(parsed);
                        return;
                      } catch {}
                    }

                    let pathOrUrl = h.path_or_url || h.track_id;
                    if (h.source === 'youtube') {
                      let vid = pathOrUrl;
                      if (vid.startsWith('yt_')) vid = vid.replace('yt_', '');
                      pathOrUrl = vid;
                    }

                    onPlayTrack({
                      id: h.track_id,
                      title: h.track_title,
                      artist: h.artist,
                      album: 'History Track',
                      duration_secs: h.duration_secs,
                      path_or_url: pathOrUrl,
                      source: (h.source as any) || 'youtube',
                    });
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#09090c] hover:bg-[#121218] border border-[#161620] cursor-pointer group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded bg-[#14141c] flex items-center justify-center text-[#555] overflow-hidden flex-shrink-0">
                      <Music className="w-4 h-4" style={{ color: accentColor }} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-white transition-colors">
                        {h.track_title}
                      </p>
                      <p className="text-[11px] text-[#777] truncate">{h.artist}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#555] font-mono flex-shrink-0">
                    {h.listened_at ? new Date(h.listened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
