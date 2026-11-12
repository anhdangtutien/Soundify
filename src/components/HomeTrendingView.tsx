import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Flame, Play, Disc, Sparkles, TrendingUp, Music, 
  Crown, Loader2, RefreshCw, Compass
} from 'lucide-react';
import { SearchResult, Track } from '../types';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { getContrastTextColor } from '../utils/trackUtils';

interface HomeTrendingViewProps {
  onPlaySearchResult: (result: SearchResult) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  accentColor?: string;
}

interface CategoryFilter {
  id: string;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryFilter[] = [
  { id: 'usuk', label: 'Billboard US/UK Hot 100', icon: '🌍' },
  { id: 'kpop_jpop', label: 'J-Pop & K-Pop Thịnh Hành', icon: '🎌' },
  { id: 'vpop', label: 'V-Pop Đỉnh Chóp', icon: '🇻🇳' },
  { id: 'audius', label: 'Audius 320K Charts', icon: '⚡' },
  { id: 'all', label: 'Tổng Hợp Top Hits', icon: '🔥' },
  { id: 'lofi', label: 'Lo-Fi Chillout', icon: '☕' },
];

// Curated Top Hits prioritized: US/UK -> J-Pop/K-Pop -> Vietnam
const INITIAL_CURATED_HITS: SearchResult[] = [
  {
    title: 'Die With A Smile',
    artist: 'Lady Gaga & Bruno Mars',
    album: 'Billboard Hot 100 #1',
    duration_secs: 251,
    source: 'youtube',
    url_or_id: 'kPa7bsKwL-8',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'APT. (feat. Bruno Mars)',
    artist: 'ROSÉ & Bruno Mars',
    album: 'Global Viral Sensation',
    duration_secs: 173,
    source: 'youtube',
    url_or_id: 'ekr2nIex040',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    album: 'Short n\' Sweet (Global Top 10)',
    duration_secs: 175,
    source: 'youtube',
    url_or_id: 'eVli-tstM5E',
    thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Birds of a Feather',
    artist: 'Billie Eilish',
    album: 'Hit Me Hard and Soft',
    duration_secs: 196,
    source: 'youtube',
    url_or_id: 'V9PVRfjEBTI',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Bling-Bang-Bang-Born',
    artist: 'Creepy Nuts',
    album: 'J-Pop Global Phenomenon',
    duration_secs: 172,
    source: 'youtube',
    url_or_id: 'mLW35YMz1eo',
    thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Idol (アイドル)',
    artist: 'YOASOBI',
    album: 'Oshi no Ko / J-Pop All-Kill',
    duration_secs: 213,
    source: 'youtube',
    url_or_id: 'ZRtdQ81jPUQ',
    thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Supernova',
    artist: 'aespa',
    album: 'Armageddon - K-Pop Smash',
    duration_secs: 178,
    source: 'youtube',
    url_or_id: 'phuiAIQAx40',
    thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Magnetic',
    artist: 'ILLIT',
    album: 'SUPER REAL ME',
    duration_secs: 160,
    source: 'youtube',
    url_or_id: 'Vk5-c_v4gMU',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Đừng Làm Trái Tim Anh Đau',
    artist: 'Sơn Tùng M-TP',
    album: 'V-Pop Quán Quân 2024 - 2025',
    duration_secs: 326,
    source: 'youtube',
    url_or_id: 'abPmZCZZrFA',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Từng Quen',
    artist: 'Wren Evans',
    album: 'Loi Choi - The New V-Pop Wave',
    duration_secs: 174,
    source: 'youtube',
    url_or_id: 'Vq9sX8j7mI4',
    thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Standing Next to You',
    artist: 'Jung Kook',
    album: 'GOLDEN (Global Sensation)',
    duration_secs: 206,
    source: 'youtube',
    url_or_id: 'UNo0TGZuv4w',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Night Dancer',
    artist: 'imase',
    album: 'Viral J-Pop Anthem',
    duration_secs: 210,
    source: 'youtube',
    url_or_id: 'kFCOg7p_b6k',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Gặp Lại Năm Ta 60',
    artist: 'Orange',
    album: 'Cam\'On - Vietnamese Soul',
    duration_secs: 236,
    source: 'youtube',
    url_or_id: 'XWn1kFp1v64',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Cruel Summer',
    artist: 'Taylor Swift',
    album: 'Lover (The Eras Tour Live)',
    duration_secs: 178,
    source: 'youtube',
    url_or_id: 'ic8j13piAhQ',
    thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
  },
];

export const HomeTrendingView: React.FC<HomeTrendingViewProps> = ({
  onPlaySearchResult,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  accentColor = '#ff2a55',
}) => {
  const [trendingTracks, setTrendingTracks] = useState<SearchResult[]>(INITIAL_CURATED_HITS);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('usuk');

  const fetchTrending = async (category: string) => {
    setLoading(true);
    try {
      const results = await invoke<SearchResult[]>('get_trending_hits', { category });
      if (results && results.length > 0) {
        setTrendingTracks(results);
      }
    } catch (err) {
      console.error('Failed to fetch trending hits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending(activeCategory);
  }, [activeCategory]);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0 || secs > 86400) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'youtube':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-[#ff4e6b] border border-[#ff2a55]/30 flex items-center gap-1 font-mono">
            <YoutubeIcon className="w-2.5 h-2.5" />YT HI-FI
          </span>
        );
      case 'soundcloud':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-orange-400 border border-orange-500/30 flex items-center gap-1 font-mono">
            <SoundCloudIcon className="w-2.5 h-2.5" />SC
          </span>
        );
      case 'audius':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-white border border-white/20 flex items-center gap-1 font-mono">
            <AudiusIcon className="w-2.5 h-2.5 text-[#ff2a55]" />AUDIUS
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-white border border-white/20 font-mono">
            LOSSLESS
          </span>
        );
    }
  };

  const featured = trendingTracks[0] || INITIAL_CURATED_HITS[0];
  const top10 = trendingTracks.slice(0, 10);
  const remaining = trendingTracks.slice(10);

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-7 max-w-7xl mx-auto select-none">
      {/* ─── HERO SPOTLIGHT (BILLBOARD HOT #1 / FEATURED TRACK) ──────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-black border border-[#1c1c24] p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="z-10 max-w-xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#ff2a55]/20 text-[#ff2a55] border border-[#ff2a55]/40 text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Crown className="w-3 h-3 text-[#ff2a55]" />
              BẢNG XẾP HẠNG TOÀN CẦU #1
            </span>
            <span className="text-xs text-[#8e8e9f] font-mono">Top Trending Stream</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {featured.title}
          </h1>

          <p className="text-sm font-medium text-[#a0a0b2]">
            {featured.artist} • <span className="text-white font-mono">{featured.album || 'Billboard Spotlight'}</span>
          </p>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => onPlaySearchResult(featured)}
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
                boxShadow: `0 0 16px ${accentColor}40`
              }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Phát ngay</span>
            </button>
            <span className="text-xs font-mono text-[#777]">{formatTime(featured.duration_secs)}</span>
          </div>
        </div>

        {/* Featured Cover Art */}
        <div
          onClick={() => onPlaySearchResult(featured)}
          className="relative w-44 h-44 lg:w-52 lg:h-52 rounded-2xl overflow-hidden border border-[#2a2a35] flex-shrink-0 cursor-pointer shadow-xl group"
        >
          {featured.thumbnail ? (
            <img
              src={featured.thumbnail}
              alt={featured.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-[#121218] flex items-center justify-center text-white">
              <Disc className="w-12 h-12" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            {getSourceBadge(featured.source)}
          </div>
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-[#ff2a55] text-white flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── CATEGORY FILTER PILLS ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-black font-bold shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                    : 'bg-[#0e0e12] text-[#888899] hover:text-white hover:bg-[#16161e] border border-[#1c1c24]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => fetchTrending(activeCategory)}
          disabled={loading}
          className="p-2 rounded-lg bg-[#0e0e12] hover:bg-[#16161e] text-[#888] hover:text-white border border-[#1e1e26] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ff2a55]' : ''}`} />
          <span className="hidden sm:inline">Cập nhật</span>
        </button>
      </div>

      {/* ─── TOP 10 LEADERBOARD CHART ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#161620] pb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ff2a55]" />
            Bảng xếp hạng hôm nay
          </h2>
          <span className="text-xs text-[#777] font-mono">Top 10 bài hát</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {top10.map((item, idx) => {
            const rank = idx + 1;
            const isRank1 = rank === 1;
            const isRank2 = rank === 2;
            const isRank3 = rank === 3;

            return (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item)}
                className="p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#ff2a55]/40 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* Rank Badge */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono flex-shrink-0 ${
                      isRank1
                        ? 'bg-[#ff2a55] text-white shadow-[0_0_8px_rgba(255,42,85,0.4)]'
                        : isRank2
                        ? 'bg-white text-black'
                        : isRank3
                        ? 'bg-[#252530] text-white'
                        : 'bg-[#14141a] text-[#777]'
                    }`}
                  >
                    {rank}
                  </div>

                  {/* Thumbnail with hover play */}
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#14141c] border border-[#222]">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white" />
                    </div>
                  </div>

                  {/* Song Info */}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate group-hover:text-[#ff2a55] transition-colors" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#8e8e9f] truncate font-mono mt-0.5">
                      {item.artist}
                    </p>
                  </div>
                </div>

                {/* Right metadata */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getSourceBadge(item.source)}
                  <span className="text-[11px] font-mono text-[#666]">{formatTime(item.duration_secs)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── TRENDING MOODS & GENRES ──────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#ff2a55]" />
          Bộ sưu tập thịnh hành
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: 'Billboard US/UK', desc: 'Lady Gaga, Bruno Mars, Sabrina', query: 'usuk' },
            { title: 'J-Pop & Anime Viral', desc: 'YOASOBI, Creepy Nuts, Fujii Kaze', query: 'kpop_jpop' },
            { title: 'K-Pop All-Kill', desc: 'ROSÉ, aespa, ILLIT, Jung Kook', query: 'kpop_jpop' },
            { title: 'V-Pop Quán Quân', desc: 'Sơn Tùng, Wren Evans, HIEUTHUHAI', query: 'vpop' },
            { title: 'Audius 320K Hi-Fi', desc: 'Lossless underground không giới hạn', query: 'audius' },
            { title: 'Covert Ops Beats', desc: 'Giai điệu mật vụ tập trung sâu', query: 'lofi' },
          ].map((col, idx) => (
            <button
              key={idx}
              onClick={() => setActiveCategory(col.query)}
              className="p-3.5 rounded-xl bg-[#0c0c10] hover:bg-[#14141a] border border-[#1a1a24] hover:border-[#ff2a55]/50 transition-all text-left flex flex-col justify-between h-28 group cursor-pointer shadow-sm"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-mono text-[#ff2a55] font-bold uppercase">CHỦ ĐỀ #{idx + 1}</span>
                <Play className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-[#ff2a55] transition-colors leading-tight">{col.title}</p>
                <p className="text-[10px] text-[#777] line-clamp-1 mt-0.5">{col.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── MORE TRENDING DISCOVERIES ────────────────────────────────────── */}
      {remaining.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-[#161620] pb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              Khám phá thêm
            </h2>
            <span className="text-xs text-[#777] font-mono">{remaining.length} bài hát</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {remaining.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item)}
                className="p-2.5 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#ff2a55]/30 transition-all flex flex-col group cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#14141c]">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <Music className="w-6 h-6" />
                    </div>
                  )}

                  <div className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-white hover:bg-[#ff2a55] hover:text-white text-black flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>

                  <div className="absolute top-1.5 left-1.5">
                    {getSourceBadge(item.source)}
                  </div>
                </div>

                <p className="text-xs font-bold text-white truncate group-hover:text-[#ff2a55] transition-colors" title={item.title}>
                  {item.title}
                </p>
                <p className="text-[11px] text-[#777] truncate font-mono mt-0.5">
                  {item.artist}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
