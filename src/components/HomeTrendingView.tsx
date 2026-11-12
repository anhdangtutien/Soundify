import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Flame, Play, Pause, Disc, Sparkles, TrendingUp, Music, 
  Crown, Radio, Loader2, RefreshCw, Heart, Compass, Volume2
} from 'lucide-react';
import { SearchResult, Track } from '../types';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';

interface HomeTrendingViewProps {
  onPlaySearchResult: (result: SearchResult) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
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
    album: 'Super Real Me (Viral Hits)',
    duration_secs: 160,
    source: 'youtube',
    url_or_id: 'Vk5-c_v4gMU',
    thumbnail: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Shinunoga E-Wa (死ぬのがいいわ)',
    artist: 'Fujii Kaze (藤井 風)',
    album: 'HELP EVER HURT NEVER',
    duration_secs: 185,
    source: 'youtube',
    url_or_id: 'dFf4AgBNR1E',
    thumbnail: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Đừng Làm Trái Tim Anh Đau',
    artist: 'Sơn Tùng M-TP',
    album: 'V-Pop Quán Quân Bảng Xếp Hạng',
    duration_secs: 312,
    source: 'youtube',
    url_or_id: 'abPmZCZZrFA',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Từng Quen',
    artist: 'Wren Evans, itsnk',
    album: 'Loi Choi - V-Pop Trending',
    duration_secs: 176,
    source: 'youtube',
    url_or_id: 'aT3v8iXbO8o',
    thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Ngủ Một Mình (Tình Rất Tình)',
    artist: 'HIEUTHUHAI, Negav',
    album: 'V-Pop Hit Banger',
    duration_secs: 228,
    source: 'youtube',
    url_or_id: 'fEHQ32Xg5vY',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
  },
  {
    title: 'Cyberpunk Hero 2077 (320kbps Hi-Fi)',
    artist: 'Invincible Electro Beats',
    album: 'Audius Global Open Stream',
    duration_secs: 245,
    source: 'audius',
    url_or_id: 'https://discoveryprovider.audius.co/v1/tracks/78a9c/stream?app_name=Spytify',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
  },
];

export const HomeTrendingView: React.FC<HomeTrendingViewProps> = ({
  onPlaySearchResult,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('usuk');
  const [trendingTracks, setTrendingTracks] = useState<SearchResult[]>(INITIAL_CURATED_HITS);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchTrending = async (cat: string) => {
    setLoading(true);
    try {
      const results = await invoke<SearchResult[]>('get_trending_hits', { category: cat });
      if (results && results.length > 0) {
        setTrendingTracks(results);
      }
    } catch (e) {
      console.warn('Fallback to curated trending hits:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending(activeCategory);
  }, [activeCategory]);

  const featured = trendingTracks[0] || INITIAL_CURATED_HITS[0];
  const top10 = trendingTracks.slice(0, 10);
  const remaining = trendingTracks.slice(10);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return '3:45';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSourceIcon = (src: string) => {
    switch (src) {
      case 'audius':
        return <AudiusIcon className="w-3 h-3 text-[#00e5ff]" />;
      case 'soundcloud':
        return <SoundCloudIcon className="w-3 h-3 text-orange-400" />;
      default:
        return <YoutubeIcon className="w-3 h-3 text-red-400" />;
    }
  };

  const getSourceBadge = (src: string) => {
    switch (src) {
      case 'audius':
        return (
          <span className="text-[9px] font-mono font-bold text-[#00e5ff] bg-[#0c1418] border border-[#00e5ff]/30 px-1.5 py-0.5 rounded flex items-center gap-1">
            <AudiusIcon className="w-2.5 h-2.5 text-[#00e5ff]" /> 320K
          </span>
        );
      case 'soundcloud':
        return (
          <span className="text-[9px] font-mono font-bold text-orange-400 bg-[#16120e] border border-orange-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
            <SoundCloudIcon className="w-2.5 h-2.5" /> SC
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-mono font-bold text-red-400 bg-[#180e0e] border border-red-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
            <YoutubeIcon className="w-2.5 h-2.5" /> YT HI-FI
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-6xl mx-auto space-y-8 select-none">
      {/* ─── HERO SPOTLIGHT BANNER — MINIMALIST GOLD & CYAN ───────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0d0d10] border border-[#1a1a22] p-7 flex flex-col md:flex-row items-center justify-between gap-6 group">
        <div className="flex-1 z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-[#181814] text-[#ffe600] border border-[#ffe600]/30 font-mono">
              #1 Thịnh hành
            </span>
            <span className="text-[11px] text-[#666]">
              Bảng xếp hạng toàn cầu
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight">
            {featured.title}
          </h1>

          <p className="text-xs text-[#888] flex items-center gap-2 font-mono">
            <span className="text-white font-medium">{featured.artist}</span>
            <span>•</span>
            <span>{featured.album}</span>
            <span>•</span>
            <span className="text-[#00e5ff]">{formatTime(featured.duration_secs)}</span>
          </p>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => onPlaySearchResult(featured)}
              className="px-5 py-2 rounded-lg bg-[#ffe600] hover:bg-[#00e5ff] text-black font-semibold text-xs tracking-wide flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>Phát ngay</span>
            </button>

            <button
              onClick={() => {
                if (trendingTracks.length > 0) {
                  onPlaySearchResult(trendingTracks[0]);
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#141418] hover:bg-[#1a1a20] text-[#ccc] hover:text-white border border-[#22222a] text-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#ffe600]" />
              <span>Phát tất cả</span>
            </button>
          </div>
        </div>

        {/* Featured Artwork Display */}
        <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-xl overflow-hidden flex-shrink-0 border border-[#22222a]">
          {featured.thumbnail ? (
            <img
              src={featured.thumbnail}
              alt={featured.title}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-[#121218] flex items-center justify-center text-[#ffe600]">
              <Disc className="w-12 h-12" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            {getSourceBadge(featured.source)}
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ffe600] to-[#00e5ff] text-black shadow-[0_0_12px_rgba(255,230,0,0.35)] font-black'
                    : 'bg-[#0d0d10] text-[#888] hover:text-white hover:bg-[#16161c] border border-[#1a1a24]'
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
          className="p-2 rounded-lg bg-[#0e0e12] hover:bg-[#181820] text-[#777] hover:text-[#ffe600] border border-[#1e1e28] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ffe600]' : ''}`} />
          <span className="hidden sm:inline">Cập nhật</span>
        </button>
      </div>

      {/* ─── TOP 10 LEADERBOARD CHART ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#161620] pb-2">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#ffe600]" />
            Bảng xếp hạng hôm nay
          </h2>
          <span className="text-xs text-[#666]">Top 10 bài hát</span>
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
                className="p-3 rounded-xl bg-[#0a0a0d] hover:bg-[#14141b] border border-[#161620] hover:border-[#ffe600]/40 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* Rank Badge */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs font-mono flex-shrink-0 ${
                      isRank1
                        ? 'bg-[#ffe600] text-black shadow-[0_0_8px_rgba(255,230,0,0.5)]'
                        : isRank2
                        ? 'bg-[#00e5ff] text-black shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                        : isRank3
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#181820] text-[#777]'
                    }`}
                  >
                    {rank}
                  </div>

                  {/* Thumbnail with hover play */}
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#16161e] border border-[#222]">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current text-[#ffe600]" />
                    </div>
                  </div>

                  {/* Song Info */}
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate group-hover:text-[#ffe600] transition-colors" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#888] truncate font-mono mt-0.5">
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
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00e5ff]" />
          Bộ sưu tập thịnh hành
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: 'Billboard US/UK', desc: 'Lady Gaga, Bruno Mars, Sabrina', query: 'usuk', color: 'from-[#ffe600]/25 to-[#ff9900]/20', border: 'hover:border-[#ffe600]' },
            { title: 'J-Pop & Anime Viral', desc: 'YOASOBI, Creepy Nuts, Fujii Kaze', query: 'kpop_jpop', color: 'from-[#00e5ff]/25 to-[#0077ff]/20', border: 'hover:border-[#00e5ff]' },
            { title: 'K-Pop All-Kill', desc: 'ROSÉ, aespa, ILLIT, Jung Kook', query: 'kpop_jpop', color: 'from-[#ff0088]/25 to-[#cc00ff]/20', border: 'hover:border-[#ff0088]' },
            { title: 'V-Pop Quán Quân', desc: 'Sơn Tùng, Wren Evans, HIEUTHUHAI', query: 'vpop', color: 'from-[#ffe600]/20 to-[#00e5ff]/20', border: 'hover:border-[#ffe600]' },
            { title: 'Audius 320K Hi-Fi', desc: 'Nhạc phi tập trung mở không giới hạn', query: 'audius', color: 'from-[#cc00ff]/20 to-[#6600ff]/20', border: 'hover:border-[#cc00ff]' },
            { title: 'Invincible Energy', desc: 'Giai điệu kích thích năng lượng cao', query: 'all', color: 'from-[#ffe600]/30 to-[#00e5ff]/30', border: 'hover:border-[#ffe600]' },
          ].map((col, idx) => (
            <button
              key={idx}
              onClick={() => setActiveCategory(col.query)}
              className={`p-3.5 rounded-xl bg-gradient-to-b ${col.color} bg-[#0c0c10] border border-[#1c1c24] ${col.border} transition-all text-left flex flex-col justify-between h-28 group cursor-pointer shadow-sm`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-mono text-[#ffe600] font-black uppercase">CHỦ ĐỀ #{idx + 1}</span>
                <Play className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-xs font-black text-white group-hover:text-[#00e5ff] transition-colors leading-tight">{col.title}</p>
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
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#ffe600]" />
              Khám phá thêm
            </h2>
            <span className="text-xs text-[#777] font-mono">{remaining.length} bài hát</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {remaining.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item)}
                className="p-2.5 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#ffe600]/30 transition-all flex flex-col group cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#14141c]">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <Music className="w-6 h-6" />
                    </div>
                  )}

                  <div className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[#ffe600] hover:bg-[#00e5ff] text-black flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>

                  <div className="absolute top-1.5 left-1.5">
                    {getSourceBadge(item.source)}
                  </div>
                </div>

                <p className="text-xs font-bold text-white truncate group-hover:text-[#ffe600] transition-colors" title={item.title}>
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
