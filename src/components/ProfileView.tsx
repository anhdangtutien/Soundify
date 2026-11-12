import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { User, UserStats, HistoryItem, Track } from '../types';
import { 
  User as UserIcon, LogOut, Clock, Heart, Headphones, 
  Flame, Music, Sparkles, RefreshCw, Disc
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  onPlayTrack: (track: Track) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onLogout,
  onOpenAuth,
  onPlayTrack,
}) => {
  const [stats, setStats] = useState<UserStats>({ total_played: 0, favorite_count: 0, top_artist: null });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUserData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        invoke<UserStats>('db_get_stats', { userId: currentUser.id }),
        invoke<HistoryItem[]>('db_get_history', { userId: currentUser.id, limit: 20 }),
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

  if (!currentUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#0e0e0e] border border-[#1e1e1e] flex items-center justify-center text-[#555] mb-4">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Chưa đăng nhập tài khoản</h2>
        <p className="text-xs text-[#666] max-w-sm mb-6">
          Đăng nhập để tự động đồng bộ bài hát yêu thích, lưu trữ lịch sử nghe nhạc và chuẩn bị cho hệ thống AI gợi ý theo gu cá nhân.
        </p>
        <button
          onClick={onOpenAuth}
          className="py-2.5 px-6 bg-gradient-to-r from-[#ffe600] to-[#00e5ff] hover:opacity-95 text-black text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-[0_0_12px_rgba(255,230,0,0.35)]"
        >
          Đăng nhập / Đăng ký
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#141416] mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ffe600] to-[#00e5ff] border border-white/20 flex items-center justify-center text-black font-black text-2xl shadow-[0_0_15px_rgba(255,230,0,0.3)]">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.display_name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              currentUser.display_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white tracking-tight">{currentUser.display_name}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a1910] border border-[#ffe600]/40 text-[#ffe600] font-mono font-bold shadow-[0_0_6px_rgba(255,230,0,0.15)]">
                HI-FI HERO MEMBER
              </span>
            </div>
            <p className="text-xs text-[#00e5ff] font-mono mt-0.5">@{currentUser.username} • SQLite Profile Active</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUserData}
            title="Làm mới thống kê"
            className="p-2 rounded-lg bg-[#0e0e0e] hover:bg-[#181818] text-[#777] hover:text-[#ffe600] border border-[#1a1a1a] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-lg bg-[#0e0e0e] hover:bg-red-500/10 text-[#888] hover:text-red-400 border border-[#1a1a1a] hover:border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Stats Cards — Invincible Hero Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <div className="p-4 rounded-xl bg-[#0a0a0c] border border-[#1a1a20]">
          <div className="flex items-center justify-between text-[#777] text-xs font-mono uppercase mb-2">
            <span>Tổng lượt nghe</span>
            <Headphones className="w-4 h-4 text-[#ffe600]" />
          </div>
          <span className="text-2xl font-black text-white font-mono">{stats.total_played}</span>
          <p className="text-[11px] text-[#555] mt-1">Lưu trữ trên spytify.db</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0a0c] border border-[#1a1a20]">
          <div className="flex items-center justify-between text-[#777] text-xs font-mono uppercase mb-2">
            <span>Bài hát yêu thích</span>
            <Heart className="w-4 h-4 text-[#ffe600] fill-current" />
          </div>
          <span className="text-2xl font-black text-white font-mono">{stats.favorite_count}</span>
          <p className="text-[11px] text-[#555] mt-1">Đồng bộ theo tài khoản</p>
        </div>

        <div className="p-4 rounded-xl bg-[#0a0a0c] border border-[#1a1a20]">
          <div className="flex items-center justify-between text-[#777] text-xs font-mono uppercase mb-2">
            <span>Nghệ sĩ nghe nhiều nhất</span>
            <Flame className="w-4 h-4 text-[#00e5ff]" />
          </div>
          <span className="text-lg font-black text-white truncate block">
            {stats.top_artist || 'Chưa xác định'}
          </span>
          <p className="text-[11px] text-[#555] mt-1">Dữ liệu cho AI tự học gu nhạc</p>
        </div>
      </div>

      {/* Playback History */}
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-[#141414] pb-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#00e5ff]" />
            Lịch sử nghe nhạc gần đây
          </h3>
          <span className="text-xs text-[#555] font-mono">{history.length} bài hát</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 text-xs text-[#555]">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <span>Chưa có lịch sử nghe nhạc. Hãy bật một bài hát để bắt đầu ghi nhận!</span>
          </div>
        ) : (
          <div className="divide-y divide-[#0f0f0f]">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onPlayTrack({
                    id: item.track_id,
                    title: item.track_title,
                    artist: item.artist,
                    album: 'History',
                    duration_secs: item.duration_secs,
                    path_or_url: item.track_id,
                    source: item.source as any,
                  });
                }}
                className="py-2.5 px-3 flex items-center justify-between hover:bg-[#0c0c0c] rounded-lg transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#141414] border border-[#202020] flex items-center justify-center text-[#555] flex-shrink-0 group-hover:text-white transition-colors">
                    <Disc className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#00e5ff] transition-colors">
                      {item.track_title}
                    </h4>
                    <p className="text-[11px] text-[#666]">{item.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-[#555]">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#121212] uppercase border border-[#222]">
                    {item.source}
                  </span>
                  <span>{item.listened_at.split(' ')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
