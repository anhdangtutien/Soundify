import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { HomeTrendingView } from './components/HomeTrendingView';
import { AlbumsView } from './components/AlbumsView';
import { AddToAlbumModal } from './components/AddToAlbumModal';
import { SplashScreen } from './components/SplashScreen';
import { cloudSyncPull, cloudSyncPush, isSupabaseConfigured } from './services/supabase';
import { deduplicateTracks } from './utils/trackUtils';
import { Track, PlaybackStatus, SearchResult, ViewType, User, UserAlbum } from './types';
import { FolderPlus, Disc, CheckCircle2, Tv, X, Radio, ArrowUpRight, LogIn, Sun, Moon } from 'lucide-react';
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
  const [recommendMode, setRecommendMode] = useState<'fresh' | 'mix' | 'off'>(() => {
    return (localStorage.getItem('spytify_recommend_mode') as 'fresh' | 'mix' | 'off') || 'fresh';
  });
  const [repeatMode, setRepeatMode] = useState<'all' | 'one' | 'off'>('all'); // default: auto-play next
  const [isShuffle, setIsShuffle] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('spytify_accent_color') || '#ff2a55';
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
  }, [accentColor]);

  const handleUpdateAccentColor = (newColor: string) => {
    setAccentColor(newColor);
    localStorage.setItem('spytify_accent_color', newColor);
    document.documentElement.style.setProperty('--accent-color', newColor);
    showNotification(`Đã đổi màu chủ đạo: ${newColor}`);
  };

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('spytify_theme_mode') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    if (themeMode === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [themeMode]);

  const handleToggleThemeMode = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('spytify_theme_mode', next);
    showNotification(`Đã chuyển sang ${next === 'light' ? 'Chế độ Sáng (Light Dossier)' : 'Chế độ Tối (Stealth Dark)'}`);
  };

  const handleUpdateAvatar = async (newAvatar: string) => {
    if (currentUser) {
      try {
        await invoke('auth_update_avatar', { userId: currentUser.id, avatar: newAvatar });
        setCurrentUser(prev => prev ? { ...prev, avatar: newAvatar } : null);
        showNotification('Đã cập nhật ảnh đại diện vào SQLite!');
      } catch (e) {
        console.error('Failed to update avatar in DB:', e);
        setCurrentUser(prev => prev ? { ...prev, avatar: newAvatar } : null);
      }
    } else {
      localStorage.setItem('spytify_guest_avatar', newAvatar);
      showNotification('Đã lưu ảnh đại diện!');
    }
  };

  const [albums, setAlbums] = useState<UserAlbum[]>(() => {
    try {
      const stored = localStorage.getItem('spytify_user_albums');
      if (stored) {
        const parsed: UserAlbum[] = JSON.parse(stored);
        return parsed.map(alb => ({
          ...alb,
          tracks: deduplicateTracks(alb.tracks || [])
        }));
      }
      return [];
    } catch {
      return [];
    }
  });
  const [trackToAddToAlbum, setTrackToAddToAlbum] = useState<Track | null>(null);
  const [isAddToAlbumModalOpen, setIsAddToAlbumModalOpen] = useState(false);

  const handleCreateAlbum = (title: string, description: string): UserAlbum => {
    const newAlbum: UserAlbum = {
      id: 'album_' + Date.now(),
      title,
      description,
      tracks: [],
      created_at: new Date().toISOString(),
    };
    setAlbums(prev => {
      const updated = [newAlbum, ...prev];
      localStorage.setItem('spytify_user_albums', JSON.stringify(updated));
      if (currentUserRef.current && isSupabaseConfigured()) {
        cloudSyncPush(currentUserRef.current.id, { albums: updated }).catch(console.error);
      }
      return updated;
    });
    showNotification('Đã tạo album: ' + title);
    return newAlbum;
  };

  const handleDeleteAlbum = (albumId: string) => {
    setAlbums(prev => {
      const updated = prev.filter(a => a.id !== albumId);
      localStorage.setItem('spytify_user_albums', JSON.stringify(updated));
      return updated;
    });
    showNotification('Đã xóa album');
  };

  const handleAddTrackToAlbum = (albumId: string, track: Track) => {
    let wasAlreadyPresent = false;
    setAlbums(prev => {
      const updated = prev.map(a => {
        if (a.id === albumId) {
          const normTitle = track.title.trim().toLowerCase();
          if (a.tracks.some(t => t.id === track.id || t.title.trim().toLowerCase() === normTitle)) {
            wasAlreadyPresent = true;
            return a;
          }
          return { ...a, tracks: deduplicateTracks([...a.tracks, track]) };
        }
        return a;
      });
      localStorage.setItem('spytify_user_albums', JSON.stringify(updated));
      return updated;
    });
    if (wasAlreadyPresent) {
      showNotification('Bài hát đã có trong album này!');
    } else {
      showNotification('Đã thêm bài hát vào album!');
    }
  };

  const handleRemoveTrackFromAlbum = (albumId: string, trackId: string) => {
    setAlbums(prev => {
      const updated = prev.map(a => {
        if (a.id === albumId) {
          return { ...a, tracks: a.tracks.filter(t => t.id !== trackId) };
        }
        return a;
      });
      localStorage.setItem('spytify_user_albums', JSON.stringify(updated));
      return updated;
    });
    showNotification('Đã gỡ bài hát khỏi album');
  };

  const handlePlayAlbum = (album: UserAlbum) => {
    if (album.tracks.length > 0) {
      setTracks(album.tracks);
      playTrackInternal(album.tracks[0]);
      showNotification('▶ Đang phát album: ' + album.title);
    }
  };


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
  const displayedTracksRef = useRef<Track[]>([]);
  const currentUserRef = useRef<User | null>(null);
  const repeatModeRef = useRef<'all' | 'one' | 'off'>('all');
  const recommendModeRef = useRef<'fresh' | 'mix' | 'off'>('fresh');
  const isShuffleRef = useRef(false);
  const playStartTimestampRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);

  // Set of all track titles & IDs already listened to (persisted from SQLite & session)
  const listenedHistoryTitlesRef = useRef<Set<string>>(new Set());

  // Keep refs in sync
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { recommendModeRef.current = recommendMode; }, [recommendMode]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);

  // Load history from SQLite to seed listenedHistoryTitlesRef
  useEffect(() => {
    const targetUserId = currentUser?.id || 'guest_spy';
    invoke<any[]>('db_get_history', { userId: targetUserId, limit: 300 })
      .then(hist => {
        if (hist && Array.isArray(hist)) {
          hist.forEach(h => {
            if (h.track_title) listenedHistoryTitlesRef.current.add(h.track_title.trim().toLowerCase());
            if (h.track_id) listenedHistoryTitlesRef.current.add(h.track_id.toLowerCase());
            if (h.path_or_url) listenedHistoryTitlesRef.current.add(h.path_or_url.toLowerCase());
          });
        }
      })
      .catch(() => {});
  }, [currentUser]);

  // ─── RESTORE USER SESSION FROM SQLITE ──────────────────────────────────────
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
        return deduplicateTracks([...dbFavs, ...prev]);
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

    // Auto-sync with Supabase Cloud if configured
    if (isSupabaseConfigured()) {
      cloudSyncPull(user.id).then(cloudData => {
        if (cloudData) {
          if (cloudData.albums && cloudData.albums.length > 0) {
            setAlbums(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const newAlbums = cloudData.albums.filter(a => !existingIds.has(a.id));
              const merged = [...prev, ...newAlbums];
              localStorage.setItem('spytify_user_albums', JSON.stringify(merged));
              return merged;
            });
          }
          if (cloudData.avatar && !user.avatar) {
            setCurrentUser(prev => prev ? { ...prev, avatar: cloudData.avatar } : null);
          }
          if (cloudData.accentColor) {
            handleUpdateAccentColor(cloudData.accentColor);
          }
          showNotification(`🟢 Đã tự động đồng bộ Supabase Cloud cho @${user.username}`);
        }
      }).catch(console.error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('soundify_active_user_id');
    showNotification('Đã đăng xuất tài khoản');
    setCurrentView('library');
  };

  const handleCycleRecommendMode = () => {
    setRecommendMode(prev => {
      let next: 'fresh' | 'mix' | 'off';
      if (prev === 'fresh') next = 'mix';
      else if (prev === 'mix') next = 'off';
      else next = 'fresh';
      localStorage.setItem('spytify_recommend_mode', next);
      if (next === 'fresh') {
        showNotification('🌟 Chế độ Khám phá YouTube MỚI (Tự động tìm bài CHƯA TỪNG NGHE)');
      } else if (next === 'mix') {
        showNotification('🎵 Chế độ Pha trộn Smart Mix (Nghe lại bài quen thuộc + bài mới)');
      } else {
        showNotification('⏹ Đã tắt Chế độ Đề xuất (Phát tuần tự danh sách)');
      }
      return next;
    });
  };

  // ─── AUTO-PLAY NEXT TRACK & AUTO-RECOMMEND ENGINE ──────────────────────────
  const handleNext = useCallback(async (isManualSkip = false) => {
    const all = tracksRef.current;
    const cur = currentTrackRef.current;
    if (!all.length) return;

    // 1. Repeat single track mode (only when track ends naturally, not on manual skip)
    if (!isManualSkip && repeatModeRef.current === 'one' && cur) {
      playTrackInternal(cur);
      return;
    }

    // 2. Repeat off and NOT in recommendation mode (only when track ends naturally)
    if (!isManualSkip && repeatModeRef.current === 'off' && recommendModeRef.current === 'off') {
      setIsPlaying(false);
      return;
    }

    // 3. Shuffle mode within playlist
    if (isShuffleRef.current && all.length > 1 && recommendModeRef.current === 'off') {
      const remaining = all.filter(t => t.id !== cur?.id);
      const randomTrack = remaining[Math.floor(Math.random() * remaining.length)];
      if (randomTrack) {
        playTrackInternal(randomTrack);
        return;
      }
    }

    // 4. CHẾ ĐỘ ĐỀ XUẤT NHẠC TIẾP THEO (FRESH DISCOVERY vs SMART MIX)
    if (recommendModeRef.current !== 'off' && cur) {
      const mode = recommendModeRef.current;

      // 4A. CHẾ ĐỘ 'fresh': 100% ƯU TIÊN BÀI MỚI TỪ YOUTUBE MÀ NGƯỜI DÙNG CHƯA TỪNG NGHE
      if (mode === 'fresh') {
        try {
          showNotification(`🌟 Đang tìm bài MỚI cùng phong cách với ${cur.artist} trên YouTube...`);
          const related = await invoke<SearchResult[]>('get_related_tracks', {
            title: cur.title,
            artist: cur.artist,
          });

          if (related && related.length > 0) {
            const listened = listenedHistoryTitlesRef.current;
            const curTitleNorm = cur.title.trim().toLowerCase();

            // Filter out tracks already heard in history or currently in playlist
            const unlistened = related.filter(r => {
              const rTitle = r.title.trim().toLowerCase();
              const rId = r.url_or_id.toLowerCase();
              if (rTitle === curTitleNorm || rTitle.includes(curTitleNorm) || curTitleNorm.includes(rTitle)) return false;
              if (listened.has(rTitle) || listened.has(rId)) return false;
              if (all.some(t => t.id.toLowerCase() === rId || t.title.trim().toLowerCase() === rTitle)) return false;
              return true;
            });

            // Pick the first completely fresh unheard song from YouTube
            const candidate = unlistened.length > 0 ? unlistened[0] : (
              related.find(r => r.title.trim().toLowerCase() !== curTitleNorm) || related[0]
            );

            if (candidate) {
              const newTrack: Track = {
                id: `yt_fresh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                title: candidate.title,
                artist: candidate.artist,
                album: candidate.album || 'YouTube Discovery',
                duration_secs: candidate.duration_secs || 210,
                path_or_url: candidate.url_or_id,
                cover_art: candidate.thumbnail,
                source: candidate.source,
              };

              setTracks(prev => deduplicateTracks([...prev, newTrack]));
              playTrackInternal(newTrack);
              showNotification(`🌟 Khám phá bài mới: ${newTrack.title} - ${newTrack.artist}`);
              return;
            }
          }
        } catch (err) {
          console.error('Error discovering fresh track from YouTube:', err);
        }
      }

      // 4B. CHẾ ĐỘ 'mix': PHA TRỘN GIỮA BÀI QUEN THUỘC TRONG THƯ VIỆN & BÀI MỚI
      if (mode === 'mix') {
        // If we have multiple tracks in playlist, chance to pick from library via AI Smart DJ
        if (all.length > 1 && Math.random() > 0.35) {
          try {
            const nextAiTrack = await invoke<Track | null>('ai_smart_dj_next', {
              currentTrack: cur,
              candidates: all,
            });
            if (nextAiTrack && nextAiTrack.id !== cur.id) {
              playTrackInternal(nextAiTrack);
              showNotification(`🎵 Pha trộn: ${nextAiTrack.title}`);
              return;
            }
          } catch (e) {
            console.error('AI Smart DJ error:', e);
          }
        }

        // Fetch YouTube related
        try {
          const related = await invoke<SearchResult[]>('get_related_tracks', {
            title: cur.title,
            artist: cur.artist,
          });

          if (related && related.length > 0) {
            const curTitleNorm = cur.title.trim().toLowerCase();
            const candidates = related.filter(r => r.title.trim().toLowerCase() !== curTitleNorm);
            const pick = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : related[0];

            const newTrack: Track = {
              id: `mix_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: pick.title,
              artist: pick.artist,
              album: pick.album || 'Smart Mix',
              duration_secs: pick.duration_secs || 210,
              path_or_url: pick.url_or_id,
              cover_art: pick.thumbnail,
              source: pick.source,
            };

            setTracks(prev => deduplicateTracks([...prev, newTrack]));
            playTrackInternal(newTrack);
            showNotification(`🎵 Đề xuất Mix: ${newTrack.title} - ${newTrack.artist}`);
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    // 5. Default sequential next
    if (!cur) {
      playTrackInternal(all[0]);
      return;
    }

    const idx = all.findIndex(t => t.id === cur.id);
    const nextTrack = all[(idx + 1) % all.length];
    playTrackInternal(nextTrack);
  }, [recommendMode]);

  // â”€â”€â”€ WALL-CLOCK TIME TICKER (IMMUNE TO BACKGROUND TAB THROTTLING) â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ INSTANT RESYNC WHEN SWITCHING BACK TO APP WINDOW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          if (currentTrackRef.current?.source !== 'youtube') return;
          if (data.info === 1) setIsPlaying(true);
          else if (data.info === 2) setIsPlaying(false);
          else if (data.info === 0) { setIsPlaying(false); handleNext(); }
        }
        if (data.event === 'infoDelivery' && data.info) {
          if (currentTrackRef.current?.source !== 'youtube') return;
          if (typeof data.info.currentTime === 'number') {
            const rawCur = data.info.currentTime;
            // Guard against YouTube Live streams sending epoch timestamps (>86400 seconds)
            if (rawCur > 86400) {
              setDuration(0);
            } else if (rawCur >= 0) {
              setCurrentTime(rawCur);
              accumulatedTimeRef.current = rawCur;
              if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
            }
          }
          if (typeof data.info.duration === 'number') {
            if (data.info.duration > 0 && data.info.duration < 86400) {
              setDuration(data.info.duration);
            } else if (data.info.duration === 0) {
              setDuration(0);
            }
          }
          if (data.info.playerState === 1) setIsPlaying(true);
          if (data.info.playerState === 2) setIsPlaying(false);
        }

        // SoundCloud Widget events
        const scEvent = data.soundcloudEvent || (typeof data.method === 'string' && ['play', 'pause', 'finish', 'playProgress', 'seek'].includes(data.method) ? data.method : null);
        if (scEvent) {
          if (currentTrackRef.current?.source !== 'soundcloud') return;

          // Extract duration from SoundCloud widget events if provided
          const rawDur = data.data?.duration ?? data.value?.duration ?? data.duration;
          if (typeof rawDur === 'number' && rawDur > 0) {
            const durSecs = Math.round(rawDur / 1000);
            if (durSecs > 0 && durSecs < 86400) setDuration(durSecs);
          }
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

  // â”€â”€â”€ AUDIUS HTML5 audio element (320kbps MP3 direct stream) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ LOCAL playback polling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Core play function â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const playTrackInternal = async (track: Track) => {
    currentTrackRef.current = track;
    setCurrentTrack(track);
    setCurrentTime(0);

    const isLiveTrack = !track.duration_secs ||
      track.duration_secs <= 0 ||
      track.title.toLowerCase().includes('live') ||
      track.title.toLowerCase().includes('trực tiếp') ||
      track.title.toLowerCase().includes('24/7') ||
      track.title.toLowerCase().includes('radio');

    setDuration(isLiveTrack ? 0 : (track.duration_secs || 0));
    setIsPlaying(false);

    // Reset Wall-clock timer
    accumulatedTimeRef.current = 0;
    playStartTimestampRef.current = Date.now();

    // Record history to SQLite if logged in
    if (currentUserRef.current) {
      invoke('db_add_history', { userId: currentUserRef.current.id, track }).catch(console.error);
    }
    // Record into in-memory listened set to prevent repeating in 'fresh' mode
    if (track.title) listenedHistoryTitlesRef.current.add(track.title.trim().toLowerCase());
    if (track.id) listenedHistoryTitlesRef.current.add(track.id.toLowerCase());
    if (track.path_or_url) listenedHistoryTitlesRef.current.add(track.path_or_url.toLowerCase());

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

      let videoId = track.path_or_url || track.id;
      if (videoId.startsWith('yt_')) videoId = videoId.replace('yt_', '');
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

      let scUrl = track.path_or_url;
      if (!scUrl || !scUrl.startsWith('http')) {
        // Fallback: search online on soundcloud
        showNotification(`Đang tìm nguồn SoundCloud cho: ${track.title}...`);
        try {
          const res = await invoke<SearchResult[]>('search_online', { query: `${track.title} ${track.artist}`, source: 'soundcloud' });
          if (res && res.length > 0) {
            scUrl = res[0].url_or_id;
          }
        } catch {}
      }
      if (scUrl) {
        setScTrackUrl(scUrl);
        setIsPlaying(true);
        showNotification(`▶ SoundCloud: ${track.title}`);
      } else {
        showNotification('Không tìm thấy nguồn SoundCloud.');
      }

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
    if (!currentTrack) return;
    // Don't seek on live streams or invalid durations to avoid crashes
    const effDur = duration > 0 ? duration : (currentTrack.duration_secs || 0);
    if (effDur <= 0) return;
    const lowerTitle = currentTrack.title.toLowerCase();
    if (lowerTitle.includes('live') || lowerTitle.includes('trực tiếp') || lowerTitle.includes('24/7')) return;

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

  
  const handleUserNext = () => {
    // When recommendation mode is active (Fresh Discovery or Smart Mix), follow the recommendation engine
    if (recommendModeRef.current !== 'off') {
      handleNext(true);
      return;
    }

    const list = displayedTracksRef.current.length > 0 ? displayedTracksRef.current : (tracksRef.current.length > 0 ? tracksRef.current : tracks);
    if (!list.length || !currentTrackRef.current) return;
    const curId = currentTrackRef.current.id;
    const idx = list.findIndex(t => t.id === curId);
    if (idx === -1) {
      playTrackInternal(list[0]);
    } else {
      const nextIdx = (idx + 1) % list.length;
      playTrackInternal(list[nextIdx]);
    }
  };

  const handleUserPrev = () => {
    const list = displayedTracksRef.current.length > 0 ? displayedTracksRef.current : (tracksRef.current.length > 0 ? tracksRef.current : tracks);
    if (!list.length || !currentTrackRef.current) return;
    const curId = currentTrackRef.current.id;
    const idx = list.findIndex(t => t.id === curId);
    if (idx === -1) {
      playTrackInternal(list[list.length - 1]);
    } else {
      const prevIdx = (idx - 1 + list.length) % list.length;
      playTrackInternal(list[prevIdx]);
    }
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
          return deduplicateTracks([...prev, ...scanned]);
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

  const displayedTracks = useMemo(() => {
    const filtered = tracks.filter(t => {
      switch (currentView) {
        case 'local': return t.source === 'local';
        case 'youtube': return t.source === 'youtube';
        case 'soundcloud': return t.source === 'soundcloud';
        case 'audius': return t.source === 'audius';
        case 'favorites': return favorites.has(t.id);
        default: return true;
      }
    });
    return deduplicateTracks(filtered);
  }, [tracks, currentView, favorites]);

  displayedTracksRef.current = displayedTracks;
  const localCount = tracks.filter(t => t.source === 'local').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#a0a0a0] overflow-hidden select-none font-sans">
      {/* Spy Cinematic Startup Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      {/* Toast Notification â€” Invincible Accent */}
      {statusMessage && (
        <div 
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl font-mono text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200 border shadow-lg backdrop-blur-md"
          style={{
            backgroundColor: themeMode === 'light' ? '#ffffff' : '#0e0e14',
            color: themeMode === 'light' ? '#0f172a' : '#ffffff',
            borderColor: `${accentColor}60`,
            boxShadow: themeMode === 'light' 
              ? `0 4px 20px rgba(0,0,0,0.1), 0 0 12px ${accentColor}30` 
              : `0 4px 25px rgba(0,0,0,0.6), 0 0 15px ${accentColor}40`
          }}
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          <span className="font-semibold tracking-wide" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
            {statusMessage}
          </span>
        </div>
      )}

      <AddToAlbumModal
        isOpen={isAddToAlbumModalOpen}
        onClose={() => {
          setIsAddToAlbumModalOpen(false);
          setTrackToAddToAlbum(null);
        }}
        trackToAdd={trackToAddToAlbum}
        albums={albums}
        onAddTrackToAlbum={handleAddTrackToAlbum}
        onCreateAlbum={handleCreateAlbum}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* YouTube iframe â€” single instance toggled by CSS */}
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

      {/* SoundCloud Widget â€” hidden player */}
      {scTrackUrl && (
        <div className="fixed -top-1 -left-1 w-1 h-1 overflow-hidden opacity-0 pointer-events-none">
          <iframe
            key={scTrackUrl}
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
          albumCount={albums.length}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          accentColor={accentColor}
          themeMode={themeMode}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
          {/* Header Bar â€” Minimalist */}
          <header className="h-12 px-6 flex items-center justify-between border-b border-[#141416] bg-black/95 backdrop-blur z-20">
            <div className="flex items-center gap-2.5 text-xs font-medium text-white">
              <img src="/spytify-logo.png" alt="Spytify" className="w-5 h-5 rounded-md object-cover border border-[#262632]" />
              <span className="tracking-tight font-bold">Spytify</span>
            </div>
            <div className="flex items-center gap-2.5">
              {currentTrack?.source === 'youtube' && !!ytVideoId && (
                <button
                  onClick={() => setShowYoutubeVideo(p => !p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                    showYoutubeVideo
                      ? 'bg-white text-black border-white'
                      : 'bg-[#0f0f0f] hover:bg-[#1a1a1a] text-[#888] hover:text-white border-[#222]'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  {showYoutubeVideo ? 'Thu nhỏ' : 'MV'}
                </button>
              )}
              <button
                onClick={handleSelectFolder}
                className="px-3 py-1 bg-[#121212] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-md border border-[#222] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-white" />
                Chọn thư mục
              </button>
            </div>
          </header>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-7 py-5">
            {showVisualizer && currentView !== 'profile' && currentView !== 'ai_mix' && <AudioVisualizer isPlaying={isPlaying} />}

            {currentView === 'albums' ? (
              <AlbumsView
                albums={albums}
                onCreateAlbum={handleCreateAlbum}
                onDeleteAlbum={handleDeleteAlbum}
                onRemoveTrackFromAlbum={handleRemoveTrackFromAlbum}
                onPlayTrack={handlePlayTrack}
                onPlayAlbum={handlePlayAlbum}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                favorites={favorites}
                onToggleFavorite={(id) => {
                  const t = displayedTracks.find(x => x.id === id) || {
                    id, title: 'Bài hát', artist: 'Nghệ sĩ', album: 'Spytify', duration_secs: 180, path_or_url: '', source: 'youtube'
                  };
                  handleToggleFavorite(t);
                }}
                onTogglePlay={handleTogglePlay}
              />
            ) : currentView === 'library' ? (
              <HomeTrendingView
                accentColor={accentColor}
                onPlaySearchResult={handlePlaySearchResult}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                favorites={favorites}
                onToggleFavorite={(id) => {
                  const t = displayedTracks.find(x => x.id === id) || {
                    id, title: 'Bài hát', artist: 'Nghệ sĩ', album: 'Spytify', duration_secs: 180, path_or_url: '', source: 'youtube'
                  };
                  handleToggleFavorite(t);
                }}
              />
            ) : currentView === 'ai_mix' ? (
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
                accentColor={accentColor}
                themeMode={themeMode}
                onUpdateAccentColor={handleUpdateAccentColor}
                onToggleThemeMode={handleToggleThemeMode}
                onUpdateAvatar={handleUpdateAvatar}
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
                    <p className="text-xs text-[#666] mt-0.5">Truyền tải âm thanh trực tiếp từ YouTube - Hỗ trợ xem MV thu nhỏ</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-[#ff2a55] text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
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
                    <p className="text-xs text-[#666] mt-0.5">Kho nhạc Remix, Lo-Fi, Deep House & Indie phong phú</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-[#ff2a55] text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-color,#ff2a55)] font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color,#ff2a55)]"></span>
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
                      className="w-11 h-11 rounded-full bg-white hover:bg-[var(--accent-color,#ff2a55)] hover:text-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition-all cursor-pointer shadow-[0_0_12px_rgba(255,255,255,0.25)]"
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
        onPrev={handleUserPrev}
        onNext={handleUserNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleFavorite={() => currentTrack && handleToggleFavorite(currentTrack)}
        accentColor={accentColor}
        onAddToAlbum={() => {
          if (currentTrack) {
            setTrackToAddToAlbum(currentTrack);
            setIsAddToAlbumModalOpen(true);
          }
        }}
        onToggleVisualizer={() => setShowVisualizer(p => !p)}
        showVisualizer={showVisualizer}
        themeMode={themeMode}
        recommendMode={recommendMode}
        onCycleRecommendMode={handleCycleRecommendMode}
      />
    </div>
  );
}
