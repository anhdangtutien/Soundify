import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Sidebar } from './components/Sidebar';
import { PlayerBar } from './components/PlayerBar';
import { TrackTable } from './components/TrackTable';
import { SearchView } from './components/SearchView';
import { AudioVisualizer } from './components/AudioVisualizer';
import { AuthModal } from './components/AuthModal';
import { ProfileView } from './components/ProfileView';
import { AiMixView } from './components/AiMixView';
import { Track, PlaybackStatus, SearchResult, ViewType, User } from './types';
import { FolderPlus, Disc, CheckCircle2, Tv, X, Radio, ArrowUpRight, LogIn } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon } from './components/Icons';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [currentView, setCurrentView] = useState<ViewType>('library');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [smartDjEnabled, setSmartDjEnabled] = useState(true);
  const [repeatMode, setRepeatMode] = useState<'all' | 'one' | 'off'>('all'); // default: auto-play next
  const [isShuffle, setIsShuffle] = useState(false);

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('soundify_favorites') || '[]')); }
    catch { return new Set(); }
  });
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [showYoutubeVideo, setShowYoutubeVideo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [scTrackUrl, setScTrackUrl] = useState<string | null>(null);

  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);
  const scIframeRef = useRef<HTMLIFrameElement | null>(null);
  const onlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const isPlayingRef = useRef(false);
  const tracksRef = useRef<Track[]>([]);
  const currentUserRef = useRef<User | null>(null);
  const repeatModeRef = useRef<'all' | 'one' | 'off'>('all');
  const isShuffleRef = useRef(false);
  const playStartTimestampRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);

  // ─── RESTORE USER SESSION FROM SQLITE ────────────────────────────────────
  useEffect(() => {
    const savedUserId = localStorage.getItem('soundify_active_user_id');
    if (savedUserId) {
      invoke<User | null>('auth_get_current_user', { userId: savedUserId })
        .then(user => {
          if (user) {
            setCurrentUser(user);
            loadFavoritesFromDb(user.id);
          }
        })
        .catch(console.error);
    }
  }, []);

  const loadFavoritesFromDb = async (userId: string) => {
    try {
      const dbFavs = await invoke<Track[]>('db_get_favorites', { userId });
      setFavorites(new Set(dbFavs.map(t => t.id)));
      // Merge favorite tracks into current track list
      setTracks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newTracks = dbFavs.filter(t => !existingIds.has(t.id));
        return [...newTracks, ...prev];
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('soundify_active_user_id', user.id);
    loadFavoritesFromDb(user.id);
    showNotification(`Xin chào, ${user.display_name}! Đã kết nối SQLite`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('soundify_active_user_id');
    showNotification('Đã đăng xuất tài khoản');
    setCurrentView('library');
  };

  // ─── AUTO-PLAY NEXT TRACK & AI SMART DJ ──────────────────────────────────
  const handleNext = useCallback(async () => {
    const all = tracksRef.current;
    const cur = currentTrackRef.current;
    if (!all.length) return;

    // Check repeat mode
    if (repeatModeRef.current === 'one' && cur) {
      playTrackInternal(cur);
      return;
    }

    if (repeatModeRef.current === 'off') {
      setIsPlaying(false);
      return;
    }

    // Shuffle mode
    if (isShuffleRef.current && all.length > 1) {
      const remaining = all.filter(t => t.id !== cur?.id);
      const randomTrack = remaining[Math.floor(Math.random() * remaining.length)];
      if (randomTrack) {
        playTrackInternal(randomTrack);
        return;
      }
    }

    // AI Smart DJ transition
    if (smartDjEnabled && all.length > 1 && cur) {
      try {
        const nextAiTrack = await invoke<Track | null>('ai_smart_dj_next', {
          currentTrack: cur,
          candidates: all,
        });
        if (nextAiTrack && nextAiTrack.id !== cur.id) {
          playTrackInternal(nextAiTrack);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Default sequential next or Auto-Discovery Stream
    if (!cur) {
      playTrackInternal(all[0]);
      return;
    }

    const idx = all.findIndex(t => t.id === cur.id);
    const isAtEnd = idx === all.length - 1;

    // AUTO-DISCOVERY RADIO: When reaching end of queue, automatically fetch related songs of the same genre/artist!
    if (isAtEnd || all.length <= 1) {
      try {
        showNotification(`📻 Đang tìm bài hát cùng phong cách với ${cur.artist}...`);
        const related = await invoke<SearchResult[]>('get_related_tracks', {
          title: cur.title,
          artist: cur.artist,
        });

        if (related && related.length > 0) {
          const newTracks: Track[] = related.map((r, i) => ({
            id: `radio_${Date.now()}_${i}`,
            title: r.title,
            artist: r.artist,
            album: r.album || 'Radio Discovery',
            duration_secs: r.duration_secs || 210,
            path_or_url: r.url_or_id,
            cover_art: r.thumbnail,
            source: r.source,
          }));

          // Append new related tracks to queue
          setTracks(prev => [...prev, ...newTracks]);
          playTrackInternal(newTracks[0]);
          showNotification(`📻 Đề xuất cùng thể loại: ${newTracks[0].title}`);
          return;
        }
      } catch (err) {
        console.error('Error fetching auto-discovery related tracks:', err);
      }
    }

    const nextTrack = all[(idx + 1) % all.length];
    playTrackInternal(nextTrack);
  }, [smartDjEnabled]);

  // ─── WALL-CLOCK TIME TICKER (IMMUNE TO BACKGROUND TAB THROTTLING) ────────
  useEffect(() => {
    const interval = setInterval(() => {
      const track = currentTrackRef.current;
      if (!track || !isPlayingRef.current) return;

      if (track.source === 'youtube' || track.source === 'soundcloud') {
        if (playStartTimestampRef.current) {
          const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
          const dur = track.duration_secs || 0;
          if (dur > 0 && elapsed >= dur) {
            handleNext();
          } else {
            setCurrentTime(elapsed);
          }
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [handleNext]);

  // ─── INSTANT RESYNC WHEN SWITCHING BACK TO APP WINDOW ────────────────────
  useEffect(() => {
    const onWindowRegainedFocus = async () => {
      const track = currentTrackRef.current;
      if (!track) return;

      if (track.source === 'local') {
        try {
          const status = await invoke<PlaybackStatus>('get_playback_status');
          setIsPlaying(status.is_playing);
          setCurrentTime(status.current_time_secs);
        } catch {}
      } else if (track.source === 'audius') {
        if (onlineAudioRef.current) {
          setIsPlaying(!onlineAudioRef.current.paused);
          setCurrentTime(onlineAudioRef.current.currentTime);
        }
      } else if (isPlayingRef.current && playStartTimestampRef.current) {
        // Instantly recalculate true elapsed time from real system clock!
        const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
        setCurrentTime(elapsed);
        // Ping YouTube to ensure state is fresh
        if (track.source === 'youtube' && ytIframeRef.current?.contentWindow) {
          ytIframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
        }
      }
    };

    window.addEventListener('focus', onWindowRegainedFocus);
    document.addEventListener('visibilitychange', onWindowRegainedFocus);
    return () => {
      window.removeEventListener('focus', onWindowRegainedFocus);
      document.removeEventListener('visibilitychange', onWindowRegainedFocus);
    };
  }, []);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // YouTube events
        if (data.event === 'onStateChange') {
          if (data.info === 1) setIsPlaying(true);
          else if (data.info === 2) setIsPlaying(false);
          else if (data.info === 0) { setIsPlaying(false); handleNext(); }
        }
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            setCurrentTime(data.info.currentTime);
            accumulatedTimeRef.current = data.info.currentTime;
            if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
          }
          if (typeof data.info.duration === 'number' && data.info.duration > 0) setDuration(data.info.duration);
          if (data.info.playerState === 1) setIsPlaying(true);
          if (data.info.playerState === 2) setIsPlaying(false);
        }

        // SoundCloud Widget events
        const scEvent = data.soundcloudEvent || (typeof data.method === 'string' && ['play', 'pause', 'finish', 'playProgress', 'seek'].includes(data.method) ? data.method : null);
        if (scEvent) {
          if (scEvent === 'play') {
            setIsPlaying(true);
            playStartTimestampRef.current = Date.now();
          }
          if (scEvent === 'pause') {
            setIsPlaying(false);
            if (playStartTimestampRef.current) {
              accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
              playStartTimestampRef.current = null;
            }
          }
          if (scEvent === 'finish') { setIsPlaying(false); handleNext(); }
          if (scEvent === 'playProgress') {
            const rawPos = data.data?.currentPosition ?? data.value?.currentPosition ?? 0;
            const posSecs = rawPos / 1000;
            if (posSecs > 0) {
              setCurrentTime(posSecs);
              accumulatedTimeRef.current = posSecs;
              if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
            }
          }
        }
      } catch { /* ignore non-JSON messages */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [handleNext]);

  // Subscribe to YouTube iframe events after video loads
  useEffect(() => {
    if (!ytVideoId) return;
    const timer = setTimeout(() => {
      if (ytIframeRef.current?.contentWindow) {
        ytIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: 1 }), '*'
        );
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [ytVideoId]);

  // ─── AUDIUS HTML5 audio element (320kbps MP3 direct stream) ──────────────
  useEffect(() => {
    const audio = new Audio();
    onlineAudioRef.current = audio;
    const onTimeUpdate = () => {
      if (currentTrackRef.current?.source === 'audius') {
        setCurrentTime(audio.currentTime);
        if (audio.duration > 0) setDuration(audio.duration);
      }
    };
    const onEnded = () => { setIsPlaying(false); handleNext(); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => { audio.pause(); audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded); };
  }, [handleNext]);

  // ─── LOCAL playback polling ───────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentTrackRef.current?.source !== 'local') return;
      try {
        const status = await invoke<PlaybackStatus>('get_playback_status');
        setIsPlaying(status.is_playing);
        setCurrentTime(status.current_time_secs);
        if (status.duration_secs > 0) setDuration(status.duration_secs);

        // Auto-play next track when local audio finishes
        if (
          status.duration_secs > 0 &&
          status.current_time_secs >= (status.duration_secs - 0.5) &&
          !status.is_playing
        ) {
          handleNext();
        }
      } catch (e) { console.error(e); }
    }, 250);
    return () => clearInterval(interval);
  }, [handleNext]);

  const showNotification = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const sendYtCmd = (func: string, args: unknown[] = []) => {
    if (ytIframeRef.current?.contentWindow) {
      ytIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }), '*'
      );
    }
  };

  const sendScCmd = (method: string, value?: unknown) => {
    if (scIframeRef.current?.contentWindow) {
      scIframeRef.current.contentWindow.postMessage(
        JSON.stringify({ method, value }), '*'
      );
    }
  };

  // ─── Core play function ───────────────────────────────────────────────────
  const playTrackInternal = async (track: Track) => {
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration_secs || 0);
    setIsPlaying(false);

    // Reset Wall-clock timer
    accumulatedTimeRef.current = 0;
    playStartTimestampRef.current = Date.now();

    // Record history to SQLite if logged in
    if (currentUserRef.current) {
      invoke('db_add_history', { userId: currentUserRef.current.id, track }).catch(console.error);
    }

    if (track.source === 'local') {
      // Completely stop YouTube & reset video
      sendYtCmd('stopVideo');
      setYtVideoId(null);
      setShowYoutubeVideo(false);

      // Completely pause & clear SoundCloud
      sendScCmd('pause');
      setScTrackUrl(null);

      onlineAudioRef.current?.pause();
      try {
        await invoke('play_track', { track });
        setIsPlaying(true);
      } catch (err) {
        showNotification(`Lỗi phát nhạc: ${err}`);
      }

    } else if (track.source === 'youtube') {
      try { await invoke('stop_track'); } catch {}
      // Completely pause & clear SoundCloud
      sendScCmd('pause');
      setScTrackUrl(null);

      onlineAudioRef.current?.pause();

      let videoId = track.path_or_url;
      if (videoId.includes('v=')) videoId = videoId.split('v=')[1].split('&')[0];
      setYtVideoId(videoId);
      setIsPlaying(true);
      showNotification(`▶ YouTube Hi-Fi: ${track.title}`);

    } else if (track.source === 'soundcloud') {
      try { await invoke('stop_track'); } catch {}
      // COMPLETELY STOP YOUTUBE & CLEAR VIDEO & HIDE POPUP!
      sendYtCmd('stopVideo');
      setYtVideoId(null);
      setShowYoutubeVideo(false);

      onlineAudioRef.current?.pause();

      setScTrackUrl(track.path_or_url);
      setIsPlaying(true);
      showNotification(`▶ SoundCloud: ${track.title}`);

    } else if (track.source === 'audius') {
      try { await invoke('stop_track'); } catch {}
      // Stop and clear YouTube completely
      sendYtCmd('stopVideo');
      setYtVideoId(null);
      setShowYoutubeVideo(false);

      // Stop and clear SoundCloud completely
      sendScCmd('pause');
      setScTrackUrl(null);

      // Play direct 320kbps Open Stream via HTML5 Audio
      if (onlineAudioRef.current) {
        onlineAudioRef.current.pause();
        onlineAudioRef.current.src = track.path_or_url;
        onlineAudioRef.current.volume = volume;
        onlineAudioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            showNotification(`▶ Audius Hi-Fi 320K: ${track.title}`);
          })
          .catch((err) => {
            console.error(err);
            showNotification('Không thể phát bài hát Audius.');
          });
      }
    }
  };

  const handlePlayTrack = (track: Track) => playTrackInternal(track);

  const handleTogglePlay = async () => {
    const track = currentTrack;
    if (!track) return;

    if (isPlaying) {
      // Transitioning to PAUSE
      if (playStartTimestampRef.current) {
        accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
        playStartTimestampRef.current = null;
      }
      setIsPlaying(false);

      if (track.source === 'local') {
        try { await invoke('pause_track'); } catch {}
      } else if (track.source === 'youtube') {
        sendYtCmd('pauseVideo');
      } else if (track.source === 'soundcloud') {
        sendScCmd('pause');
      } else {
        onlineAudioRef.current?.pause();
      }

    } else {
      // Transitioning to PLAY
      playStartTimestampRef.current = Date.now();
      setIsPlaying(true);

      if (track.source === 'local') {
        try { await invoke('resume_track'); } catch {}
      } else if (track.source === 'youtube') {
        sendYtCmd('playVideo');
      } else if (track.source === 'soundcloud') {
        sendScCmd('play');
      } else {
        onlineAudioRef.current?.play().catch(console.error);
      }
    }
  };

  const handleSeek = async (secs: number) => {
    setCurrentTime(secs);
    accumulatedTimeRef.current = secs;
    if (isPlayingRef.current) {
      playStartTimestampRef.current = Date.now();
    } else {
      playStartTimestampRef.current = null;
    }

    if (currentTrack?.source === 'local') {
      try { await invoke('seek_track', { positionSecs: Math.floor(secs) }); } catch {}
    } else if (currentTrack?.source === 'youtube') {
      sendYtCmd('seekTo', [secs, true]);
    } else if (currentTrack?.source === 'soundcloud') {
      sendScCmd('seekTo', secs * 1000);
    } else if (onlineAudioRef.current) {
      onlineAudioRef.current.currentTime = secs;
    }
  };

  const handleVolumeChange = async (v: number) => {
    setVolume(v);
    try { await invoke('set_volume', { volume: v }); } catch {}
    sendYtCmd('setVolume', [v * 100]);
    sendScCmd('setVolume', v * 100);
    if (onlineAudioRef.current) onlineAudioRef.current.volume = v;
  };

  const handlePrev = () => {
    if (!tracks.length || !currentTrack) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    playTrackInternal(tracks[(idx - 1 + tracks.length) % tracks.length]);
  };

  const handleToggleFavorite = async (trackToFav?: Track) => {
    const target = trackToFav || currentTrack;
    if (!target) return;

    if (currentUser) {
      try {
        const isFav = await invoke<boolean>('db_toggle_favorite', {
          userId: currentUser.id,
          track: target,
        });
        setFavorites(prev => {
          const next = new Set(prev);
          isFav ? next.add(target.id) : next.delete(target.id);
          return next;
        });
        showNotification(isFav ? 'Đã thêm vào yêu thích (SQLite)' : 'Đã bỏ yêu thích');
      } catch (err) {
        console.error(err);
      }
    } else {
      setFavorites(prev => {
        const next = new Set(prev);
        next.has(target.id) ? next.delete(target.id) : next.add(target.id);
        try { localStorage.setItem('soundify_favorites', JSON.stringify([...next])); } catch {}
        return next;
      });
      showNotification('Đã cập nhật yêu thích (Local)');
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Chọn thư mục nhạc' });
      if (selected && typeof selected === 'string') {
        showNotification('Đang quét bằng Rust Engine...');
        const t0 = performance.now();
        const scanned = await invoke<Track[]>('scan_music_folder', { folderPath: selected });
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        setTracks(prev => {
          const existing = new Set(prev.map(t => t.path_or_url));
          return [...prev, ...scanned.filter(t => !existing.has(t.path_or_url))];
        });
        setCurrentView('local');
        showNotification(`⚡ Quét xong ${scanned.length} bài (${elapsed}s)`);
      }
    } catch (err) { showNotification(`Lỗi: ${err}`); }
  };

  const handleSearchOnline = async (query: string, source: string): Promise<SearchResult[]> => {
    try { return await invoke<SearchResult[]>('search_online', { query, source }); }
    catch { return []; }
  };

  const handlePlaySearchResult = (result: SearchResult) => {
    const track: Track = {
      id: `online_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: result.title, artist: result.artist, album: result.album,
      duration_secs: result.duration_secs, path_or_url: result.url_or_id,
      cover_art: result.thumbnail, source: result.source,
    };
    setTracks(prev => [track, ...prev.filter(t => t.id !== track.id)]);
    playTrackInternal(track);
  };

  const displayedTracks = tracks.filter(t => {
    switch (currentView) {
      case 'local': return t.source === 'local';
      case 'youtube': return t.source === 'youtube';
      case 'soundcloud': return t.source === 'soundcloud';
      case 'audius': return t.source === 'audius';
      case 'favorites': return favorites.has(t.id);
      default: return true;
    }
  });

  const localCount = tracks.filter(t => t.source === 'local').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#a0a0a0] overflow-hidden select-none font-sans">
      {/* Toast Notification — Invincible Accent */}
      {statusMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#121216] text-white border border-[#ffe600]/50 px-4 py-2 rounded-lg font-mono text-xs shadow-[0_0_15px_rgba(255,230,0,0.25)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#ffe600]" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* YouTube iframe — single instance toggled by CSS */}
      {ytVideoId && (
        <>
          {showYoutubeVideo && (
            <button
              onClick={() => setShowYoutubeVideo(false)}
              className="fixed bottom-[210px] right-7 z-50 p-1.5 rounded-full bg-black/80 hover:bg-black text-white border border-[#333] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div
            className={`fixed z-40 transition-all duration-300 ${
              showYoutubeVideo
                ? 'bottom-24 right-6 w-80 h-48 rounded-xl bg-black shadow-2xl border border-[#222] opacity-100 overflow-hidden'
                : '-top-px -left-px w-px h-px opacity-0 pointer-events-none overflow-hidden'
            }`}
          >
            <iframe
              ref={ytIframeRef}
              src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
              title="YouTube Player"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </>
      )}

      {/* SoundCloud Widget — hidden player */}
      {scTrackUrl && (
        <div className="fixed -top-1 -left-1 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
          <iframe
            ref={scIframeRef}
            src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(scTrackUrl)}&auto_play=true&hide_related=true&show_artwork=false&show_user=false&show_reposts=false&visual=false&color=%2300e5ff`}
            title="SoundCloud Player"
            className="w-full h-full border-0"
            allow="autoplay"
          />
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onSelectFolder={handleSelectFolder}
          localTrackCount={localCount}
          favoritesCount={favorites.size}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
          {/* Header Bar */}
          <header className="h-14 px-7 flex items-center justify-between border-b border-[#141416] bg-black/90 backdrop-blur z-20">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black tracking-widest text-white uppercase flex items-center gap-2">
                <Disc className="w-4 h-4 text-[#ffe600] drop-shadow-[0_0_6px_#ffe600]" />
                Spytify Invincible Audio
              </span>
              <span className="text-[10px] text-[#00e5ff] bg-[#0c1214] px-2 py-0.5 rounded border border-[#00e5ff]/30 font-mono font-semibold">
                SQLite 3 • Invincible Core
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {currentTrack?.source === 'youtube' && !!ytVideoId && (
                <button
                  onClick={() => setShowYoutubeVideo(p => !p)}
                  className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                    showYoutubeVideo
                      ? 'bg-white text-black border-white'
                      : 'bg-[#0f0f0f] hover:bg-[#1a1a1a] text-[#888] hover:text-white border-[#222]'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  {showYoutubeVideo ? 'Thu nhỏ video' : 'Mở MV YouTube'}
                </button>
              )}
              <button
                onClick={handleSelectFolder}
                className="px-3.5 py-1 bg-[#121212] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded border border-[#222] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#00e5ff]" />
                Quét nhạc
              </button>
            </div>
          </header>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-7 py-5">
            {showVisualizer && currentView !== 'profile' && currentView !== 'ai_mix' && <AudioVisualizer isPlaying={isPlaying} />}

            {currentView === 'ai_mix' ? (
              <AiMixView
                currentUser={currentUser}
                allTracks={tracks}
                onPlayTrack={handlePlayTrack}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                smartDjEnabled={smartDjEnabled}
                onToggleSmartDj={() => setSmartDjEnabled(p => !p)}
              />
            ) : currentView === 'profile' ? (
              <ProfileView
                currentUser={currentUser}
                onLogout={handleLogout}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onPlayTrack={handlePlayTrack}
              />
            ) : currentView === 'search' ? (
              <SearchView
                onPlaySearchResult={handlePlaySearchResult}
                onSearchOnline={handleSearchOnline}
                localTracks={tracks}
                onTrackSelect={handlePlayTrack}
              />
            ) : currentView === 'youtube' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 flex items-center gap-1 font-mono">
                      <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                      YOUTUBE AUDIO STREAM
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">Nghe nhạc YouTube</h2>
                    <p className="text-xs text-[#666] mt-0.5">Truyền tải âm thanh trực tiếp — Hỗ trợ xem MV video thu nhỏ</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-[#00e5ff] text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>Tìm bài hát</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['Sơn Tùng M-TP', 'V-Pop Hot Hits', 'Lo-Fi Chill', 'Alan Walker', 'Nhạc Trẻ 2025', 'The Weeknd'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`Tìm "${t}"...`);
                        const r = await handleSearchOnline(t, 'youtube');
                        if (r.length) handlePlaySearchResult(r[0]);
                      }}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1c1c1c] text-xs text-[#888] hover:text-white rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <YoutubeIcon className="w-3 h-3 text-red-400" />{t}
                    </button>
                  ))}
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            ) : currentView === 'soundcloud' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 flex items-center gap-1 font-mono">
                      <SoundCloudIcon className="w-3.5 h-3.5 text-orange-400" />
                      SOUNDCLOUD STREAM
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">SoundCloud Stream</h2>
                    <p className="text-xs text-[#666] mt-0.5">Kho nhạc Remix, Lo-Fi, Deep House &amp; Indie phong phú</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-[#00e5ff] text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>Tìm bài hát</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['Indie Nhạc Việt', 'Lo-Fi Hip Hop', 'Deep House Mix', 'Phùng Khánh Linh', 'RPT Orijinn', 'Underground Rap VN'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`Tìm "${t}" trên SoundCloud...`);
                        const r = await handleSearchOnline(t, 'soundcloud');
                        if (r.length) handlePlaySearchResult(r[0]);
                      }}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1c1c1c] text-xs text-[#888] hover:text-white rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <SoundCloudIcon className="w-3 h-3 text-orange-400" />{t}
                    </button>
                  ))}
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            ) : (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#0a0a0c] border border-[#1a1a20] flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#ffe600] font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]"></span>
                      {currentView === 'local' ? 'Ổ CỨNG NỘI BỘ' : currentView === 'favorites' ? 'DANH SÁCH YÊU THÍCH (SQLITE)' : currentView === 'audius' ? 'AUDIUS OPEN HI-FI (320KBPS)' : 'TẤT CẢ NGUỒN PHÁT'}
                    </span>
                    <h2 className="text-2xl font-black text-white mt-1 tracking-tight">
                      {currentView === 'local' ? 'Nhạc Lossless trên máy' : currentView === 'favorites' ? 'Bài hát yêu thích' : currentView === 'audius' ? 'Nền Tảng Mở Audius Hi-Fi' : 'Thư viện âm nhạc'}
                    </h2>
                    <p className="text-xs text-[#777] mt-0.5">{displayedTracks.length} bài hát • Đồng bộ cơ sở dữ liệu</p>
                  </div>
                  {displayedTracks.length > 0 && (
                    <button
                      onClick={() => handlePlayTrack(displayedTracks[0])}
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-[#ffe600] to-[#00e5ff] hover:scale-105 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer shadow-[0_0_12px_rgba(255,230,0,0.35)]"
                    >
                      <Disc className="w-5 h-5 text-black" />
                    </button>
                  )}
                </div>
                <TrackTable
                  tracks={displayedTracks}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  favorites={favorites}
                  onTrackSelect={handlePlayTrack}
                  onTogglePlay={handleTogglePlay}
                  onToggleFavorite={(id) => {
                    const t = displayedTracks.find(x => x.id === id);
                    if (t) handleToggleFavorite(t);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Ultra Hi-Fi Player Bar */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isFavorite={currentTrack ? favorites.has(currentTrack.id) : false}
        repeatMode={repeatMode}
        isShuffle={isShuffle}
        onToggleRepeat={() => {
          setRepeatMode(prev => {
            if (prev === 'all') return 'one';
            if (prev === 'one') return 'off';
            return 'all';
          });
        }}
        onToggleShuffle={() => setIsShuffle(p => !p)}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleFavorite={() => currentTrack && handleToggleFavorite(currentTrack)}
        onToggleVisualizer={() => setShowVisualizer(p => !p)}
        showVisualizer={showVisualizer}
      />
    </div>
  );
}
