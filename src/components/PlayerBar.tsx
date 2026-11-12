import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, Heart, Music, Sparkles, FolderPlus, Radio
} from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { Track } from '../types';
import { getContrastTextColor } from '../utils/trackUtils';

interface PlayerBarProps {
  currentTrack: Track | null;
  upcomingTrack?: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isFavorite: boolean;
  repeatMode: 'all' | 'one' | 'off';
  isShuffle: boolean;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleFavorite: () => void;
  onAddToAlbum?: () => void;
  onToggleVisualizer: () => void;
  showVisualizer: boolean;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  recommendMode?: 'fresh' | 'mix' | 'off';
  onCycleRecommendMode?: () => void;
  autoRecommend?: boolean;
  onToggleAutoRecommend?: () => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack, upcomingTrack, isPlaying, currentTime, duration, volume, isFavorite,
  repeatMode, isShuffle, onToggleRepeat, onToggleShuffle,
  onTogglePlay, onPrev, onNext, onSeek, onVolumeChange,
  onToggleFavorite, onAddToAlbum, onToggleVisualizer, showVisualizer,
  accentColor = '#ff2a55',
  themeMode = 'dark',
  recommendMode = 'fresh',
  onCycleRecommendMode,
  autoRecommend = true,
  onToggleAutoRecommend,
}) => {
  const [prevVolume, setPrevVolume] = useState(volume || 0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  // Time formatter with strict clamp against YouTube live unix timestamps (>86400s)
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0 || secs > 86400) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume || 0.8);
    }
  };

  // Detect Live Stream mode (YouTube Live, 24/7 radio, duration 0 or live/radio keywords)
  const isLive = Boolean(
    currentTrack && (
      currentTime > 86400 ||
      (currentTrack.duration_secs === 0 && duration <= 0) ||
      currentTrack.title.toLowerCase().includes('live') ||
      currentTrack.title.toLowerCase().includes('trực tiếp') ||
      currentTrack.title.toLowerCase().includes('24/7') ||
      (currentTrack.source === 'youtube' && currentTrack.title.toLowerCase().includes('radio'))
    )
  );

  // Effective duration: if duration is 0 or unset, fallback immediately to track metadata duration_secs!
  const effectiveDuration = (duration > 0 && duration < 86400)
    ? duration
    : (currentTrack?.duration_secs && currentTrack.duration_secs > 0 && currentTrack.duration_secs < 86400)
      ? currentTrack.duration_secs
      : 0;

  // Clamp display time: never display epoch timestamps (>86400)
  const safeCurrentTime = currentTime > 86400 ? 0 : currentTime;
  const displayTime = isDragging ? dragValue : safeCurrentTime;
  const isBuffering = !isLive && effectiveDuration <= 0 && isPlaying;
  const safeDuration = effectiveDuration > 0 ? effectiveDuration : 100;
  const progressPercent = (!isLive && effectiveDuration > 0)
    ? Math.min(100, Math.max(0, (displayTime / safeDuration) * 100))
    : 0;

  const getSourceBadge = (source: string) => {
    if (isLive) {
      return (
        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--accent-color, #ff2a55)]/15 text-[var(--accent-color, #ff2a55)] border border-[var(--accent-color, #ff2a55)]/40 flex items-center gap-1.5 font-mono">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color, #ff2a55)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent-color, #ff2a55)]"></span>
          </span>
          TRỰC TIẾP
        </span>
      );
    }

    switch (source) {
      case 'youtube':
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-[#ff4e6b] border border-[var(--accent-color, #ff2a55)]/30 flex items-center gap-1 font-mono">
            <YoutubeIcon className="w-2.5 h-2.5" />YT STREAM
          </span>
        );
      case 'soundcloud':
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-orange-400 border border-orange-500/30 flex items-center gap-1 font-mono">
            <SoundCloudIcon className="w-2.5 h-2.5" />SOUNDCLOUD
          </span>
        );
      case 'audius':
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-white border border-white/20 flex items-center gap-1 font-mono">
            <AudiusIcon className="w-2.5 h-2.5 text-[var(--accent-color, #ff2a55)]" />AUDIUS 320K
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-[#16161c] text-white border border-white/20 font-mono">
            LOSSLESS
          </span>
        );
    }
  };

  return (
    <footer className="h-22 bg-[#060608] border-t border-[#14141a] px-6 flex items-center justify-between select-none z-50">
      {/* Left: Track Info — Spy Minimalist style */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[220px]">
        {currentTrack ? (
          <>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#101014] flex-shrink-0 border border-[#202028] relative group shadow-sm">
              {currentTrack.cover_art ? (
                <img src={currentTrack.cover_art} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#101014] text-[#666]">
                  <Music className="w-5 h-5 text-[var(--accent-color, #ff2a55)]/70" />
                </div>
              )}
            </div>
            <div className="flex flex-col overflow-hidden pr-2 flex-1 min-w-0">
              <span className="text-xs font-bold tracking-tight truncate" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
                {currentTrack.title}
              </span>
              <span className="text-[11px] truncate mt-0.5" style={{ color: themeMode === 'light' ? '#64748b' : '#8e8e9f' }}>
                {currentTrack.artist}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onToggleFavorite}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isFavorite ? 'text-[var(--accent-color, #ff2a55)] drop-shadow-[0_0_8px_var(--accent-color, #ff2a55)]' : 'text-[#555] hover:text-white'
                }`}
                title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>

              {onAddToAlbum && (
                <button
                  onClick={onAddToAlbum}
                  title="Thêm vào Album"
                  className="p-1.5 rounded-full text-[#555] hover:text-[var(--accent-color, #ff2a55)] hover:bg-[#161620] transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-xs text-[#555]">
            <div className="w-12 h-12 rounded-lg bg-[#0e0e12] border border-[#181820] flex items-center justify-center">
              <Music className="w-5 h-5 text-[#333]" />
            </div>
            <span className="text-[11px]">Chưa phát bài hát</span>
          </div>
        )}
      </div>

      {/* Center: Controls + Spy Seekbar */}
      <div className="flex flex-col items-center gap-1.5 max-w-[620px] w-2/4">
        <div className="flex items-center gap-6">
          <button
            onClick={onToggleShuffle}
            title={isShuffle ? 'Bật phát ngẫu nhiên' : 'Tắt phát ngẫu nhiên'}
            style={isShuffle ? { color: accentColor, filter: `drop-shadow(0 0 8px ${accentColor}80)` } : undefined}
            className={`transition-colors cursor-pointer ${
              isShuffle ? '' : 'text-[#666] hover:text-white'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={onPrev} className="text-[#888] hover:text-white transition-colors cursor-pointer">
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={onTogglePlay}
            disabled={!currentTrack}
            title={isPlaying ? 'Tạm dừng (Space)' : 'Phát nhạc (Space)'}
            style={{
              backgroundColor: currentTrack ? accentColor : (themeMode === 'light' ? '#e2e8f0' : '#1c1c24'),
              color: currentTrack ? getContrastTextColor(accentColor) : (themeMode === 'light' ? '#64748b' : '#64748b'),
              boxShadow: currentTrack ? `0 0 16px ${accentColor}50` : (themeMode === 'light' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'),
              borderColor: currentTrack ? 'transparent' : (themeMode === 'light' ? '#cbd5e1' : '#2a2a38'),
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:cursor-not-allowed border"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Next Button with Upcoming Song Pop-up */}
          <div className="relative group/next flex items-center">
            <button 
              onClick={onNext} 
              className="text-[#888] hover:text-white transition-colors cursor-pointer p-1"
              title="Bài tiếp theo"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Next Track Preview Pop-up */}
            <div 
              className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-[#0c0c12]/95 backdrop-blur-md border shadow-2xl opacity-0 group-hover/next:opacity-100 pointer-events-none group-hover/next:pointer-events-auto transition-all duration-200 z-50 flex flex-col gap-2"
              style={{
                borderColor: `${accentColor}40`,
                boxShadow: `0 8px 30px rgba(0,0,0,0.8), 0 0 14px ${accentColor}25`
              }}
            >
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: accentColor }}>
                  <SkipForward className="w-3 h-3 fill-current" />
                  Bài tiếp theo
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#161622] text-[#88889f]">
                  {recommendMode === 'fresh' ? '🌟 Mới (<10p)' : recommendMode === 'mix' ? '🎵 Mix' : 'Tuần tự'}
                </span>
              </div>

              {upcomingTrack ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 border border-[#222]">
                    {upcomingTrack.cover_art ? (
                      <img src={upcomingTrack.cover_art} alt={upcomingTrack.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs font-bold text-white truncate" title={upcomingTrack.title}>
                      {upcomingTrack.title}
                    </p>
                    <p className="text-[10px] text-[#8e8e9f] truncate">
                      {upcomingTrack.artist}
                    </p>
                  </div>
                  <button
                    onClick={onNext}
                    style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
                    className="p-1.5 rounded-lg text-white hover:scale-105 transition-transform flex-shrink-0 cursor-pointer"
                    title="Phát bài này ngay"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-white">Khám phá ngẫu nhiên</p>
                  <p className="text-[10px] text-[#8e8e9f] leading-snug">
                    Tự động tìm bài hát MỚI (&lt; 10 phút) cùng thể loại từ YouTube, SoundCloud & Audius.
                  </p>
                  <button
                    onClick={onNext}
                    style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
                    className="w-full mt-1 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-transform active:scale-95 cursor-pointer"
                  >
                    Chuyển bài ngay
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onToggleRepeat}
            title={repeatMode === 'all' ? 'Tự động chuyển bài (Lặp lại danh sách)' : repeatMode === 'one' ? 'Lặp lại 1 bài' : 'Dừng khi hết bài'}
            style={repeatMode !== 'off' ? { color: accentColor } : undefined}
            className={`transition-colors cursor-pointer relative flex items-center justify-center ${
              repeatMode !== 'off' ? '' : 'text-[#666] hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {repeatMode === 'one' && (
              <span 
                className="absolute -top-1.5 -right-1.5 text-[8px] font-black font-mono rounded-full px-1 leading-tight"
                style={{ backgroundColor: accentColor, color: getContrastTextColor(accentColor) }}
              >
                1
              </span>
            )}
          </button>

          {/* AI Auto-Recommend Next Track (Endless Radio) */}
          {(onCycleRecommendMode || onToggleAutoRecommend) && (
            <button
              onClick={onCycleRecommendMode || onToggleAutoRecommend}
              title={
                recommendMode === 'fresh'
                  ? '🌟 Đề xuất: Khám phá bài MỚI (< 10p) ngẫu nhiên từ YouTube, SoundCloud & Audius. Bấm để chuyển sang Pha trộn (Mix)'
                  : recommendMode === 'mix'
                  ? '🎵 Đề xuất: Pha trộn Smart Mix (< 10p, trộn bài quen thuộc & bài mới). Bấm để Tắt'
                  : '⏹ Đề xuất: Đang TẮT (Chỉ phát tuần tự danh sách). Bấm để Bật Khám phá mới'
              }
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer relative flex items-center gap-1.5 border font-mono text-[10px] font-bold ${
                recommendMode === 'fresh'
                  ? 'shadow-sm'
                  : recommendMode === 'mix'
                  ? 'shadow-sm'
                  : 'text-[#666] hover:text-white border-transparent'
              }`}
              style={{
                color: recommendMode !== 'off' ? accentColor : undefined,
                backgroundColor: recommendMode === 'fresh' ? `${accentColor}20` : recommendMode === 'mix' ? `${accentColor}10` : 'transparent',
                borderColor: recommendMode !== 'off' ? `${accentColor}40` : 'transparent',
              }}
            >
              {recommendMode === 'fresh' ? (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  <span className="leading-none">MỚI</span>
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span 
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ backgroundColor: accentColor }}
                    />
                    <span 
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ backgroundColor: accentColor }}
                    />
                  </span>
                </>
              ) : recommendMode === 'mix' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="leading-none">MIX</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 opacity-50" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Seekbar Area — Adapts to Live Stream, Buffering, or Regular Track */}
        {isLive ? (
          <div className="w-full flex items-center gap-3 text-xs font-mono">
            <span className="w-10 text-right font-semibold" style={{ color: accentColor }}>{formatTime(safeCurrentTime)}</span>
            <div 
              className="relative flex-1 h-[4px] rounded-full overflow-hidden flex items-center border border-black/5"
              style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
            >
              <div 
                className="h-full w-full rounded-full animate-pulse opacity-90" 
                style={{ background: `linear-gradient(to right, ${accentColor}, #ffffff, ${accentColor})` }}
              />
            </div>
            <div 
              className="flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider flex-shrink-0 border"
              style={{ 
                backgroundColor: `${accentColor}20`, 
                borderColor: `${accentColor}50`, 
                color: accentColor 
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }}></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: accentColor }}></span>
              </span>
              <span>Trực tiếp</span>
            </div>
          </div>
        ) : isBuffering ? (
          <div className="w-full flex items-center gap-3 text-[11px] font-mono">
            <span className="w-9 text-right font-bold" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
              {formatTime(safeCurrentTime)}
            </span>
            <div 
              className="relative flex-1 h-[4px] rounded-full overflow-hidden border border-black/5"
              style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
            >
              <div 
                className="h-full rounded-full animate-pulse w-full opacity-75" 
                style={{ background: `linear-gradient(to right, ${accentColor}, #ffffff)` }}
              />
            </div>
            <span className="w-12 text-[10px] truncate" style={{ color: themeMode === 'light' ? '#64748b' : '#888899' }}>Đang tải...</span>
          </div>
        ) : (
          <div className="w-full flex items-center gap-3 text-[11px] font-mono">
            <span className="w-9 text-right font-bold text-xs" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
              {formatTime(displayTime)}
            </span>
            <div className="relative flex-1 flex items-center group h-4 cursor-pointer">
              {/* Background track */}
              <div 
                className="absolute w-full h-[4px] rounded-full group-hover:h-[6px] transition-all overflow-hidden border border-black/5"
                style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
              >
                {/* Progress fill */}
                <div
                  className="h-full transition-all rounded-full"
                  style={{ width: `${progressPercent}%`, backgroundColor: accentColor }}
                />
              </div>

              {/* Thumb handle on hover */}
              <div
                className="absolute w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2 shadow-md border-2 border-white"
                style={{ left: `${progressPercent}%`, backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
              />

              {/* Range input */}
              <input
                type="range"
                min={0}
                max={safeDuration}
                step={0.25}
                value={displayTime}
                onMouseDown={(e) => {
                  setIsDragging(true);
                  setDragValue(Number((e.target as HTMLInputElement).value));
                }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDragValue(v);
                }}
                onMouseUp={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  setIsDragging(false);
                  onSeek(v);
                }}
                className="absolute w-full opacity-0 h-full cursor-pointer z-10"
              />
            </div>
            <span className="w-9 font-mono text-xs" style={{ color: themeMode === 'light' ? '#64748b' : '#8e8e9f' }}>
              {formatTime(effectiveDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Right: Volume + Utils */}
      <div className="flex items-center justify-end gap-3.5 w-1/4 min-w-[220px]">
        {/* Visualizer Toggle */}
        <button
          onClick={onToggleVisualizer}
          title="Bật/Tắt sóng âm thanh Spy"
          style={showVisualizer ? {
            color: accentColor,
            backgroundColor: `${accentColor}18`,
            borderColor: `${accentColor}50`,
            boxShadow: `0 0 10px ${accentColor}30`,
          } : undefined}
          className={`p-1.5 rounded-md transition-colors cursor-pointer border ${
            showVisualizer
              ? ''
              : 'text-[#666] hover:text-white border-transparent'
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Source Badge */}
        {currentTrack && getSourceBadge(currentTrack.source)}

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button onClick={handleMuteToggle} className="text-[#777] hover:text-white transition-colors cursor-pointer">
            {volume === 0 ? <VolumeX className="w-4 h-4" style={{ color: accentColor }} /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative flex items-center w-20 h-4 group cursor-pointer">
            <div 
              className="absolute w-full h-[4px] rounded-full group-hover:h-[6px] transition-all overflow-hidden border border-black/5"
              style={{ backgroundColor: themeMode === 'light' ? '#cbd5e1' : '#1f1f28' }}
            >
              <div 
                className="h-full transition-colors rounded-full" 
                style={{ width: `${volume * 100}%`, backgroundColor: accentColor }} 
              />
            </div>
            <input
              type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="absolute w-full opacity-0 h-full cursor-pointer"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};
