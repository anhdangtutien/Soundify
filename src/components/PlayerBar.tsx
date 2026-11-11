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

  const displayTime = isDragging ? dragValue : currentTime;
  const safeDuration = duration > 0 ? duration : 100;
  const progressPercent = Math.min(100, Math.max(0, (displayTime / safeDuration) * 100));

  const getSourceBadge = (source: string) => {
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
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#161616] text-[#cc00ff] border border-[#cc00ff]/30 flex items-center gap-1 font-mono">
            <AudiusIcon className="w-2.5 h-2.5 text-[#cc00ff]" />AUDIUS 320K
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#161616] text-[#00e5ff] border border-[#00e5ff]/30 font-mono">
            LOSSLESS
          </span>
        );
    }
  };

  return (
    <footer className="h-22 bg-[#050505] border-t border-[#141414] px-6 flex items-center justify-between select-none z-50">
      {/* Left: Track Info — TIDAL Minimalist style */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[220px]">
        {currentTrack ? (
          <>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#121212] flex-shrink-0 border border-[#202020] relative group">
              {currentTrack.cover_art ? (
                <img src={currentTrack.cover_art} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#111] text-[#555]">
                  <Music className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="flex flex-col overflow-hidden pr-2 flex-1 min-w-0">
              <span className="text-xs font-bold text-white tracking-tight truncate">{currentTrack.title}</span>
              <span className="text-[11px] text-[#777] truncate mt-0.5">{currentTrack.artist}</span>
            </div>
            <button
              onClick={onToggleFavorite}
              className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${isFavorite ? 'text-[#00e5ff]' : 'text-[#555] hover:text-white'}`}
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

      {/* Center: Controls + Hi-Fi Seekbar */}
      <div className="flex flex-col items-center gap-1.5 max-w-[620px] w-2/4">
        <div className="flex items-center gap-6">
          <button
            onClick={onToggleShuffle}
            title={isShuffle ? 'Bật phát ngẫu nhiên' : 'Tắt phát ngẫu nhiên'}
            className={`transition-colors cursor-pointer ${isShuffle ? 'text-[#00e5ff]' : 'text-[#666] hover:text-white'}`}
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
                ? 'bg-white text-black hover:bg-[#00e5ff] hover:scale-105 active:scale-95 shadow-md shadow-white/5'
                : 'bg-[#222] text-[#555] cursor-not-allowed'
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
            className={`transition-colors cursor-pointer relative flex items-center justify-center ${repeatMode !== 'off' ? 'text-[#00e5ff]' : 'text-[#666] hover:text-white'}`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {repeatMode === 'one' && (
              <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold font-mono bg-[#00e5ff] text-black rounded-full px-1 leading-tight">
                1
              </span>
            )}
          </button>
        </div>

        {/* Minimalist Seekbar — White + Amazon Cyan indicator */}
        <div className="w-full flex items-center gap-3 text-[11px] text-[#666] font-mono">
          <span className="w-9 text-right text-[#999]">{formatTime(displayTime)}</span>
          <div className="relative flex-1 flex items-center group h-4 cursor-pointer">
            {/* Background track */}
            <div className="absolute w-full h-[3px] bg-[#1c1c1c] rounded-full group-hover:h-[5px] transition-all overflow-hidden">
              {/* Progress fill (TIDAL White / Amazon Cyan) */}
              <div
                className="h-full bg-white group-hover:bg-[#00e5ff] transition-colors rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Glowing thumb handle on hover */}
            <div
              className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-md shadow-white/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-x-1/2"
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
          <span className="w-9 text-[#666]">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume + Utils */}
      <div className="flex items-center justify-end gap-3.5 w-1/4 min-w-[220px]">
        {/* Visualizer Toggle */}
        <button
          onClick={onToggleVisualizer}
          title="Bật/Tắt sóng âm thanh"
          className={`p-1.5 rounded-md transition-colors ${showVisualizer ? 'text-[#00e5ff] bg-[#141414]' : 'text-[#555] hover:text-white'}`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Source Badge */}
        {currentTrack && getSourceBadge(currentTrack.source)}

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button onClick={handleMuteToggle} className="text-[#666] hover:text-white transition-colors cursor-pointer">
            {volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="relative flex items-center w-20 h-4 group cursor-pointer">
            <div className="absolute w-full h-[3px] bg-[#1c1c1c] rounded-full group-hover:h-[4px] transition-all">
              <div className="h-full bg-white group-hover:bg-[#00e5ff] transition-colors rounded-full" style={{ width: `${volume * 100}%` }} />
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
