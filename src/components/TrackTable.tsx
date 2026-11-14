import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Clock3, Heart, Music, HardDrive, FolderPlus, Download, Loader2, Check } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { Track } from '../types';
import { optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface TrackTableProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onTrackSelect: (track: Track) => void;
  onTogglePlay: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToAlbum?: (track: Track) => void;
  onDownloadTrack?: (track: Track) => void;
  downloadingTrackIds?: Set<string>;
  accentColor?: string;
  language?: LanguageCode;
}

const ROW_HEIGHT = 54;
const OVERSCAN = 6;

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  favorites,
  onTrackSelect,
  onTogglePlay,
  onToggleFavorite,
  onAddToAlbum,
  onDownloadTrack,
  downloadingTrackIds,
  accentColor = '#ff2a55',
  language = 'vi',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  // Virtual Scrolling scroll listener on parent container
  useEffect(() => {
    const scrollParent = containerRef.current?.closest('.overflow-y-auto') as HTMLElement;
    if (!scrollParent) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollTop(scrollParent.scrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    const onResize = () => {
      setContainerHeight(scrollParent.clientHeight || 800);
    };

    onResize();
    scrollParent.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      scrollParent.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const totalCount = tracks.length;
  const isVirtual = totalCount > 25;

  let startIndex = 0;
  let endIndex = totalCount;

  if (isVirtual) {
    const tableTop = containerRef.current?.offsetTop || 0;
    const relativeScroll = Math.max(0, scrollTop - tableTop);
    startIndex = Math.max(0, Math.floor(relativeScroll / ROW_HEIGHT) - OVERSCAN);
    endIndex = Math.min(totalCount, Math.ceil((relativeScroll + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  }

  const visibleTracks = isVirtual ? tracks.slice(startIndex, endIndex) : tracks;
  const topPadding = isVirtual ? startIndex * ROW_HEIGHT : 0;
  const bottomPadding = isVirtual ? (totalCount - endIndex) * ROW_HEIGHT : 0;
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0 || secs > 86400) return '--:--';
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'youtube':
        return (
          <div 
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141414] border"
            style={{ color: accentColor, borderColor: `${accentColor}40` }}
          >
            <YoutubeIcon className="w-3 h-3" />
            <span>YT</span>
          </div>
        );
      case 'soundcloud':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141414] text-orange-400 border border-orange-500/20">
            <SoundCloudIcon className="w-3 h-3 text-orange-400" />
            <span>SC</span>
          </div>
        );
      case 'audius':
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141416] text-white border border-white/20">
            <AudiusIcon className="w-3 h-3" style={{ color: accentColor }} />
            <span>AUDIUS</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#141418] text-white border border-white/20">
            <HardDrive className="w-3 h-3 text-white" />
            <span>LOSSLESS</span>
          </div>
        );
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8">
        <div className="w-14 h-14 rounded-full bg-[#0d0d10] border border-[#1a1a24] flex items-center justify-center text-[#555] mb-3">
          <Music className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-white mb-1">
          {getTranslation(language, 'table.emptyTitle')}
        </h3>
        <p className="text-xs text-[#777] max-w-sm">
          {getTranslation(language, 'table.emptyDesc')}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full text-xs select-none">
      {/* Header — Spy Minimalist */}
      <div className="grid grid-cols-[40px_1fr_1fr_90px_90px] px-3 py-2 border-b border-[#141418] text-[10px] font-bold text-[#666677] uppercase tracking-wider sticky top-0 bg-black/90 backdrop-blur z-10 font-mono">
        <span className="text-center">#</span>
        <span>{getTranslation(language, 'table.title')}</span>
        <span>{getTranslation(language, 'table.artistAlbum')}</span>
        <span className="text-center">{getTranslation(language, 'table.source')}</span>
        <span className="flex items-center justify-end pr-2">
          <Clock3 className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Rows with Top & Bottom Virtual Padding */}
      <div className="divide-y divide-[#101014]">
        {topPadding > 0 && <div style={{ height: `${topPadding}px` }} aria-hidden="true" />}
        {visibleTracks.map((track, i) => {
          const idx = isVirtual ? startIndex + i : i;
          const isSelected = Boolean(
            currentTrack && (
              currentTrack.id === track.id ||
              (currentTrack.path_or_url && currentTrack.path_or_url === track.path_or_url) ||
              (currentTrack.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
               currentTrack.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
            )
          );
          const isFav = favorites.has(track.id);

          return (
            <div
              key={track.id}
              onClick={() => {
                if (isSelected) {
                  onTogglePlay();
                } else {
                  onTrackSelect(track);
                }
              }}
              onDoubleClick={() => onTrackSelect(track)}
              style={{
                height: `${ROW_HEIGHT}px`,
                borderLeftColor: isSelected ? accentColor : 'transparent',
                backgroundColor: isSelected ? `${accentColor}18` : undefined,
              }}
              className={`grid grid-cols-[40px_1fr_1fr_90px_90px] items-center px-3 rounded-md transition-colors group cursor-pointer ${
                isSelected
                  ? 'text-white border-l-2'
                  : 'hover:bg-[#0c0c10] text-[#888899] hover:text-white border-l-2 border-transparent'
              }`}
            >
              {/* Col 1: Play button / Number */}
              <div className="flex items-center justify-center relative">
                <span 
                  className={`text-[11px] font-mono ${isSelected ? 'font-bold' : 'group-hover:hidden text-[#444]'}`}
                  style={{ color: isSelected ? accentColor : undefined }}
                >
                  {idx + 1}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected) {
                      onTogglePlay();
                    } else {
                      onTrackSelect(track);
                    }
                  }}
                  className={`hidden group-hover:flex items-center justify-center p-1 rounded-full text-white hover:scale-110 transition-transform ${
                    isSelected ? 'flex' : ''
                  }`}
                >
                  {isSelected && isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" style={{ color: accentColor }} />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current text-white hover:opacity-80" />
                  )}
                </button>
              </div>

              {/* Col 2: Title & Artist & Cover */}
              <div className="flex items-center gap-3 overflow-hidden pr-3">
                <div className="w-9 h-9 rounded bg-[#111] border border-[#1e1e24] flex-shrink-0 overflow-hidden relative">
                  {track.cover_art ? (
                    <img
                      src={optimizeThumbnailUrl(track.cover_art, track.path_or_url || track.id)}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, track.path_or_url || track.id)}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#555]">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col overflow-hidden">
                  <span
                    className={`font-semibold truncate text-xs ${
                      isSelected ? 'font-bold' : 'text-white'
                    }`}
                    style={{ color: isSelected ? accentColor : undefined }}
                  >
                    {track.title}
                  </span>
                  <span className="text-[11px] text-[#8e8e9f] truncate group-hover:text-white">
                    {track.artist}
                  </span>
                </div>
              </div>

              {/* Col 3: Album */}
              <div className="truncate text-[11px] text-[#666677] pr-3 font-mono">
                {(() => {
                  const alb = track.album?.trim() || '';
                  if (!alb || alb === 'Unknown Album' || alb.startsWith('và •') || alb.startsWith('& •') || alb.startsWith('and •')) {
                    return 'Single • YT Music';
                  }
                  return alb;
                })()}
              </div>

              {/* Col 4: Source Badge */}
              <div className="flex items-center justify-center">
                {getSourceBadge(track.source)}
              </div>

              {/* Col 5: Duration & Like & Add to Album */}
              <div className="flex items-center justify-end gap-2 text-[11px] pr-1 font-mono text-[#666]">
                {track.source !== 'local' && !track.is_downloaded && onDownloadTrack ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadTrack(track);
                    }}
                    disabled={downloadingTrackIds?.has(track.id)}
                    title={
                      downloadingTrackIds?.has(track.id)
                        ? getTranslation(language, 'download.downloading')
                        : getTranslation(language, 'download.downloadBtn')
                    }
                    className={`p-1 transition-colors cursor-pointer ${
                      downloadingTrackIds?.has(track.id)
                        ? 'text-[var(--accent-color, #ff2a55)] animate-pulse'
                        : 'opacity-0 group-hover:opacity-100 text-[#666] hover:text-white'
                    }`}
                  >
                    {downloadingTrackIds?.has(track.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (track.is_downloaded || track.source === 'local') ? (
                  <span
                    title={getTranslation(language, 'download.downloaded')}
                    className="p-1 text-emerald-400 flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                ) : null}

                {onAddToAlbum && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToAlbum(track);
                    }}
                    title={getTranslation(language, 'player.addToAlbum')}
                    className="p-1 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 text-[#666] hover:text-white"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(track.id);
                  }}
                  className={`p-1 transition-colors cursor-pointer ${
                    isFav
                      ? 'drop-shadow-sm'
                      : 'opacity-0 group-hover:opacity-100 text-[#555] hover:text-white'
                  }`}
                  style={isFav ? { color: accentColor } : undefined}
                >
                  <Heart 
                    className="w-3.5 h-3.5" 
                    style={isFav ? { fill: accentColor, color: accentColor } : undefined} 
                  />
                </button>
                <span>{formatTime(track.duration_secs)}</span>
              </div>
            </div>
          );
        })}
        {bottomPadding > 0 && <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />}
      </div>
    </div>
  );
};
