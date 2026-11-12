import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
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
import { deduplicateTracks, optimizeThumbnailUrl } from './utils/trackUtils';
import { Track, PlaybackStatus, SearchResult, ViewType, User, UserAlbum } from './types';
import { FolderPlus, Disc, CheckCircle2, Tv, X, Radio, ArrowUpRight, LogIn, Sun, Moon, Music, Play, Globe, Languages, ChevronDown, ChevronUp, EyeOff } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon } from './components/Icons';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from './locales/i18n';

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

  // Download & Offline Music Storage State
  const [downloadFolder, setDownloadFolder] = useState<string>(() => {
    return localStorage.getItem('spytify_download_folder') || '';
  });
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!downloadFolder) {
      invoke<string>('get_default_download_directory')
        .then(dir => {
          if (dir) {
            setDownloadFolder(dir);
            localStorage.setItem('spytify_download_folder', dir);
          }
        })
        .catch(console.error);
    }
  }, []);

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
    showNotification(`${getTranslation(language, 'toast.colorUpdated')} ${newColor}`);
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
    showNotification(next === 'light' ? getTranslation(language, 'toast.themeLight') : getTranslation(language, 'toast.themeDark'));
  };

  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('spytify_language') as LanguageCode;
    const valid: LanguageCode[] = ['vi', 'en-US', 'ja', 'zh-CN'];
    return valid.includes(saved) ? saved : 'vi';
  });

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLanguageDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setShowLanguageDropdown(false);
  }, [currentView]);

  const handleUpdateLanguage = (newLang: LanguageCode) => {
    setLanguage(newLang);
    localStorage.setItem('spytify_language', newLang);
    setShowLanguageDropdown(false);
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === newLang);
    showNotification(`${getTranslation(newLang, 'toast.langChanged')} ${langInfo ? `${langInfo.flag} ${langInfo.nativeName}` : newLang}`);
  };

  // ─── SLEEP TIMER (HẸN GIỜ TẮT NHẠC) ───────────────────────────
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemainingSecs, setSleepTimerRemainingSecs] = useState<number | null>(null);
  const sleepTimerMinutesRef = useRef<number | null>(null);
  sleepTimerMinutesRef.current = sleepTimerMinutes;

  useEffect(() => {
    if (sleepTimerRemainingSecs === null) return;

    if (sleepTimerRemainingSecs <= 0) {
      setIsPlaying(false);
      sendYtCmd('stopVideo');
      sendScCmd('pause');
      onlineAudioRef.current?.pause();
      try { invoke('stop_track'); } catch {}

      setSleepTimerMinutes(null);
      setSleepTimerRemainingSecs(null);
      showNotification(getTranslation(language, 'timer.timeoutNotification'));
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerRemainingSecs(prev => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemainingSecs, language]);

  const handleSetSleepTimer = (minutes: number | null) => {
    if (minutes === null) {
      setSleepTimerMinutes(null);
      setSleepTimerRemainingSecs(null);
      showNotification(getTranslation(language, 'timer.canceledNotification'));
      return;
    }

    if (minutes === 0) {
      setSleepTimerMinutes(0);
      setSleepTimerRemainingSecs(null);
      showNotification(getTranslation(language, 'timer.setEndNotification'));
      return;
    }

    setSleepTimerMinutes(minutes);
    setSleepTimerRemainingSecs(minutes * 60);
    showNotification(getTranslation(language, 'timer.setNotification', { time: `${minutes} ${getTranslation(language, 'timer.minutes')}` }));
  };

  const handleUpdateAvatar = async (newAvatar: string) => {
    if (currentUser) {
      try {
        await invoke('auth_update_avatar', { userId: currentUser.id, avatar: newAvatar });
        setCurrentUser(prev => prev ? { ...prev, avatar: newAvatar } : null);
        showNotification(getTranslation(language, 'toast.avatarUpdated'));
      } catch (e) {
        console.error('Failed to update avatar in DB:', e);
        setCurrentUser(prev => prev ? { ...prev, avatar: newAvatar } : null);
      }
    } else {
      localStorage.setItem('spytify_guest_avatar', newAvatar);
      showNotification(getTranslation(language, 'toast.avatarSaved'));
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
    showNotification(`${getTranslation(language, 'toast.albumCreated')}: ${title}`);
    return newAlbum;
  };

  const handleDeleteAlbum = (albumId: string) => {
    setAlbums(prev => {
      const updated = prev.filter(a => a.id !== albumId);
      localStorage.setItem('spytify_user_albums', JSON.stringify(updated));
      return updated;
    });
    showNotification(getTranslation(language, 'toast.albumDeleted'));
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
      showNotification(getTranslation(language, 'toast.albumTrackExists'));
    } else {
      showNotification(getTranslation(language, 'toast.addedToAlbum'));
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
    showNotification(getTranslation(language, 'toast.trackRemovedFromAlbum'));
  };

  const handlePlayAlbum = (album: UserAlbum) => {
    if (album.tracks.length > 0) {
      setTracks(album.tracks);
      playTrackInternal(album.tracks[0]);
      showNotification(`${getTranslation(language, 'toast.playingAlbum')}: ${album.title}`);
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

  // Next Track Floating Pop-up state & timer
  interface NextTrackPopupData {
    title: string;
    artist: string;
    thumbnail?: string;
    source: string;
    modeLabel: string;
    isCountdown?: boolean;
    remainingSecs?: number;
    alternatives?: Track[];
  }
  const [nextTrackPopup, setNextTrackPopup] = useState<NextTrackPopupData | null>(null);
  const [isNextTrackPopupCollapsed, setIsNextTrackPopupCollapsed] = useState(false);
  const nextTrackPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endOfTrackPopupShownForRef = useRef<string | null>(null);
  const preloadedAlternativesRef = useRef<Track[]>([]);
  const preloadedNextTrackRef = useRef<Track | null>(null);
  const [preloadedNextTrack, setPreloadedNextTrack] = useState<Track | null>(null);
  const [isNextTrackPopupEnabled, setIsNextTrackPopupEnabled] = useState<boolean>(() => {
    return localStorage.getItem('spytify_next_popup_enabled') !== 'false';
  });
  const isNextTrackPopupEnabledRef = useRef(isNextTrackPopupEnabled);
  useEffect(() => {
    isNextTrackPopupEnabledRef.current = isNextTrackPopupEnabled;
  }, [isNextTrackPopupEnabled]);

  const isSkippingRef = useRef(false);
  const playbackHistoryStackRef = useRef<Track[]>([]);
  const playbackForwardStackRef = useRef<Track[]>([]);

  const handleToggleNextTrackPopupEnabled = () => {
    setIsNextTrackPopupEnabled(prev => {
      const nextVal = !prev;
      localStorage.setItem('spytify_next_popup_enabled', String(nextVal));
      if (!nextVal) {
        setNextTrackPopup(null);
        showNotification(getTranslation(language, 'popup.disabledToast'));
      } else {
        showNotification(getTranslation(language, 'popup.enabledToast'));
      }
      return nextVal;
    });
  };

  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const triggerNextTrackPopup = (track: Track, modeLabel?: string) => {
    if (!isNextTrackPopupEnabledRef.current) return;
    setNextTrackPopup({
      title: track.title,
      artist: track.artist,
      thumbnail: track.cover_art || undefined,
      source: track.source,
      modeLabel: modeLabel || (
        recommendModeRef.current === 'fresh' ? getTranslation(language, 'mode.freshPopup') :
        recommendModeRef.current === 'mix' ? getTranslation(language, 'mode.mixPopup') :
        getTranslation(language, 'mode.queuePopup')
      ),
      isCountdown: false,
      alternatives: preloadedAlternativesRef.current.slice(0, 3),
    });
  };

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

  // Pre-fetch related tracks and alternatives when currentTrack changes
  useEffect(() => {
    if (!currentTrack) {
      preloadedAlternativesRef.current = [];
      preloadedNextTrackRef.current = null;
      setPreloadedNextTrack(null);
      return;
    }
    endOfTrackPopupShownForRef.current = null;

    const fetchUpcoming = async () => {
      try {
        const related = await invoke<SearchResult[]>('get_related_tracks', {
          title: currentTrack.title,
          artist: currentTrack.artist,
        });

        if (related && related.length > 0) {
          const listened = listenedHistoryTitlesRef.current;
          const curTitleLower = currentTrack.title.toLowerCase();

          const candidates = related.filter(r => {
            const rTitle = r.title.toLowerCase();
            return !rTitle.includes(curTitleLower) && !curTitleLower.includes(rTitle) && !listened.has(rTitle);
          }).map((r): Track => ({
            id: `${r.source}_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: r.title,
            artist: r.artist,
            album: r.album || 'Gợi ý cùng thể loại',
            duration_secs: r.duration_secs || 210,
            path_or_url: r.url_or_id,
            cover_art: r.thumbnail,
            source: r.source,
          }));

          if (candidates.length > 0) {
            preloadedNextTrackRef.current = candidates[0];
            setPreloadedNextTrack(candidates[0]);
            preloadedAlternativesRef.current = candidates.slice(1, 6);
            if (isNextTrackPopupEnabledRef.current) {
              setNextTrackPopup({
                title: candidates[0].title,
                artist: candidates[0].artist,
                thumbnail: candidates[0].cover_art || undefined,
                source: candidates[0].source,
                modeLabel: recommendModeRef.current === 'fresh' ? getTranslation(language, 'mode.freshPopup') : getTranslation(language, 'mode.mixPopup'),
                isCountdown: false,
                alternatives: candidates.slice(1, 4),
              });
            }
          }
        }
      } catch (err) {
        console.error('Error prefetching upcoming songs:', err);
      }
    };

    fetchUpcoming();
  }, [currentTrack]);

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
    showNotification(getTranslation(language, 'toast.welcomeUser', { name: user.display_name }));

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
          showNotification(`🟢 ${getTranslation(language, 'toast.cloudSynced')} @${user.username}`);
        }
      }).catch(console.error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('soundify_active_user_id');
    showNotification(getTranslation(language, 'toast.loggedOut'));
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
        showNotification(getTranslation(language, 'toast.modeFresh'));
      } else if (next === 'mix') {
        showNotification(getTranslation(language, 'toast.modeMix'));
      } else {
        showNotification(getTranslation(language, 'toast.modeOff'));
      }
      return next;
    });
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

  const upcomingTrack = useMemo(() => {
    if (!currentTrack || displayedTracks.length === 0) return null;
    const idx = displayedTracks.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1 && idx < displayedTracks.length - 1) {
      return displayedTracks[idx + 1];
    }
    if (displayedTracks.length > 0) return displayedTracks[0];
    return null;
  }, [currentTrack, displayedTracks]);

  const effectiveUpcomingTrack = useMemo(() => {
    if (recommendMode !== 'off') {
      return preloadedNextTrack;
    }
    return upcomingTrack;
  }, [recommendMode, preloadedNextTrack, upcomingTrack]);

  // ─── AUTO-PLAY NEXT TRACK & AUTO-RECOMMEND ENGINE ──────────────────────────
  const handleNext = useCallback(async (isManualSkip = false) => {
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    playStartTimestampRef.current = null;
    accumulatedTimeRef.current = 0;

    try {
      const all = tracksRef.current;
      const cur = currentTrackRef.current;
      if (!all.length) return;

      // 0. Check if sleep timer is set to "End of current track"
      if (!isManualSkip && sleepTimerMinutesRef.current === 0) {
        setIsPlaying(false);
        sendYtCmd('stopVideo');
        sendScCmd('pause');
        onlineAudioRef.current?.pause();
        try { invoke('stop_track'); } catch {}
        setSleepTimerMinutes(null);
        setSleepTimerRemainingSecs(null);
        showNotification(getTranslation(language, 'timer.timeoutNotification'));
        return;
      }

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
          triggerNextTrackPopup(randomTrack, getTranslation(language, 'mode.randomPopup'));
          playTrackInternal(randomTrack);
          return;
        }
      }

      // 4. CHẾ ĐỘ ĐỀ XUẤT NHẠC TIẾP THEO (FRESH DISCOVERY vs SMART MIX)
      if (recommendModeRef.current !== 'off') {
        // Fast path: nếu đã tải sẵn bài đề xuất trong bộ đệm, phát ngay lập tức không cần fetch lại!
        if (preloadedNextTrackRef.current) {
          const next = preloadedNextTrackRef.current;
          preloadedNextTrackRef.current = null;
          setPreloadedNextTrack(null);
          setTracks(prev => deduplicateTracks([...prev, next]));
          triggerNextTrackPopup(
            next,
            recommendModeRef.current === 'fresh'
              ? getTranslation(language, 'mode.freshPopup')
              : getTranslation(language, 'mode.mixPopup')
          );
          playTrackInternal(next);
          const srcLabel = next.source === 'soundcloud' ? 'SoundCloud' : next.source === 'audius' ? 'Audius 320K' : 'YouTube';
          showNotification(`🌟 ${getTranslation(language, 'toast.newDiscovery')} [${srcLabel}]: ${next.title} - ${next.artist}`);
          return;
        }

        const mode = recommendModeRef.current;
        if (cur) {
          // 4A. CHẾ ĐỘ 'fresh': 100% ƯU TIÊN BÀI MỚI NGẪU NHIÊN TỪ YOUTUBE, SOUNDCLOUD & AUDIUS (< 10 PHÚT)
          if (mode === 'fresh') {
            try {
              showNotification(`🌟 ${getTranslation(language, 'toast.findingNewTracks')}`);
              const related = await invoke<SearchResult[]>('get_related_tracks', {
                title: cur.title,
                artist: cur.artist,
              });

              if (related && related.length > 0) {
                const listened = listenedHistoryTitlesRef.current;
                const curTitleNorm = cur.title.trim().toLowerCase();

                // Filter out tracks already heard, and strictly eliminate tracks > 10 mins (600s)
                const unlistened = related.filter(r => {
                  if (r.duration_secs && r.duration_secs > 600) return false;
                  const rTitle = r.title.trim().toLowerCase();
                  const rId = r.url_or_id.toLowerCase();
                  if (rTitle === curTitleNorm || rTitle.includes(curTitleNorm) || curTitleNorm.includes(rTitle)) return false;
                  if (listened.has(rTitle) || listened.has(rId)) return false;
                  if (all.some(t => t.id.toLowerCase() === rId || t.title.trim().toLowerCase() === rTitle)) return false;
                  return true;
                });

                // Pick the first completely fresh unheard song under 10 minutes
                const candidate = unlistened.length > 0 ? unlistened[0] : (
                  related.find(r => r.title.trim().toLowerCase() !== curTitleNorm && (!r.duration_secs || r.duration_secs <= 600)) || related[0]
                );

                if (candidate) {
                  const newTrack: Track = {
                    id: `${candidate.source}_fresh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    title: candidate.title,
                    artist: candidate.artist,
                    album: candidate.album || 'Multi-Source Discovery',
                    duration_secs: candidate.duration_secs || 210,
                    path_or_url: candidate.url_or_id,
                    cover_art: candidate.thumbnail,
                    source: candidate.source,
                  };

                  setTracks(prev => deduplicateTracks([...prev, newTrack]));
                  triggerNextTrackPopup(newTrack, `🌟 ${getTranslation(language, 'toast.newDiscovery')} (<10p)`);
                  playTrackInternal(newTrack);
                  const srcLabel = newTrack.source === 'soundcloud' ? 'SoundCloud' : newTrack.source === 'audius' ? 'Audius 320K' : 'YouTube';
                  showNotification(`🌟 ${getTranslation(language, 'toast.newDiscovery')} [${srcLabel}]: ${newTrack.title} - ${newTrack.artist}`);
                  return;
                }
              }
            } catch (err) {
              console.error('Error discovering fresh track:', err);
            }
          }

          // 4B. CHẾ ĐỘ 'mix': PHA TRỘN GIỮA BÀI QUEN THUỘC TRONG THƯ VIỆN & BÀI MỚI (< 10 PHÚT)
          if (mode === 'mix') {
            // If we have multiple tracks in playlist, chance to pick from library via AI Smart DJ
            if (all.length > 1 && Math.random() > 0.35) {
              try {
                const nextAiTrack = await invoke<Track | null>('ai_smart_dj_next', {
                  currentTrack: cur,
                  candidates: all,
                });
                if (nextAiTrack && nextAiTrack.id !== cur.id) {
                  triggerNextTrackPopup(nextAiTrack, `🎵 ${getTranslation(language, 'toast.mixRecommendation')}`);
                  playTrackInternal(nextAiTrack);
                  showNotification(`🎵 ${getTranslation(language, 'toast.aiMix')}: ${nextAiTrack.title}`);
                  return;
                }
              } catch (e) {
                console.error('AI Smart DJ error:', e);
              }
            }

            // Fetch related from YouTube, SoundCloud, Audius
            try {
              const related = await invoke<SearchResult[]>('get_related_tracks', {
                title: cur.title,
                artist: cur.artist,
              });

              if (related && related.length > 0) {
                const curTitleNorm = cur.title.trim().toLowerCase();
                const candidates = related.filter(r => 
                  r.title.trim().toLowerCase() !== curTitleNorm && 
                  (!r.duration_secs || r.duration_secs <= 600)
                );
                const pick = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : related[0];

                const newTrack: Track = {
                  id: `${pick.source}_mix_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  title: pick.title,
                  artist: pick.artist,
                  album: pick.album || 'Smart Mix',
                  duration_secs: pick.duration_secs || 210,
                  path_or_url: pick.url_or_id,
                  cover_art: pick.thumbnail,
                  source: pick.source,
                };

                setTracks(prev => deduplicateTracks([...prev, newTrack]));
                triggerNextTrackPopup(newTrack, `🎵 ${getTranslation(language, 'toast.mixRecommendation')} (<10p)`);
                playTrackInternal(newTrack);
                const srcLabel = newTrack.source === 'soundcloud' ? 'SoundCloud' : newTrack.source === 'audius' ? 'Audius 320K' : 'YouTube';
                showNotification(`🎵 ${getTranslation(language, 'toast.mixRecommendation')} [${srcLabel}]: ${newTrack.title} - ${newTrack.artist}`);
                return;
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }

      // 5. Default sequential next
      if (!cur) {
        if (all[0]) {
          triggerNextTrackPopup(all[0], getTranslation(language, 'mode.startPopup'));
          playTrackInternal(all[0]);
        }
        return;
      }

      const idx = all.findIndex(t => t.id === cur.id);
      const nextTrack = all[(idx + 1) % all.length];
      if (nextTrack) {
        triggerNextTrackPopup(nextTrack, getTranslation(language, 'mode.queuePopup'));
        playTrackInternal(nextTrack);
      }
    } finally {
      setTimeout(() => {
        isSkippingRef.current = false;
      }, 1000);
    }
  }, [language]);

  // â”€â”€â”€ WALL-CLOCK TIME TICKER (IMMUNE TO BACKGROUND TAB THROTTLING) â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const interval = setInterval(() => {
      const track = currentTrackRef.current;
      if (!track || !isPlayingRef.current) return;

      let curTime = 0;
      let dur = track.duration_secs || 0;

      if (track.source === 'youtube' || track.source === 'soundcloud') {
        if (playStartTimestampRef.current) {
          const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
          curTime = elapsed;
          if (dur > 0 && elapsed >= dur) {
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNext();
            return;
          } else {
            setCurrentTime(elapsed);
          }
        }
      } else {
        curTime = currentTimeRef.current || 0;
        dur = durationRef.current || track.duration_secs || 0;
      }

      // Update real-time countdown when 10s or less remains
      if (dur > 15 && curTime > 5) {
        const remaining = dur - curTime;
        if (remaining <= 10 && remaining >= 1) {
          if (isNextTrackPopupEnabledRef.current) {
            const nextOne = (recommendModeRef.current !== 'off' && preloadedNextTrackRef.current) || preloadedNextTrackRef.current || upcomingTrack;
            if (nextOne) {
              setNextTrackPopup(prev => ({
                title: nextOne.title,
                artist: nextOne.artist,
                thumbnail: nextOne.cover_art || undefined,
                source: nextOne.source,
                modeLabel: recommendModeRef.current === 'fresh' 
                  ? getTranslation(language, 'mode.freshPopup') 
                  : recommendModeRef.current === 'mix' 
                  ? getTranslation(language, 'mode.mixPopup') 
                  : getTranslation(language, 'mode.queuePopup'),
                isCountdown: true,
                remainingSecs: Math.round(remaining),
                alternatives: prev?.alternatives || preloadedAlternativesRef.current.slice(0, 3),
              }));
            }
          }
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [handleNext, upcomingTrack]);

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
          else if (data.info === 0) {
            setIsPlaying(false);
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNext();
          }
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
          if (scEvent === 'finish') {
            setIsPlaying(false);
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNext();
          }
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

  // ─── AUDIUS & LOCAL HTML5 audio element (Native decoding for MP3, M4A, WebM, etc.) ───
  useEffect(() => {
    const audio = new Audio();
    onlineAudioRef.current = audio;
    const onTimeUpdate = () => {
      if (currentTrackRef.current?.source === 'audius' || currentTrackRef.current?.source === 'local') {
        setCurrentTime(audio.currentTime);
        if (audio.duration > 0 && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      playStartTimestampRef.current = null;
      accumulatedTimeRef.current = 0;
      handleNext();
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => { audio.pause(); audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded); };
  }, [handleNext]);

  // â”€â”€â”€ LOCAL playback polling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentTrackRef.current?.source !== 'local') return;
      // If native browser HTML5 audio is currently playing, it manages its own timeupdate & isPlaying
      if (onlineAudioRef.current && onlineAudioRef.current.src && !onlineAudioRef.current.paused) {
        return;
      }
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
          playStartTimestampRef.current = null;
          accumulatedTimeRef.current = 0;
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
  const playTrackInternal = async (track: Track, isBackOrForward = false) => {
    // Record true previously playing track into playback history stack before switching
    if (!isBackOrForward && currentTrackRef.current && currentTrackRef.current.id !== track.id) {
      playbackHistoryStackRef.current.push(currentTrackRef.current);
      if (playbackHistoryStackRef.current.length > 50) {
        playbackHistoryStackRef.current.shift();
      }
      playbackForwardStackRef.current = [];
    }

    currentTrackRef.current = track;
    setCurrentTrack(track);
    setCurrentTime(0);
    preloadedNextTrackRef.current = null;
    setPreloadedNextTrack(null);

    const isLiveTrack = track.source !== 'local' &&
      (!track.duration_secs || track.duration_secs <= 0) &&
      (
        track.title.toLowerCase().includes('livestream') ||
        track.title.toLowerCase().includes('live stream') ||
        track.title.toLowerCase().includes('trực tiếp') ||
        track.title.toLowerCase().includes('24/7')
      );

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

      // 1. Play local file using native browser audio with convertFileSrc
      let playedViaBrowser = false;
      if (onlineAudioRef.current) {
        try {
          try { await invoke('stop_track'); } catch {}
          const fileUrl = convertFileSrc(track.path_or_url);
          onlineAudioRef.current.src = fileUrl;
          onlineAudioRef.current.volume = volume;
          await onlineAudioRef.current.play();
          setIsPlaying(true);
          playedViaBrowser = true;
          showNotification(`▶ ${track.title} - ${track.artist}`);
        } catch (e) {
          console.warn('Browser convertFileSrc play failed, fallback to Rodio:', e);
        }
      }

      // 2. If browser could not play, fallback to Rust Rodio with Symphonia
      if (!playedViaBrowser) {
        try {
          await invoke('play_track', { track });
          setIsPlaying(true);
          showNotification(`▶ ${track.title} - ${track.artist}`);
        } catch (err) {
          console.error('Rodio play_track error:', err);
          showNotification(`${getTranslation(language, 'toast.playbackError')}: ${track.title}`);
        }
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
        showNotification(`${getTranslation(language, 'toast.findingSource')} SoundCloud: ${track.title}...`);
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
        showNotification(getTranslation(language, 'toast.sourceNotFound'));
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
            showNotification(getTranslation(language, 'toast.audiusError'));
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
        onlineAudioRef.current?.pause();
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
        if (onlineAudioRef.current && onlineAudioRef.current.src && onlineAudioRef.current.src.length > 0) {
          onlineAudioRef.current.play().catch(console.error);
        } else {
          try { await invoke('resume_track'); } catch {}
        }
      } else if (track.source === 'youtube') {
        sendYtCmd('playVideo');
      } else if (track.source === 'soundcloud') {
        sendScCmd('play');
      } else {
        onlineAudioRef.current?.play().catch(console.error);
      }
    }
  };

  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  const handleUserPrevRef = useRef<() => void>(() => {});

  // ─── SYSTEM TRAY & RAM OPTIMIZER (MỤC 3: GIẢI PHÓNG BỘ NHỚ KHI ẨN / THU NHỎ) ───
  useEffect(() => {
    let unlistenPlay: (() => void) | undefined;
    let unlistenPrev: (() => void) | undefined;
    let unlistenNext: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    // Lắng nghe sự kiện từ menu System Tray
    listen('tray-toggle-play', () => {
      handleTogglePlayRef.current();
    }).then(fn => { unlistenPlay = fn; });

    listen('tray-prev-track', () => {
      handleUserPrevRef.current();
    }).then(fn => { unlistenPrev = fn; });

    listen('tray-next-track', () => {
      handleNextRef.current(true);
    }).then(fn => { unlistenNext = fn; });

    // Lắng nghe trạng thái cửa sổ từ Tauri backend (minimized / hidden / normal)
    listen<string>('app-window-state', (event) => {
      if (event.payload === 'hidden' || event.payload === 'minimized') {
        document.documentElement.classList.add('app-minimized');
        invoke('trim_memory').catch(() => {});
      } else {
        document.documentElement.classList.remove('app-minimized');
      }
    }).then(fn => { unlistenState = fn; });

    // Lắng nghe sự kiện visibility chuẩn của trình duyệt / WebView2
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.documentElement.classList.add('app-minimized');
        invoke('trim_memory').catch(() => {});
      } else {
        document.documentElement.classList.remove('app-minimized');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (unlistenPlay) unlistenPlay();
      if (unlistenPrev) unlistenPrev();
      if (unlistenNext) unlistenNext();
      if (unlistenState) unlistenState();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.documentElement.classList.remove('app-minimized');
    };
  }, []);

  const handleSeek = async (secs: number) => {
    if (!currentTrack) return;
    // Don't seek on live streams without duration to avoid crashes
    const effDur = duration > 0 ? duration : (currentTrack.duration_secs || 0);
    if (effDur <= 0 && currentTrack.source !== 'local') return;

    setCurrentTime(secs);
    accumulatedTimeRef.current = secs;
    if (isPlayingRef.current) {
      playStartTimestampRef.current = Date.now();
    } else {
      playStartTimestampRef.current = null;
    }

    if (currentTrack?.source === 'local') {
      if (onlineAudioRef.current && onlineAudioRef.current.src) {
        onlineAudioRef.current.currentTime = secs;
      }
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
    // If the user previously navigated backwards, forward through history first
    if (playbackForwardStackRef.current.length > 0) {
      const cur = currentTrackRef.current;
      if (cur) {
        playbackHistoryStackRef.current.push(cur);
      }
      const nextTrack = playbackForwardStackRef.current.pop()!;
      playTrackInternal(nextTrack, true);
      showNotification(`⏭ ${nextTrack.title} - ${nextTrack.artist}`);
      return;
    }

    // When recommendation mode is active (Fresh Discovery or Smart Mix), follow the recommendation engine
    if (recommendModeRef.current !== 'off') {
      handleNext(true);
      return;
    }

    const list = tracksRef.current.length > 0 ? tracksRef.current : (displayedTracksRef.current.length > 0 ? displayedTracksRef.current : tracks);
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
    // If user has a playback history stack, pop the genuine previous song that was being listened to!
    if (playbackHistoryStackRef.current.length > 0) {
      const cur = currentTrackRef.current;
      if (cur) {
        playbackForwardStackRef.current.push(cur);
      }
      const prevTrack = playbackHistoryStackRef.current.pop()!;
      playTrackInternal(prevTrack, true);
      showNotification(`⏮ ${prevTrack.title} - ${prevTrack.artist}`);
      return;
    }

    // Fallback if no history stack yet: move to previous track in playlist
    const list = tracksRef.current.length > 0 ? tracksRef.current : (displayedTracksRef.current.length > 0 ? displayedTracksRef.current : tracks);
    if (!list.length || !currentTrackRef.current) return;
    const curId = currentTrackRef.current.id;
    const idx = list.findIndex(t => t.id === curId);
    const prevIdx = idx > 0 ? idx - 1 : (idx === 0 ? list.length - 1 : 0);
    const prevTrack = list[prevIdx];
    if (prevTrack) {
      playTrackInternal(prevTrack, true);
      showNotification(`⏮ ${prevTrack.title} - ${prevTrack.artist}`);
    }
  };

  const handlePrev = handleUserPrev;
  handleUserPrevRef.current = handleUserPrev;

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
        showNotification(isFav ? getTranslation(language, 'toast.favoriteAdded') : getTranslation(language, 'toast.favoriteRemoved'));
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
      showNotification(getTranslation(language, 'toast.favoriteAdded'));
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: getTranslation(language, 'header.selectFolder') });
      if (selected && typeof selected === 'string') {
        const t0 = performance.now();
        const scanned = await invoke<Track[]>('scan_music_folder', { folderPath: selected });
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        setTracks(prev => {
          return deduplicateTracks([...prev, ...scanned]);
        });
        setCurrentView('local');
        showNotification(getTranslation(language, 'toast.folderScanned', { count: scanned.length, time: elapsed }));
      }
    } catch (err) { showNotification(`Lỗi: ${err}`); }
  };

  const handleDownloadTrack = async (track: Track) => {
    if (track.source === 'local') {
      showNotification(getTranslation(language, 'download.alreadyLocal'));
      return;
    }

    if (downloadingTrackIds.has(track.id)) return;

    setDownloadingTrackIds(prev => new Set(prev).add(track.id));
    showNotification(`⏳ ${getTranslation(language, 'download.downloading')}: ${track.title}`);

    try {
      const savedTrack = await invoke<Track>('download_track', {
        track,
        targetDir: downloadFolder || null,
      });

      // Add newly saved track to library state so it is instantly available under "Nhạc trên máy"
      setTracks(prev => {
        const filtered = prev.filter(t => t.id !== track.id && t.id !== savedTrack.id);
        return [savedTrack, ...filtered];
      });

      // If this was the playing track, smoothly point currentTrack to local file
      if (currentTrackRef.current?.id === track.id) {
        currentTrackRef.current = savedTrack;
        setCurrentTrack(savedTrack);
      }

      showNotification(`✅ ${getTranslation(language, 'download.downloadSuccess', { title: savedTrack.title })}`);
    } catch (err) {
      showNotification(`❌ ${getTranslation(language, 'download.downloadError', { error: String(err) })}`);
    } finally {
      setDownloadingTrackIds(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  };

  const handleChangeDownloadFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: getTranslation(language, 'download.folderSetting'),
      });
      if (selected && typeof selected === 'string') {
        setDownloadFolder(selected);
        localStorage.setItem('spytify_download_folder', selected);
        showNotification(`📁 Đã đổi thư mục lưu nhạc: ${selected}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDownloadFolder = async () => {
    try {
      const target = downloadFolder || (await invoke<string>('get_default_download_directory'));
      await openPath(target);
    } catch (e) {
      showNotification(`Không mở được thư mục: ${e}`);
    }
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

  const localCount = tracks.filter(t => t.source === 'local').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#a0a0a0] overflow-hidden select-none font-sans">
      {/* Spy Cinematic Startup Screen */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* ─── NEXT TRACK POPUP (SMOOTH PLAYBACK FLOATING WIDGET) ── */}
      {nextTrackPopup && isNextTrackPopupEnabled && (
        <div 
          className={`fixed right-6 z-50 p-3.5 rounded-2xl bg-[#0c0c14]/95 backdrop-blur-xl border shadow-2xl flex flex-col gap-2.5 transition-all duration-300 ${
            showYoutubeVideo ? 'bottom-[300px]' : 'bottom-24'
          } ${
            isNextTrackPopupCollapsed ? 'w-80' : 'w-88 max-w-[calc(100vw-3rem)]'
          }`}
          style={{
            borderColor: `${accentColor}60`,
            boxShadow: `0 12px 35px rgba(0,0,0,0.8), 0 0 16px ${accentColor}30`
          }}
        >
          {isNextTrackPopupCollapsed ? (
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <span className="text-[10px] font-mono font-bold uppercase flex-shrink-0" style={{ color: accentColor }}>
                  ⏭ {getTranslation(language, 'popup.nextTrack')}:
                </span>
                <span className="text-xs font-semibold text-white truncate" title={nextTrackPopup.title}>
                  {nextTrackPopup.title}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    if (preloadedNextTrackRef.current) {
                      playTrackInternal(preloadedNextTrackRef.current);
                    } else {
                      handleNext(true);
                    }
                  }}
                  className="p-1 text-[#888] hover:text-white cursor-pointer"
                  title={getTranslation(language, 'popup.playNow')}
                >
                  <Play className="w-3 h-3 fill-current" style={{ color: accentColor }} />
                </button>
                <button
                  onClick={() => setIsNextTrackPopupCollapsed(false)}
                  className="p-1 text-[#888] hover:text-white cursor-pointer"
                  title={getTranslation(language, 'popup.expand')}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleToggleNextTrackPopupEnabled}
                  className="p-1 text-[#666] hover:text-amber-400 cursor-pointer transition-colors"
                  title={getTranslation(language, 'popup.disableAuto')}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setNextTrackPopup(null)}
                  className="p-1 text-[#666] hover:text-white cursor-pointer text-xs leading-none"
                  title={getTranslation(language, 'popup.close')}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: accentColor }}>
                    <span className="animate-pulse">⏭</span> {getTranslation(language, 'popup.nextTrack')}
                  </span>
                  {nextTrackPopup.isCountdown && typeof nextTrackPopup.remainingSecs === 'number' && (
                    <span 
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
                    >
                      {getTranslation(language, 'popup.startsIn')} ~{nextTrackPopup.remainingSecs}s
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsNextTrackPopupCollapsed(true)}
                    className="text-[#888] hover:text-white transition-colors cursor-pointer p-1"
                    title={getTranslation(language, 'popup.collapse')}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={handleToggleNextTrackPopupEnabled}
                    className="text-[#666] hover:text-amber-400 transition-colors cursor-pointer p-1"
                    title={getTranslation(language, 'popup.disableAuto')}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setNextTrackPopup(null)}
                    className="text-[#666] hover:text-white transition-colors cursor-pointer text-xs p-1 leading-none"
                    title={getTranslation(language, 'popup.close')}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Main Next Track Card */}
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[#14141c] border border-[#222230]">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#181824] flex-shrink-0 border border-[#2a2a38]">
                  {nextTrackPopup.thumbnail ? (
                    <img 
                      src={optimizeThumbnailUrl(nextTrackPopup.thumbnail)} 
                      alt={nextTrackPopup.title} 
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
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white truncate" title={nextTrackPopup.title}>
                    {nextTrackPopup.title}
                  </p>
                  <p className="text-[11px] text-[#8e8e9f] truncate">
                    {nextTrackPopup.artist}
                  </p>
                  <span className="text-[9px] font-mono text-[#777] uppercase">
                    {nextTrackPopup.source} • {nextTrackPopup.modeLabel}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (preloadedNextTrackRef.current) {
                      playTrackInternal(preloadedNextTrackRef.current);
                    } else {
                      handleNext(true);
                    }
                  }}
                  style={{
                    backgroundColor: accentColor,
                    color: '#ffffff',
                  }}
                  className="p-2 rounded-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0 cursor-pointer shadow-sm"
                  title={getTranslation(language, 'popup.playNow')}
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              </div>

              {/* Alternatives / Similar Genre Recommendations */}
              {nextTrackPopup.alternatives && nextTrackPopup.alternatives.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#888899]">
                    <span>{getTranslation(language, 'popup.sameGenre')}</span>
                    <span className="text-[9px] text-[#555]">{getTranslation(language, 'popup.clickToChoose')}</span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
                    {nextTrackPopup.alternatives.map((alt) => (
                      <div
                        key={alt.id}
                        onClick={() => {
                          playTrackInternal(alt);
                        }}
                        className="p-1.5 rounded-lg bg-[#0e0e16] hover:bg-[#181824] border border-[#1a1a26] hover:border-[#2e2e42] transition-colors flex items-center gap-2 cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded overflow-hidden bg-[#161620] flex-shrink-0 relative">
                          {alt.cover_art ? (
                            <img 
                              src={optimizeThumbnailUrl(alt.cover_art)} 
                              alt={alt.title} 
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#555]">
                              <Music className="w-3 h-3" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-2.5 h-2.5 fill-current text-white" />
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[11px] font-semibold text-white truncate group-hover:text-white" title={alt.title}>
                            {alt.title}
                          </p>
                          <p className="text-[9px] text-[#777] truncate font-mono">
                            {alt.artist} • <span className="uppercase">{alt.source}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* Toast Notification — Invincible Accent (Hiển thị ngay trên thanh Play) */}
      {statusMessage && (
        <div 
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full font-mono text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 border shadow-2xl backdrop-blur-xl whitespace-nowrap pointer-events-none"
          style={{
            backgroundColor: themeMode === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(14, 14, 20, 0.95)',
            color: themeMode === 'light' ? '#0f172a' : '#ffffff',
            borderColor: `${accentColor}80`,
            boxShadow: themeMode === 'light' 
              ? `0 10px 30px rgba(0,0,0,0.15), 0 0 16px ${accentColor}40` 
              : `0 10px 35px rgba(0,0,0,0.8), 0 0 20px ${accentColor}50`
          }}
        >
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 animate-pulse" style={{ color: accentColor }} />
          <span className="font-bold tracking-wide" style={{ color: themeMode === 'light' ? '#0f172a' : '#ffffff' }}>
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
        language={language}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* YouTube iframe — stable bottom-right positioning without jumping */}
      {ytVideoId && (
        <div
          className={`fixed bottom-24 right-6 w-80 h-48 rounded-xl bg-black shadow-2xl border border-[#222] z-40 transition-all duration-300 overflow-hidden ${
            showYoutubeVideo
              ? 'opacity-100 scale-100 pointer-events-auto shadow-[0_16px_36px_rgba(0,0,0,0.9)]'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          {showYoutubeVideo && (
            <button
              onClick={() => setShowYoutubeVideo(false)}
              className="absolute top-2 right-2 z-50 p-1.5 rounded-full bg-black/80 hover:bg-black text-white border border-[#333] cursor-pointer shadow-md transition-colors"
              title="Thu nhỏ MV"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <iframe
            ref={ytIframeRef}
            src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
            title="YouTube Player"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
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
          language={language}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
          {/* Header Bar — Minimalist */}
          <header className="h-12 px-6 flex items-center justify-between border-b border-[#141416] bg-black/95 backdrop-blur z-50">
            <div className="flex items-center gap-2.5 text-xs font-medium text-white">
              <img src="/spytify-logo.png" alt="Spytify" className="w-5 h-5 rounded-md object-cover border border-[#262632]" />
              <span className="tracking-tight font-bold">Spytify</span>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Quick Language Switcher Dropdown */}
              <div className="relative" ref={langDropdownRef}>
                <button
                  onClick={() => setShowLanguageDropdown(p => !p)}
                  className="px-2.5 py-1 bg-[#121212] hover:bg-[#1c1c1c] text-white text-xs font-medium rounded-md border border-[#222] transition-colors flex items-center gap-1.5 cursor-pointer"
                  title={getTranslation(language, 'header.language')}
                >
                  <Globe className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span className="font-mono text-[11px] font-bold tracking-wider">
                    {SUPPORTED_LANGUAGES.find(l => l.code === language)?.tag || 'VN'}
                  </span>
                </button>

                {showLanguageDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" 
                      onClick={() => setShowLanguageDropdown(false)} 
                    />
                    <div
                      className="absolute left-0 top-full mt-2 w-48 py-1.5 rounded-xl bg-[#0e0e14] border shadow-2xl z-50 text-xs font-sans"
                      style={{
                        borderColor: `${accentColor}50`,
                        boxShadow: `0 16px 36px rgba(0,0,0,0.9), 0 0 16px ${accentColor}25`
                      }}
                    >
                      <div className="px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#666] border-b border-[#1c1c28] mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5" style={{ color: accentColor }}>
                          <Languages className="w-3 h-3" />
                          {getTranslation(language, 'header.language')}
                        </span>
                        <span className="text-[9px] text-[#555] font-mono">{SUPPORTED_LANGUAGES.length}</span>
                      </div>
                      {SUPPORTED_LANGUAGES.map((l) => {
                        const isSel = l.code === language;
                        return (
                          <button
                            key={l.code}
                            onClick={() => {
                              handleUpdateLanguage(l.code);
                              setShowLanguageDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#181824] transition-colors cursor-pointer ${
                              isSel ? 'bg-[#181824] font-semibold text-white' : 'text-[#bbb]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#181822] text-[#ccc] border border-[#262636]">
                                {l.tag}
                              </span>
                              <span className="truncate">{l.nativeName}</span>
                            </div>
                            {isSel && (
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

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
                {getTranslation(language, 'header.selectFolder')}
              </button>
            </div>
          </header>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-7 py-5">
            {showVisualizer && currentView !== 'profile' && currentView !== 'ai_mix' && <AudioVisualizer isPlaying={isPlaying} language={language} accentColor={accentColor} source={currentTrack?.source} />}

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
                accentColor={accentColor}
                language={language}
              />
            ) : currentView === 'library' ? (
              <HomeTrendingView
                accentColor={accentColor}
                language={language}
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
                accentColor={accentColor}
                language={language}
              />
            ) : currentView === 'profile' ? (
              <ProfileView
                currentUser={currentUser}
                language={language}
                onUpdateLanguage={handleUpdateLanguage}
                accentColor={accentColor}
                themeMode={themeMode}
                onUpdateAccentColor={handleUpdateAccentColor}
                onToggleThemeMode={handleToggleThemeMode}
                onUpdateAvatar={handleUpdateAvatar}
                onLogout={handleLogout}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onPlayTrack={handlePlayTrack}
                isNextTrackPopupEnabled={isNextTrackPopupEnabled}
                onToggleNextTrackPopupEnabled={handleToggleNextTrackPopupEnabled}
                downloadFolder={downloadFolder}
                onChangeDownloadFolder={handleChangeDownloadFolder}
                onOpenDownloadFolder={handleOpenDownloadFolder}
              />
            ) : currentView === 'search' ? (
              <SearchView
                language={language}
                onPlaySearchResult={handlePlaySearchResult}
                onSearchOnline={handleSearchOnline}
                localTracks={tracks}
                onTrackSelect={handlePlayTrack}
                accentColor={accentColor}
              />
            ) : currentView === 'youtube' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 flex items-center gap-1 font-mono">
                      <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                      YOUTUBE AUDIO STREAM
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">{getTranslation(language, 'stream.youtubeTitle')}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.youtubeSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
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
                        showNotification(`${getTranslation(language, 'toast.searching')}: "${t}"...`);
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
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
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
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.soundcloudSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>{getTranslation(language, 'nav.search')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['Indie Nhạc Việt', 'Lo-Fi Hip Hop', 'Deep House Mix', 'Phùng Khánh Linh', 'RPT Orijinn', 'Underground Rap VN'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`${getTranslation(language, 'toast.searching')}: "${t}" (SoundCloud)...`);
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
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
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
                    <span className="text-[10px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5" style={{ color: accentColor }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
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
                      style={{
                        backgroundColor: accentColor,
                        color: '#ffffff',
                        boxShadow: `0 0 16px ${accentColor}50`
                      }}
                      className="w-11 h-11 rounded-full hover:scale-105 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Disc className="w-5 h-5 fill-current" />
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
                  accentColor={accentColor}
                  language={language}
                  onDownloadTrack={handleDownloadTrack}
                  downloadingTrackIds={downloadingTrackIds}
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
        language={language}
        currentTrack={currentTrack}
        upcomingTrack={effectiveUpcomingTrack}
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
        onDownload={handleDownloadTrack}
        isDownloading={currentTrack ? downloadingTrackIds.has(currentTrack.id) : false}
        sleepTimerMinutes={sleepTimerMinutes}
        sleepTimerRemainingSecs={sleepTimerRemainingSecs}
        onSetSleepTimer={handleSetSleepTimer}
        onToggleVisualizer={() => setShowVisualizer(p => !p)}
        showVisualizer={showVisualizer}
        themeMode={themeMode}
        recommendMode={recommendMode}
        onCycleRecommendMode={handleCycleRecommendMode}
      />
    </div>
  );
}
