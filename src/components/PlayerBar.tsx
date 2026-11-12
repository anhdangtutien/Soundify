import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, Heart, Music, Sparkles, FolderPlus
} from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { Track } from '../types';

interface PlayerBarProps {
  currentTrack: Track | null;
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
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack, isPlaying, currentTime, duration, volume, isFavorite,
  repeatMode, isShuffle, onToggleRepeat, onToggleShuffle,
  onTogglePlay, onPrev, onNext, onSeek, onVolumeChange,
  onToggleFavorite, onAddToAlbum, onToggleVisualizer, showVisualizer,
  accentColor = '#ff2a55',
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
              <span className="text-xs font-bold text-white tracking-tight truncate">{currentTrack.title}</span>
              <span className="text-[11px] text-[#8e8e9f] truncate mt-0.5">{currentTrack.artist}</span>
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
            className={`transition-colors cursor-pointer ${
              isShuffle ? 'text-[var(--accent-color, #ff2a55)] drop-shadow-[0_0_8px_rgba(255,42,85,0.6)]' : 'text-[#666] hover:text-white'
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
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTrack
                ? 'bg-white text-black hover:bg-[var(--accent-color, #ff2a55)] hover:text-white hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                : 'bg-[#1c1c24] text-[#555] cursor-not-allowed'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button onClick={onNext} className="text-[#888] hover:text-white transition-colors cursor-pointer">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={onToggleRepeat}
            title={repeatMode === 'all' ? 'Tự động chuyển bài (Lặp lại danh sách)' : repeatMode === 'one' ? 'Lặp lại 1 bài' : 'Dừng khi hết bài'}
            className={`transition-colors cursor-pointer relative flex items-center justify-center ${
              repeatMode !== 'off' ? 'text-[var(--accent-color, #ff2a55)]' : 'text-[#666] hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black font-mono bg-[var(--accent-color, #ff2a55)] text-white rounded-full px-1 leading-tight">
                1
              </span>
            )}
          </button>
        </div>

        {/* Seekbar Area — Adapts to Live Stream, Buffering, or Regular Track */}
        {isLive ? (
          <div className="w-full flex items-center gap-3 text-xs font-mono">
            <span className="w-10 text-right text-[var(--accent-color, #ff2a55)] font-semibold">{formatTime(safeCurrentTime)}</span>
            <div className="relative flex-1 h-[4px] bg-[#161620] rounded-full overflow-hidden flex items-center">
              <div className="h-full w-full bg-gradient-to-r from-[var(--accent-color, #ff2a55)] via-white to-[var(--accent-color, #ff2a55)] rounded-full animate-pulse opacity-90" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--accent-color, #ff2a55)]/15 border border-[var(--accent-color, #ff2a55)]/40 text-[var(--accent-color, #ff2a55)] font-bold text-[9px] uppercase tracking-wider flex-shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-color, #ff2a55)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent-color, #ff2a55)]"></span>
              </span>
              <span>Trực tiếp</span>
            </div>
          </div>
        ) : isBuffering ? (
          <div className="w-full flex items-center gap-3 text-[11px] text-[#666] font-mono">
            <span className="w-9 text-right text-white">{formatTime(safeCurrentTime)}</span>
            <div className="relative flex-1 h-[3px] bg-[#161620] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--accent-color, #ff2a55)] to-white rounded-full animate-pulse w-full opacity-60" />
            </div>
            <span className="w-12 text-[#888] text-[10px] truncate">Đang tải...</span>
          </div>
        ) : (
          <div className="w-full flex items-center gap-3 text-[11px] text-[#666] font-mono">
            <span className="w-9 text-right text-white">{formatTime(displayTime)}</span>
            <div className="relative flex-1 flex items-center group h-4 cursor-pointer">
              {/* Background track */}
              <div className="absolute w-full h-[3px] bg-[#161620] rounded-full group-hover:h-[4px] transition-all overflow-hidden">
                {/* Progress fill */}
                <div
                  className="h-full bg-white group-hover:bg-[var(--accent-color, #ff2a55)] transition-all rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Thumb handle on hover */}
              <div
                className="absolute w-2.5 h-2.5 bg-white rounded-full border border-[var(--accent-color, #ff2a55)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2 shadow-[0_0_8px_var(--accent-color, #ff2a55)]"
                style={{ left: `${progressPercent}%` }}
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
            <span className="w-9 text-[#8e8e9f]">{formatTime(effectiveDuration)}</span>
          </div>
        )}
      </div>

      {/* Right: Volume + Utils */}
      <div className="flex items-center justify-end gap-3.5 w-1/4 min-w-[220px]">
        {/* Visualizer Toggle */}
        <button
          onClick={onToggleVisualizer}
          title="Bật/Tắt sóng âm thanh Spy"
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            showVisualizer
              ? 'text-[var(--accent-color, #ff2a55)] bg-[#1a0e14] border border-[var(--accent-color, #ff2a55)]/40 shadow-[0_0_8px_rgba(255,42,85,0.3)]'
              : 'text-[#666] hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Source Badge */}
        {currentTrack && getSourceBadge(currentTrack.source)}

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button onClick={handleMuteToggle} className="text-[#777] hover:text-white transition-colors cursor-pointer">
            {volume === 0 ? <VolumeX className="w-4 h-4 text-[var(--accent-color, #ff2a55)]" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative flex items-center w-20 h-4 group cursor-pointer">
            <div className="absolute w-full h-[3px] bg-[#161620] rounded-full group-hover:h-[4px] transition-all">
              <div className="h-full bg-white group-hover:bg-[var(--accent-color, #ff2a55)] transition-colors rounded-full" style={{ width: `${volume * 100}%` }} />
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
