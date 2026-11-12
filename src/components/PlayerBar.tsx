import React, { useState } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, VolumeX, Heart, Music, Sparkles
} from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { Track } from '../types';
import { Disc3 } from 'lucide-react';

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
  onToggleVisualizer: () => void;
  showVisualizer: boolean;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack, isPlaying, currentTime, duration, volume, isFavorite,
  repeatMode, isShuffle, onToggleRepeat, onToggleShuffle,
  onTogglePlay, onPrev, onNext, onSeek, onVolumeChange,
  onToggleFavorite, onToggleVisualizer, showVisualizer,
}) => {
  const [prevVolume, setPrevVolume] = useState(volume || 0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
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

  // Detect Live Stream mode (YouTube Live, 24/7 radio, duration 0 or live keyword)
  const isLive = Boolean(
    currentTrack && (
      (duration <= 0 && isPlaying && currentTime > 4) ||
      (currentTrack.duration_secs === 0 && duration <= 0) ||
      currentTrack.title.toLowerCase().includes('live') ||
      currentTrack.title.toLowerCase().includes('trực tiếp') ||
      currentTrack.title.toLowerCase().includes('24/7') ||
      currentTrack.title.toLowerCase().includes('radio stream') ||
      currentTrack.artist.toLowerCase().includes('radio')
    )
  );

  const displayTime = isDragging ? dragValue : currentTime;
  const isBuffering = !isLive && duration <= 0 && isPlaying;
  const safeDuration = duration > 0 ? duration : 100;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / safeDuration) * 100)) : 0;

  const getSourceBadge = (source: string) => {
    if (isLive) {
      return (
        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5 font-mono">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
          </span>
          TRỰC TIẾP
        </span>
      );
    }

    switch (source) {
      case 'youtube':
        return (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#161616] text-red-400 border border-red-500/30 flex items-center gap-1 font-mono">
            <YoutubeIcon className="w-2.5 h-2.5" />YT STREAM
          </span>
        );
      case 'soundcloud':
        return (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#161616] text-orange-400 border border-orange-500/30 flex items-center gap-1 font-mono">
            <SoundCloudIcon className="w-2.5 h-2.5" />SOUNDCLOUD
          </span>
        );
      case 'audius':
        return (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#161616] text-[#00e5ff] border border-[#00e5ff]/30 flex items-center gap-1 font-mono">
            <AudiusIcon className="w-2.5 h-2.5 text-[#cc00ff]" />AUDIUS 320K
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#181812] text-[#ffe600] border border-[#ffe600]/30 font-mono shadow-[0_0_6px_rgba(255,230,0,0.15)]">
            LOSSLESS
          </span>
        );
    }
  };

  return (
    <footer className="h-22 bg-[#050505] border-t border-[#141416] px-6 flex items-center justify-between select-none z-50">
      {/* Left: Track Info — Invincible Minimalist style */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[220px]">
        {currentTrack ? (
          <>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#121212] flex-shrink-0 border border-[#222] relative group shadow-sm">
              {currentTrack.cover_art ? (
                <img src={currentTrack.cover_art} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#111] text-[#555]">
                  <Music className="w-5 h-5 text-[#ffe600]/60" />
                </div>
              )}
            </div>
            <div className="flex flex-col overflow-hidden pr-2 flex-1 min-w-0">
              <span className="text-xs font-bold text-white tracking-tight truncate">{currentTrack.title}</span>
              <span className="text-[11px] text-[#00e5ff]/80 truncate mt-0.5">{currentTrack.artist}</span>
            </div>
            <button
              onClick={onToggleFavorite}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${isFavorite ? 'text-[#ffe600] drop-shadow-[0_0_6px_#ffe600]' : 'text-[#555] hover:text-white'}`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3 text-xs text-[#555]">
            <div className="w-12 h-12 rounded-lg bg-[#0e0e0e] border border-[#181818] flex items-center justify-center">
              <Music className="w-5 h-5 text-[#333]" />
            </div>
            <span className="text-[11px]">Chưa phát bài hát</span>
          </div>
        )}
      </div>

      {/* Center: Controls + Invincible Dual-Tone Seekbar */}
      <div className="flex flex-col items-center gap-1.5 max-w-[620px] w-2/4">
        <div className="flex items-center gap-6">
          <button
            onClick={onToggleShuffle}
            title={isShuffle ? 'Bật phát ngẫu nhiên' : 'Tắt phát ngẫu nhiên'}
            className={`transition-colors cursor-pointer ${isShuffle ? 'text-[#00e5ff] drop-shadow-[0_0_6px_#00e5ff]' : 'text-[#666] hover:text-white'}`}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
          <button onClick={onPrev} className="text-[#888] hover:text-[#ffe600] transition-colors cursor-pointer">
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={onTogglePlay}
            disabled={!currentTrack}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTrack
                ? 'bg-[#ffe600] text-black hover:bg-[#00e5ff] hover:scale-105 active:scale-95 shadow-sm'
                : 'bg-[#222] text-[#555] cursor-not-allowed'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button onClick={onNext} className="text-[#888] hover:text-[#ffe600] transition-colors cursor-pointer">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={onToggleRepeat}
            title={repeatMode === 'all' ? 'Tự động chuyển bài (Lặp lại danh sách)' : repeatMode === 'one' ? 'Lặp lại 1 bài' : 'Dừng khi hết bài'}
            className={`transition-colors cursor-pointer relative flex items-center justify-center ${repeatMode !== 'off' ? 'text-[#ffe600]' : 'text-[#666] hover:text-white'}`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black font-mono bg-[#ffe600] text-black rounded-full px-1 leading-tight">
                1
              </span>
            )}
          </button>
        </div>

        {/* Seekbar Area — Adapts to Live Stream, Buffering, or Regular Track */}
        {isLive ? (
          <div className="w-full flex items-center gap-3 text-xs font-mono">
            <span className="w-10 text-right text-[#ffe600] font-semibold">{formatTime(currentTime)}</span>
            <div className="relative flex-1 h-[4px] bg-[#16161c] rounded-full overflow-hidden flex items-center">
              <div className="h-full w-full bg-gradient-to-r from-red-500 via-[#ffe600] to-[#00e5ff] rounded-full animate-pulse opacity-90" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-[9px] uppercase tracking-wider flex-shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
              <span>Trực tiếp</span>
            </div>
          </div>
        ) : isBuffering ? (
          <div className="w-full flex items-center gap-3 text-[11px] text-[#666] font-mono">
            <span className="w-9 text-right text-[#ffe600]">{formatTime(currentTime)}</span>
            <div className="relative flex-1 h-[3px] bg-[#1c1c1e] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#ffe600] to-[#00e5ff] rounded-full animate-pulse w-full opacity-60" />
            </div>
            <span className="w-12 text-[#888] text-[10px] truncate">Đang tải...</span>
          </div>
        ) : (
          <div className="w-full flex items-center gap-3 text-[11px] text-[#666] font-mono">
            <span className="w-9 text-right text-[#ffe600]">{formatTime(displayTime)}</span>
            <div className="relative flex-1 flex items-center group h-4 cursor-pointer">
              {/* Background track */}
              <div className="absolute w-full h-[3px] bg-[#1c1c1e] rounded-full group-hover:h-[4px] transition-all overflow-hidden">
                {/* Progress fill */}
                <div
                  className="h-full bg-gradient-to-r from-[#ffe600] to-[#00e5ff] transition-all rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Thumb handle on hover */}
              <div
                className="absolute w-2.5 h-2.5 bg-[#ffe600] rounded-full border border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2"
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
            <span className="w-9 text-[#00e5ff]">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Right: Volume + Utils */}
      <div className="flex items-center justify-end gap-3.5 w-1/4 min-w-[220px]">
        {/* Visualizer Toggle */}
        <button
          onClick={onToggleVisualizer}
          title="Bật/Tắt sóng âm thanh Invincible"
          className={`p-1.5 rounded-md transition-colors ${showVisualizer ? 'text-[#ffe600] bg-[#181812] border border-[#ffe600]/30 shadow-[0_0_6px_rgba(255,230,0,0.3)]' : 'text-[#555] hover:text-white'}`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Source Badge */}
        {currentTrack && getSourceBadge(currentTrack.source)}

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button onClick={handleMuteToggle} className="text-[#666] hover:text-[#ffe600] transition-colors cursor-pointer">
            {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative flex items-center w-20 h-4 group cursor-pointer">
            <div className="absolute w-full h-[3px] bg-[#1c1c1e] rounded-full group-hover:h-[4px] transition-all">
              <div className="h-full bg-gradient-to-r from-[#ffe600] to-[#00e5ff] transition-colors rounded-full" style={{ width: `${volume * 100}%` }} />
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
