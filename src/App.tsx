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
import { CommunityView } from './components/CommunityView';
import { HomeTrendingView } from './components/HomeTrendingView';
import { AlbumsView } from './components/AlbumsView';
import { AddToAlbumModal } from './components/AddToAlbumModal';
import { SplashScreen } from './components/SplashScreen';
import { UpdateModal } from './components/UpdateModal';
import { checkGitHubUpdate, UpdateInfo, CURRENT_VERSION } from './services/updater';
import { cloudSyncPull, cloudSyncPush, isSupabaseConfigured, cloudRegisterUser } from './services/supabase';
import { deduplicateTracks, optimizeThumbnailUrl, handleImageError } from './utils/trackUtils';
import { Track, PlaybackStatus, SearchResult, ViewType, User, UserAlbum, RecommendationResult } from './types';
import { FolderPlus, Disc, CheckCircle2, Tv, X, Radio, ArrowUpRight, LogIn, Sun, Moon, Music, Play, Globe, Languages, ChevronDown, ChevronUp, EyeOff, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './components/Icons';
import { LanguageCode, SUPPORTED_LANGUAGES, getTranslation } from './locales/i18n';
import spytifyLogo from './assets/spytify-logo.png';

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
  const [localFolder, setLocalFolder] = useState<string>(() => {
    return localStorage.getItem('spytify_local_folder') || '';
  });
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Set<string>>(new Set());

  // Software Update & Close-to-Tray State
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Initialize Close to Tray & Background Update Check on startup
  useEffect(() => {
    const savedCloseToTray = localStorage.getItem('spytify_close_to_tray');
    const enabled = savedCloseToTray !== 'false';
    invoke('set_close_to_tray', { enabled }).catch(err => {
      console.warn('Failed to initialize close to tray:', err);
    });

    // Check for updates 3.5s after launch (non-blocking)
    const timer = setTimeout(async () => {
      try {
        const res = await checkGitHubUpdate(false);
        if (res.hasUpdate && res.info) {
          setUpdateInfo(res.info);
          setIsUpdateModalOpen(true);
        }
      } catch (e) {
        console.warn('Startup update check failed:', e);
      }
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  // Automatically scan & load saved local music folder and download directory on startup
  useEffect(() => {
    const initLocalMusic = async () => {
      try {
        let dlFolder = downloadFolder;
        if (!dlFolder) {
          dlFolder = await invoke<string>('get_default_download_directory');
          if (dlFolder) {
            setDownloadFolder(dlFolder);
            localStorage.setItem('spytify_download_folder', dlFolder);
          }
        }

        const foldersToScan = new Set<string>();
        const savedLocal = localStorage.getItem('spytify_local_folder');
        if (savedLocal && savedLocal.trim()) {
          foldersToScan.add(savedLocal.trim());
        }
        if (dlFolder && dlFolder.trim()) {
          foldersToScan.add(dlFolder.trim());
        }

        const allScanned: Track[] = [];
        for (const f of foldersToScan) {
          try {
            const list = await invoke<Track[]>('scan_music_folder', { folderPath: f });
            if (list && list.length > 0) {
              allScanned.push(...list);
            }
          } catch (e) {
            console.warn(`Scan folder ${f} failed:`, e);
          }
        }

        if (allScanned.length > 0) {
          setTracks(prev => deduplicateTracks([...allScanned, ...prev]));
        }
      } catch (err) {
        console.error('Failed to init local music on startup:', err);
      }
    };

    initLocalMusic();
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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('spytify_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
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
    return SUPPORTED_LANGUAGES.some(l => l.code === saved) ? saved : 'vi';
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
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebarCollapse();
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

    // Instantly update the floating AI Mix popup recommendations for the newly selected language
    if (!currentTrackRef.current) {
      const seeds = getLanguageAiSeeds(newLang);
      const label = getLanguageAiPopupLabel(newLang);
      preloadedNextTrackRef.current = seeds[0];
      setPreloadedNextTrack(seeds[0]);
      preloadedAlternativesRef.current = seeds.slice(1, 4);
      if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
        setNextTrackPopup({
          title: seeds[0].title,
          artist: seeds[0].artist,
          thumbnail: seeds[0].cover_art || undefined,
          source: seeds[0].source,
          modeLabel: label,
          isCountdown: false,
          alternatives: seeds.slice(1, 4),
        });
      }
    }
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
    const clean = deduplicateTracks(album.tracks || []);
    if (clean.length > 0) {
      setTracks(prev => deduplicateTracks([...clean, ...prev]));
      activeQueueRef.current = clean;
      setActiveQueue(clean);
      activeQueueContextRef.current = 'albums';
      setActiveQueueContext('albums');
      playTrackInternal(clean[0]);
      showNotification(`${getTranslation(language, 'toast.playingAlbum')}: ${album.title}`);
    }
  };


  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('soundify_favorites') || '[]')); }
    catch { return new Set(); }
  });
  const favoritesRef = useRef<Set<string>>(favorites);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);

  const albumsRef = useRef<UserAlbum[]>(albums);
  useEffect(() => { albumsRef.current = albums; }, [albums]);

  const [activeQueue, setActiveQueue] = useState<Track[]>([]);
  const activeQueueRef = useRef<Track[]>([]);
  useEffect(() => { activeQueueRef.current = activeQueue; }, [activeQueue]);

  const [activeQueueContext, setActiveQueueContext] = useState<string>('library');
  const activeQueueContextRef = useRef<string>('library');
  useEffect(() => { activeQueueContextRef.current = activeQueueContext; }, [activeQueueContext]);

  // Tracks whether the next song in 'mix' mode should be a brand-new discovery (true)
  // or the next song from the current playlist (false), strictly alternating 1-by-1.
  const mixNextIsNewRef = useRef<boolean>(true);
  const lastPlaylistIndexRef = useRef<number>(0);
  const lockedPlaylistNextRef = useRef<{
    forTrackId: string | null;
    isShuffle: boolean;
    ctx: string;
    track: Track | null;
  }>({ forTrackId: null, isShuffle: false, ctx: '', track: null });

  const isScopedPlaylistContext = (ctx: string): boolean => {
    return ctx === 'local' || ctx === 'favorites' || ctx === 'albums';
  };

  // Checks if a candidate track is already in any user playlist (Active Queue, Favorites, User Albums, or Local Music)
  const isTrackInUserPlaylists = (title: string, urlOrId?: string): boolean => {
    const normTitle = title.trim().toLowerCase();
    const normId = (urlOrId || '').trim().toLowerCase();

    const matchesTrack = (t: Track) => {
      const tTitle = t.title.trim().toLowerCase();
      const tId = t.id.toLowerCase();
      const tPath = (t.path_or_url || '').toLowerCase();
      if (tTitle === normTitle || tTitle.includes(normTitle) || normTitle.includes(tTitle)) return true;
      if (normId && (tId === normId || tPath === normId || tId.includes(normId))) return true;
      return false;
    };

    if (activeQueueRef.current.some(matchesTrack)) return true;
    if (tracksRef.current.some(t => (t.source === 'local' || favoritesRef.current.has(t.id)) && matchesTrack(t))) return true;
    for (const alb of albumsRef.current) {
      if ((alb.tracks || []).some(matchesTrack)) return true;
    }
    return false;
  };

  const getEffectiveQueue = (): Track[] => {
    const ctx = activeQueueContextRef.current;
    if (ctx === 'local') {
      const locals = deduplicateTracks(tracksRef.current.filter(t => t.source === 'local'));
      return locals.length > 0 ? locals : activeQueueRef.current;
    }
    if (ctx === 'favorites') {
      const favs = deduplicateTracks(tracksRef.current.filter(t => favoritesRef.current.has(t.id)));
      return favs.length > 0 ? favs : activeQueueRef.current;
    }
    if (ctx === 'albums') {
      return activeQueueRef.current.length > 0 ? activeQueueRef.current : tracksRef.current;
    }
    if (activeQueueRef.current.length > 0) {
      return activeQueueRef.current;
    }
    return displayedTracksRef.current.length > 0 ? displayedTracksRef.current : tracksRef.current;
  };

  const getNextPlaylistTrack = (cur: Track | null): Track | null => {
    const queue = getEffectiveQueue();
    if (!queue.length) return null;

    const curId = cur?.id || null;
    const shuf = isShuffleRef.current;
    const ctx = activeQueueContextRef.current;
    const cached = lockedPlaylistNextRef.current;

    if (
      cached.track &&
      cached.forTrackId === curId &&
      cached.isShuffle === shuf &&
      cached.ctx === ctx &&
      queue.some(t => t.id === cached.track!.id) &&
      (queue.length === 1 || cached.track.id !== curId)
    ) {
      return cached.track;
    }

    let picked: Track | null = null;
    if (shuf && queue.length > 1) {
      const remaining = queue.filter(t => t.id !== curId);
      picked = remaining[Math.floor(Math.random() * remaining.length)] || queue[0];
    } else {
      const idx = cur ? queue.findIndex(t => t.id === cur.id) : -1;
      if (idx !== -1) {
        picked = queue[(idx + 1) % queue.length];
      } else {
        picked = queue[(lastPlaylistIndexRef.current + 1) % queue.length] || queue[0];
      }
    }

    lockedPlaylistNextRef.current = {
      forTrackId: curId,
      isShuffle: shuf,
      ctx,
      track: picked,
    };
    return picked;
  };

  const shouldNextBeNewDiscovery = (): boolean => {
    if (recommendModeRef.current === 'fresh') return true;
    if (recommendModeRef.current === 'mix') {
      const queue = getEffectiveQueue();
      if (!queue.length) return true;
      return mixNextIsNewRef.current;
    }
    return false;
  };

  const getPlaylistModeLabel = (ctx: string): string => {
    if (recommendModeRef.current === 'fresh') return getTranslation(language, 'mode.freshPopup');
    if (recommendModeRef.current === 'mix') {
      return mixNextIsNewRef.current
        ? `${getTranslation(language, 'mode.mixPopup')} • ${getTranslation(language, 'mode.newTrackTag')}`
        : `${getTranslation(language, 'mode.mixPopup')} • ${getTranslation(language, 'mode.playlistTag')}`;
    }
    if (ctx === 'local') return getTranslation(language, 'nav.localMusic');
    if (ctx === 'favorites') return getTranslation(language, 'nav.favorites');
    if (ctx === 'albums') return getTranslation(language, 'nav.myAlbums');
    return getTranslation(language, 'mode.queuePopup');
  };
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [showYoutubeVideo, setShowYoutubeVideo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [scTrackUrl, setScTrackUrl] = useState<string | null>(null);

  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytUnavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytHasStartedPlayingRef = useRef(false);
  const ytMusicFallbackActiveRef = useRef(false);
  const ytMusicFallbackTriedRef = useRef(false);
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
  const [isAiLoadingNext, setIsAiLoadingNext] = useState<boolean>(false);
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

  const checkIsLiveTrack = (t: Track | null): boolean => {
    if (!t || t.source !== 'youtube') return false;
    const title = t.title.toLowerCase();
    const isRecordedLive =
      title.includes('live lounge') ||
      title.includes('live session') ||
      title.includes('live at') ||
      title.includes('live in') ||
      title.includes('live acoustic') ||
      title.includes('live version') ||
      title.includes('live performance') ||
      title.includes('live cover');
    if (isRecordedLive) return false;
    return (
      !t.duration_secs ||
      t.duration_secs <= 0 ||
      title.includes('24/7') ||
      title.includes('trực tiếp') ||
      title.includes('livestream') ||
      title.includes('live stream') ||
      title.includes('live radio') ||
      title.includes('hip hop radio') ||
      title.includes('lofi radio') ||
      title.includes('chill radio') ||
      (title.includes('radio') && (t.duration_secs <= 0 || t.duration_secs > 7200)) ||
      (title.includes('live') && (t.duration_secs <= 0 || t.duration_secs > 7200))
    );
  };

  const buildImmediatePopupData = (): NextTrackPopupData | null => {
    const allList = getEffectiveQueue();
    const cur = currentTrackRef.current;
    const fallbackNext = getNextPlaylistTrack(cur);
    const useNewDiscovery = shouldNextBeNewDiscovery();

    // In new discovery (Fresh) mode, ONLY use genuine preloaded discovery track.
    // Do NOT pull random songs from allList/history to prevent showing unrelated songs.
    const nextToUse = useNewDiscovery
      ? preloadedNextTrackRef.current
      : (fallbackNext || preloadedNextTrackRef.current);
    if (!nextToUse || (cur && nextToUse.id === cur.id)) return null;

    const altList = (useNewDiscovery && preloadedAlternativesRef.current.length > 0)
      ? preloadedAlternativesRef.current.slice(0, 3)
      : (!useNewDiscovery
          ? allList.filter(t => t.id !== cur?.id && t.id !== nextToUse.id).slice(0, 3)
          : []);

    return {
      title: nextToUse.title,
      artist: nextToUse.artist,
      thumbnail: nextToUse.cover_art || undefined,
      source: nextToUse.source,
      modeLabel: getPlaylistModeLabel(activeQueueContextRef.current),
      isCountdown: false,
      alternatives: altList,
    };
  };

  const handleToggleNextTrackPopupEnabled = () => {
    const isCurrentlyVisible = Boolean(isNextTrackPopupEnabled && nextTrackPopup);
    if (isCurrentlyVisible) {
      setIsNextTrackPopupEnabled(false);
      isNextTrackPopupEnabledRef.current = false;
      localStorage.setItem('spytify_next_popup_enabled', 'false');
      setNextTrackPopup(null);
      showNotification(getTranslation(language, 'popup.disabledToast'));
    } else {
      setIsNextTrackPopupEnabled(true);
      isNextTrackPopupEnabledRef.current = true;
      localStorage.setItem('spytify_next_popup_enabled', 'true');
      setIsNextTrackPopupCollapsed(false);
      const immediateData = buildImmediatePopupData();
      if (immediateData) {
        setNextTrackPopup(immediateData);
      } else {
        setNextTrackPopup({
          title: 'AI Smart DJ Ready',
          artist: 'Spytify Intelligence',
          source: 'youtube',
          modeLabel: getTranslation(language, 'mode.freshPopup'),
          isCountdown: false,
          alternatives: [],
        });
      }
      showNotification(getTranslation(language, 'popup.enabledToast'));
    }
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

  // Keep refs in sync synchronously during render so useMemo/useEffect always see latest state
  currentTrackRef.current = currentTrack;
  isPlayingRef.current = isPlaying;
  tracksRef.current = tracks;
  currentUserRef.current = currentUser;
  repeatModeRef.current = repeatMode;
  recommendModeRef.current = recommendMode;
  isShuffleRef.current = isShuffle;
  activeQueueRef.current = activeQueue;
  activeQueueContextRef.current = activeQueueContext;
  favoritesRef.current = favorites;
  albumsRef.current = albums;

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

const getLanguageAiSeeds = (lang: LanguageCode): Track[] => {
  let pool: Track[] = [];
  switch (lang) {
    case 'ko':
      pool = [
        {
          id: 'aimix_seed_ko_1',
          title: 'APT. (feat. Bruno Mars)',
          artist: 'ROSÉ & Bruno Mars',
          album: 'AI 믹스 • K-Pop Global',
          duration_secs: 173,
          path_or_url: 'ekr2nIex040',
          cover_art: 'https://i.ytimg.com/vi/ekr2nIex040/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_2',
          title: 'Supernova',
          artist: 'aespa (에스파)',
          album: 'AI 믹스 • Viral Pick',
          duration_secs: 180,
          path_or_url: 'phuiAIQAxZ4',
          cover_art: 'https://i.ytimg.com/vi/phuiAIQAxZ4/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_3',
          title: 'Magnetic',
          artist: 'ILLIT (아일릿)',
          album: 'AI 믹스 • Hot Trend',
          duration_secs: 161,
          path_or_url: 'Vk5-c_v4gMU',
          cover_art: 'https://i.ytimg.com/vi/Vk5-c_v4gMU/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_4',
          title: 'Love wins all',
          artist: 'IU (아이유)',
          album: 'AI 믹스 • K-Ballad',
          duration_secs: 272,
          path_or_url: 'JleoAppaxi0',
          cover_art: 'https://i.ytimg.com/vi/JleoAppaxi0/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_5',
          title: 'How Sweet',
          artist: 'NewJeans (뉴진스)',
          album: 'AI 믹스 • Groovy K-Pop',
          duration_secs: 219,
          path_or_url: 'Q3K0TOvTOno',
          cover_art: 'https://i.ytimg.com/vi/Q3K0TOvTOno/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_6',
          title: 'Perfect Night',
          artist: 'LE SSERAFIM (르세라핌)',
          album: 'AI 믹스 • Night Drive',
          duration_secs: 160,
          path_or_url: 'hLvWy2b857I',
          cover_art: 'https://i.ytimg.com/vi/hLvWy2b857I/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_7',
          title: 'Dynamite',
          artist: 'BTS (방탄소년단)',
          album: 'AI 믹스 • Billboard #1 Hit',
          duration_secs: 199,
          path_or_url: 'gdZLi9oWNZg',
          cover_art: 'https://i.ytimg.com/vi/gdZLi9oWNZg/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ko_8',
          title: 'MAESTRO',
          artist: 'SEVENTEEN (세븐틴)',
          album: 'AI 믹스 • High Energy',
          duration_secs: 198,
          path_or_url: 'ilbT0854-C4',
          cover_art: 'https://i.ytimg.com/vi/ilbT0854-C4/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'ja':
      pool = [
        {
          id: 'aimix_seed_ja_1',
          title: 'Idol (アイドル)',
          artist: 'YOASOBI',
          album: 'AI Mix • J-Pop Top',
          duration_secs: 213,
          path_or_url: 'ZRtdQ81jPUQ',
          cover_art: 'https://i.ytimg.com/vi/ZRtdQ81jPUQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_2',
          title: 'Bling-Bang-Bang-Born',
          artist: 'Creepy Nuts',
          album: 'AI Mix • Viral J-Pop',
          duration_secs: 178,
          path_or_url: 'mLW35YMz1eo',
          cover_art: 'https://i.ytimg.com/vi/mLW35YMz1eo/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_3',
          title: 'Shinunoga E-Wa (死ぬのがいいわ)',
          artist: 'Fujii Kaze (藤井 風)',
          album: 'AI Mix • Chill Groove',
          duration_secs: 185,
          path_or_url: 'dFfvP9-A_P8',
          cover_art: 'https://i.ytimg.com/vi/dFfvP9-A_P8/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_4',
          title: 'KICK BACK',
          artist: 'Kenshi Yonezu (米津玄師)',
          album: 'AI Mix • Anime Hit',
          duration_secs: 193,
          path_or_url: 'M2cckDmNLMI',
          cover_art: 'https://i.ytimg.com/vi/M2cckDmNLMI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_5',
          title: 'Show (唱)',
          artist: 'Ado',
          album: 'AI Mix • High Voltage',
          duration_secs: 191,
          path_or_url: 'pgXpM4l_MwI',
          cover_art: 'https://i.ytimg.com/vi/pgXpM4l_MwI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_ja_6',
          title: 'Lilac (ライラック)',
          artist: 'Mrs. GREEN APPLE',
          album: 'AI Mix • J-Rock Sensation',
          duration_secs: 204,
          path_or_url: 'Q7PqG8K7fWw',
          cover_art: 'https://i.ytimg.com/vi/Q7PqG8K7fWw/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'zh-CN':
      pool = [
        {
          id: 'aimix_seed_zh_1',
          title: '晴天 (Sunny Day)',
          artist: '周杰伦 (Jay Chou)',
          album: 'AI Mix • 经典热歌',
          duration_secs: 269,
          path_or_url: 'DYptgVvkVLQ',
          cover_art: 'https://i.ytimg.com/vi/DYptgVvkVLQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_2',
          title: '光年之外 (LIGHT YEARS AWAY)',
          artist: 'G.E.M. 邓紫棋',
          album: 'AI Mix • 华语流行',
          duration_secs: 235,
          path_or_url: 'T4SimnaiktU',
          cover_art: 'https://i.ytimg.com/vi/T4SimnaiktU/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_3',
          title: '带我去找夜生活',
          artist: '告五人 (Accusefive)',
          album: 'AI Mix • 独立流行',
          duration_secs: 243,
          path_or_url: '55nPtJyp4eQ',
          cover_art: 'https://i.ytimg.com/vi/55nPtJyp4eQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_4',
          title: '孤勇者 (Lonely Warrior)',
          artist: '陈奕迅 (Eason Chan)',
          album: 'AI Mix • 巅峰热榜',
          duration_secs: 256,
          path_or_url: 'H58vbez_m4E',
          cover_art: 'https://i.ytimg.com/vi/H58vbez_m4E/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_zh_5',
          title: '哪里都是你',
          artist: '队长 (Young Captain)',
          album: 'AI Mix • 潮流说唱',
          duration_secs: 208,
          path_or_url: '5dZ8vV8Y3fE',
          cover_art: 'https://i.ytimg.com/vi/5dZ8vV8Y3fE/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'en-US':
      pool = [
        {
          id: 'aimix_seed_en_1',
          title: 'Die With A Smile',
          artist: 'Lady Gaga & Bruno Mars',
          album: 'AI Mix • Top Match',
          duration_secs: 251,
          path_or_url: 'kPa7bsKwL-c',
          cover_art: 'https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_2',
          title: 'Birds of a Feather',
          artist: 'Billie Eilish',
          album: 'AI Mix • Chill Pop',
          duration_secs: 196,
          path_or_url: 'V9PVRfjEBTI',
          cover_art: 'https://i.ytimg.com/vi/V9PVRfjEBTI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_3',
          title: 'Espresso',
          artist: 'Sabrina Carpenter',
          album: 'AI Mix • Viral Summer',
          duration_secs: 175,
          path_or_url: 'eVli-tstM5E',
          cover_art: 'https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_4',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'AI Mix • Synthwave',
          duration_secs: 200,
          path_or_url: '4NRXx6U8ABQ',
          cover_art: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_5',
          title: 'Cruel Summer',
          artist: 'Taylor Swift',
          album: 'AI Mix • Pop Sensation',
          duration_secs: 178,
          path_or_url: 'ic8j13piAhQ',
          cover_art: 'https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_6',
          title: 'Beautiful Things',
          artist: 'Benson Boone',
          album: 'AI Mix • Global Hit',
          duration_secs: 180,
          path_or_url: 'Oa_RSwwpPaA',
          cover_art: 'https://i.ytimg.com/vi/Oa_RSwwpPaA/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_en_7',
          title: 'Houdini',
          artist: 'Dua Lipa',
          album: 'AI Mix • Dance Pop',
          duration_secs: 185,
          path_or_url: 'suAR1PYFNYA',
          cover_art: 'https://i.ytimg.com/vi/suAR1PYFNYA/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
    case 'vi':
    default:
      pool = [
        {
          id: 'aimix_seed_vi_1',
          title: 'Đừng Làm Trái Tim Anh Đau',
          artist: 'Sơn Tùng M-TP',
          album: 'AI Mix • V-Pop Hot',
          duration_secs: 326,
          path_or_url: 'abPmZCZZrFA',
          cover_art: 'https://i.ytimg.com/vi/abPmZCZZrFA/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_2',
          title: 'Không Thể Say',
          artist: 'HIEUTHUHAI',
          album: 'AI Mix • Trending Rap',
          duration_secs: 210,
          path_or_url: 'W_aX497N4cE',
          cover_art: 'https://i.ytimg.com/vi/W_aX497N4cE/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_3',
          title: 'Bước Qua Mùa Cô Đơn',
          artist: 'Vũ.',
          album: 'AI Mix • Indie Ballad',
          duration_secs: 279,
          path_or_url: 'bX8d8XbS0hU',
          cover_art: 'https://i.ytimg.com/vi/bX8d8XbS0hU/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_4',
          title: 'Từng Quen',
          artist: 'Wren Evans',
          album: 'AI Mix • New Wave',
          duration_secs: 174,
          path_or_url: 'zepHPnUDROE',
          cover_art: 'https://i.ytimg.com/vi/zepHPnUDROE/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_5',
          title: 'Giá Như',
          artist: 'SOOBIN',
          album: 'AI Mix • R&B V-Pop',
          duration_secs: 216,
          path_or_url: 'kFq-qT8g16Q',
          cover_art: 'https://i.ytimg.com/vi/kFq-qT8g16Q/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_6',
          title: 'Thủy Triều',
          artist: 'Quang Hùng MasterD',
          album: 'AI Mix • Viral V-Pop',
          duration_secs: 202,
          path_or_url: '7ig2lXjozdw',
          cover_art: 'https://i.ytimg.com/vi/7ig2lXjozdw/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_7',
          title: 'Cắt Đôi Nỗi Sầu',
          artist: 'Tăng Duy Tân',
          album: 'AI Mix • Catchy Beat',
          duration_secs: 195,
          path_or_url: 'GpmOn4RyzZI',
          cover_art: 'https://i.ytimg.com/vi/GpmOn4RyzZI/hqdefault.jpg',
          source: 'youtube',
        },
        {
          id: 'aimix_seed_vi_8',
          title: 'Thanh Xuân',
          artist: 'Da LAB',
          album: 'AI Mix • Nostalgia V-Pop',
          duration_secs: 228,
          path_or_url: 'GgQFO8dL5XQ',
          cover_art: 'https://i.ytimg.com/vi/GgQFO8dL5XQ/hqdefault.jpg',
          source: 'youtube',
        },
      ];
      break;
  }
  return pool;
};

const getLanguageAiPopupLabel = (lang: LanguageCode): string => {
  switch (lang) {
    case 'ko': return '✨ AI 믹스 • 당신을 위한 맞춤 추천';
    case 'ja': return '✨ AIミックス • あなたへのおすすめ';
    case 'zh-CN': return '✨ AI 混音 • 为你专属推荐';
    case 'en-US': return '✨ AI MIX • RECOMMENDED FOR YOU';
    case 'vi':
    default: return '✨ AI MIX • ĐỀ XUẤT CHO BẠN';
  }
};

  // Pre-fetch AI Mix recommendations on initial app startup (when !currentTrack)
  // or when language changes, and switch to normal Next Track pre-fetching once a track starts playing
  useEffect(() => {
    if (!currentTrack) {
      const initialAiMixSeeds: Track[] = getLanguageAiSeeds(language);
      const popupModeLabel = getLanguageAiPopupLabel(language);

      // Immediately show AI Mix popup tailored to selected language
      preloadedNextTrackRef.current = initialAiMixSeeds[0];
      setPreloadedNextTrack(initialAiMixSeeds[0]);
      preloadedAlternativesRef.current = initialAiMixSeeds.slice(1, 4);

      if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
        const topPick = initialAiMixSeeds[0];
        const alts = initialAiMixSeeds.slice(1, 4);
        setNextTrackPopup({
          title: topPick.title,
          artist: topPick.artist,
          thumbnail: topPick.cover_art || undefined,
          source: topPick.source,
          modeLabel: popupModeLabel,
          isCountdown: false,
          alternatives: alts,
        });
      }

      return;
    }
    endOfTrackPopupShownForRef.current = null;
  }, [currentTrack, !currentTrack ? language : undefined]);

  const fetchUpcomingReqIdRef = useRef(0);

  const fetchUpcomingForTrack = async (targetTrack: Track) => {
    const reqId = ++fetchUpcomingReqIdRef.current;
    setIsAiLoadingNext(true);

    try {
      const related = await invoke<SearchResult[]>('get_related_tracks', {
        title: targetTrack.title,
        artist: targetTrack.artist,
      });

      if (reqId !== fetchUpcomingReqIdRef.current) return;

      if (related && related.length > 0) {
        const listened = listenedHistoryTitlesRef.current;
        const curTitleLower = targetTrack.title.toLowerCase();

        // Filter out tracks already in any user playlist (Favorites, Albums, Local, Active Queue) or listened history
        const strictOutsideCandidates = related.filter(r => {
          const rTitle = r.title.toLowerCase();
          if (rTitle.includes(curTitleLower) || curTitleLower.includes(rTitle)) return false;
          if (listened.has(rTitle) || listened.has(r.url_or_id.toLowerCase())) return false;
          if (isTrackInUserPlaylists(r.title, r.url_or_id)) return false;
          return true;
        });

        const rawPool = strictOutsideCandidates.length > 0
          ? strictOutsideCandidates
          : related.filter(r => !isTrackInUserPlaylists(r.title, r.url_or_id));

        const candidates = (rawPool.length > 0 ? rawPool : related).map((r): Track => ({
          id: `${r.source}_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: r.title,
          artist: r.artist,
          album: r.album || 'Gợi ý ngoài Playlist',
          duration_secs: r.duration_secs || 210,
          path_or_url: r.url_or_id,
          cover_art: r.thumbnail,
          source: r.source,
        }));

        if (candidates.length > 0) {
          preloadedNextTrackRef.current = candidates[0];
          setPreloadedNextTrack(candidates[0]);
          preloadedAlternativesRef.current = candidates.slice(1, 6);
          if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
            const popupLabel = recommendModeRef.current === 'fresh'
              ? getTranslation(language, 'mode.freshPopup')
              : recommendModeRef.current === 'mix'
                ? getTranslation(language, 'mode.mixPopup')
                : getTranslation(language, 'mode.queuePopup');

            setNextTrackPopup({
              title: candidates[0].title,
              artist: candidates[0].artist,
              thumbnail: candidates[0].cover_art || undefined,
              source: candidates[0].source,
              modeLabel: popupLabel,
              isCountdown: false,
              alternatives: candidates.slice(1, 4),
            });
          }
        }
      }
    } catch (err) {
      console.error('Error prefetching upcoming songs:', err);
    } finally {
      if (reqId === fetchUpcomingReqIdRef.current) {
        setIsAiLoadingNext(false);
      }
    }
  };

  // ─── RESTORE USER SESSION FROM SQLITE ──────────────────────────────────────
  useEffect(() => {
    const savedUserId = localStorage.getItem('soundify_active_user_id');
    if (savedUserId) {
      invoke<User | null>('auth_get_current_user', { userId: savedUserId })
        .then(user => {
          if (user) {
            setCurrentUser(user);
            localStorage.setItem('soundify_active_user_id', user.id);
            loadFavoritesFromDb(user.id);

            // Ensure Supabase Cloud has credentials & updated data
            if (isSupabaseConfigured()) {
              invoke<[string, string] | null>('auth_get_credentials', { userId: user.id })
                .then(creds => {
                  if (creds) {
                    cloudRegisterUser(user, user.email || null, creds[0], creds[1]);
                  }
                })
                .catch(() => {});

              invoke<Track[]>('db_get_favorites', { userId: user.id }).then(localFavs => {
                const localAlbumsStr = localStorage.getItem('spytify_user_albums');
                const localAlbums: UserAlbum[] = localAlbumsStr ? JSON.parse(localAlbumsStr) : [];
                cloudSyncPush(user.id, {
                  username: user.username,
                  displayName: user.display_name,
                  email: user.email || undefined,
                  avatar: user.avatar || undefined,
                  favorites: localFavs,
                  albums: localAlbums,
                }).catch(() => {});
              }).catch(() => {});
            }
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
      invoke<[string, string] | null>('auth_get_credentials', { userId: user.id })
        .then(creds => {
          if (creds) {
            cloudRegisterUser(user, user.email || null, creds[0], creds[1]);
          }
        })
        .catch(() => {});

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
          if (cloudData.favorites && cloudData.favorites.length > 0) {
            for (const t of cloudData.favorites) {
              invoke('db_add_favorite', { userId: user.id, track: t }).catch(() => {});
            }
            setFavorites(prev => {
              const next = new Set(prev);
              cloudData.favorites.forEach(t => next.add(t.id));
              return next;
            });
            setTracks(prev => deduplicateTracks([...cloudData.favorites, ...prev]));
          }
          if (cloudData.avatar && !user.avatar) {
            setCurrentUser(prev => prev ? { ...prev, avatar: cloudData.avatar } : null);
          }
          if (cloudData.accentColor) {
            handleUpdateAccentColor(cloudData.accentColor);
          }
          if (cloudData.themeMode && cloudData.themeMode !== themeMode) {
            setThemeMode(cloudData.themeMode);
            localStorage.setItem('spytify_theme_mode', cloudData.themeMode);
          }
          if (cloudData.language && cloudData.language !== language) {
            const l = cloudData.language as LanguageCode;
            setLanguage(l);
            localStorage.setItem('spytify_language', l);
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
      recommendModeRef.current = next;
      localStorage.setItem('spytify_recommend_mode', next);
      if (next === 'fresh') {
        showNotification(getTranslation(language, 'toast.modeFresh'));
      } else if (next === 'mix') {
        showNotification(getTranslation(language, 'toast.modeMix'));
      } else {
        showNotification(getTranslation(language, 'toast.modeOff'));
      }
      if (isNextTrackPopupEnabledRef.current) {
        setTimeout(() => {
          const immediate = buildImmediatePopupData();
          if (immediate) setNextTrackPopup(immediate);
        }, 0);
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
    return getNextPlaylistTrack(currentTrack);
  }, [currentTrack, displayedTracks, activeQueue, activeQueueContext, isShuffle]);

  const effectiveUpcomingTrack = useMemo(() => {
    const useNew = shouldNextBeNewDiscovery();
    if (useNew) {
      return preloadedNextTrack || upcomingTrack;
    }
    return upcomingTrack || preloadedNextTrack;
  }, [recommendMode, preloadedNextTrack, upcomingTrack, currentTrack, isShuffle, activeQueueContext]);

  // Keep Next Track Floating Popup 100% synchronized with effectiveUpcomingTrack once playback has started
  useEffect(() => {
    if (!isNextTrackPopupEnabledRef.current || !effectiveUpcomingTrack) return;
    if (!currentTrackRef.current) return;
    const useNew = shouldNextBeNewDiscovery();

    // When in discovery/fresh mode, NEVER fall back to favorites/library tracks while AI is analyzing/loading!
    if (useNew && !preloadedNextTrack) return;

    const allList = getEffectiveQueue();
    const cur = currentTrackRef.current;
    const altList = (useNew && preloadedAlternativesRef.current.length > 0)
      ? preloadedAlternativesRef.current.slice(0, 3)
      : (!useNew ? allList.filter(t => t.id !== cur?.id && t.id !== effectiveUpcomingTrack.id).slice(0, 3) : []);

    setNextTrackPopup(prev => ({
      title: effectiveUpcomingTrack.title,
      artist: effectiveUpcomingTrack.artist,
      thumbnail: effectiveUpcomingTrack.cover_art || undefined,
      source: effectiveUpcomingTrack.source,
      modeLabel: getPlaylistModeLabel(activeQueueContextRef.current),
      isCountdown: prev?.isCountdown || false,
      remainingSecs: prev?.remainingSecs,
      alternatives: altList,
    }));
  }, [effectiveUpcomingTrack, preloadedNextTrack, recommendMode, isShuffle, activeQueueContext, language]);

  // ─── AUTO-PLAY NEXT TRACK & AUTO-RECOMMEND ENGINE ──────────────────────────
  const handleNext = useCallback(async (isManualSkip = false) => {
    if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    playStartTimestampRef.current = null;
    accumulatedTimeRef.current = 0;

    try {
      const all = getEffectiveQueue();
      const cur = currentTrackRef.current;
      if (!all.length && !cur) return;

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

      // 2. Repeat off and NOT in recommendation mode (stop when reaching end of playlist)
      if (!isManualSkip && repeatModeRef.current === 'off' && recommendModeRef.current === 'off') {
        const curIdx = cur ? all.findIndex(t => t.id === cur.id) : -1;
        if (curIdx === -1 || curIdx >= all.length - 1) {
          setIsPlaying(false);
          return;
        }
      }

      // 3. Shuffle mode within playlist when recommendMode === 'off'
      if (isShuffleRef.current && all.length > 1 && recommendModeRef.current === 'off') {
        const randomTrack = getNextPlaylistTrack(cur);
        if (randomTrack) {
          playTrackInternal(randomTrack);
          return;
        }
      }

      // 4. CHẾ ĐỘ ĐỀ XUẤT NHẠC TIẾP THEO:
      // - 'fresh' (Mới): Bài tiếp theo luôn là bài MỚI hoàn toàn nằm ngoài mọi Playlist (Yêu thích, Album, Local)
      // - 'mix' (Mix): Xen kẽ 1 bài cũ (trong Playlist đang phát) ↔ 1 bài mới hoàn toàn (ngoài Playlist)
      if (recommendModeRef.current !== 'off') {
        const mode = recommendModeRef.current;

        // 4A. Nếu ở chế độ 'mix' và tới lượt phát bài CŨ trong Playlist:
        if (mode === 'mix' && !mixNextIsNewRef.current && all.length > 0) {
          const nextPlaylistTrack = getNextPlaylistTrack(cur);
          if (nextPlaylistTrack) {
            mixNextIsNewRef.current = true;
            playTrackInternal(nextPlaylistTrack);
            showNotification(`🎵 Mix [${getTranslation(language, 'mode.playlistTag')}]: ${nextPlaylistTrack.title} - ${nextPlaylistTrack.artist}`);
            return;
          }
        }

        // 4B. Lượt phát bài MỚI hoàn toàn ngoài Playlist (áp dụng cho 100% chế độ 'fresh', hoặc lượt bài mới của 'mix'):
        if (preloadedNextTrackRef.current && !isTrackInUserPlaylists(preloadedNextTrackRef.current.title, preloadedNextTrackRef.current.path_or_url)) {
          const next = preloadedNextTrackRef.current;
          preloadedNextTrackRef.current = null;
          mixNextIsNewRef.current = false;
          setTracks(prev => deduplicateTracks([...prev, next]));
          playTrackInternal(next);
          const srcLabel = next.source === 'soundcloud' ? 'SoundCloud' : next.source === 'audius' ? 'Audius 320K' : 'YouTube';
          showNotification(`🌟 ${mode === 'fresh' ? getTranslation(language, 'toast.newDiscovery') : `Mix [${getTranslation(language, 'mode.newTrackTag')}]`} [${srcLabel}]: ${next.title} - ${next.artist}`);
          return;
        }

        if (cur) {
          try {
            showNotification(`🌟 ${getTranslation(language, 'toast.findingNewTracks')}`);
            const related = await invoke<SearchResult[]>('get_related_tracks', {
              title: cur.title,
              artist: cur.artist,
            });

            if (related && related.length > 0) {
              const listened = listenedHistoryTitlesRef.current;
              const curTitleNorm = cur.title.trim().toLowerCase();

              // Lọc nghiêm ngặt: bài mới phải nằm ngoài hoàn toàn Playlist (Yêu thích, Album, Local) và chưa nghe
              const outsideUnlistened = related.filter(r => {
                if (r.duration_secs && r.duration_secs > 600) return false;
                const rTitle = r.title.trim().toLowerCase();
                const rId = r.url_or_id.toLowerCase();
                if (rTitle === curTitleNorm || rTitle.includes(curTitleNorm) || curTitleNorm.includes(rTitle)) return false;
                if (listened.has(rTitle) || listened.has(rId)) return false;
                if (isTrackInUserPlaylists(r.title, r.url_or_id)) return false;
                return true;
              });

              const candidate = outsideUnlistened.length > 0 ? outsideUnlistened[0] : (
                related.find(r => !isTrackInUserPlaylists(r.title, r.url_or_id) && r.title.trim().toLowerCase() !== curTitleNorm && (!r.duration_secs || r.duration_secs <= 600)) || related[0]
              );

              if (candidate) {
                const newTrack: Track = {
                  id: `${candidate.source}_${mode}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  title: candidate.title,
                  artist: candidate.artist,
                  album: candidate.album || (mode === 'fresh' ? 'Multi-Source Discovery' : 'Smart Mix Discovery'),
                  duration_secs: candidate.duration_secs || 210,
                  path_or_url: candidate.url_or_id,
                  cover_art: candidate.thumbnail,
                  source: candidate.source,
                };

                mixNextIsNewRef.current = false;
                setTracks(prev => deduplicateTracks([...prev, newTrack]));
                playTrackInternal(newTrack);
                const srcLabel = newTrack.source === 'soundcloud' ? 'SoundCloud' : newTrack.source === 'audius' ? 'Audius 320K' : 'YouTube';
                showNotification(`🌟 ${mode === 'fresh' ? getTranslation(language, 'toast.newDiscovery') : `Mix [${getTranslation(language, 'mode.newTrackTag')}]`} [${srcLabel}]: ${newTrack.title} - ${newTrack.artist}`);
                return;
              }
            }
          } catch (err) {
            console.error('Error discovering outside-playlist track:', err);
          }
        }
      }

      // 5. Default sequential next within active playlist (when recommendMode === 'off' or fallback)
      if (!cur) {
        if (all[0]) {
          playTrackInternal(all[0]);
        }
        return;
      }

      const nextTrack = getNextPlaylistTrack(cur);
      if (nextTrack) {
        playTrackInternal(nextTrack);
      }
    } finally {
      setTimeout(() => {
        isSkippingRef.current = false;
      }, 1000);
    }
  }, [language]);

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  const [isTrayMode, setIsTrayMode] = useState(false);
  const isTrayModeRef = useRef(false);

  // ─── WALL-CLOCK TIME TICKER (IMMUNE TO BACKGROUND TAB THROTTLING) ────────
  useEffect(() => {
    const interval = setInterval(() => {
      const track = currentTrackRef.current;
      if (!track || !isPlayingRef.current) return;

      let curTime = 0;
      const trueDur = Math.max(durationRef.current || 0, track.duration_secs || 0);

      if (track.source === 'youtube' || track.source === 'soundcloud') {
        if (playStartTimestampRef.current) {
          const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
          curTime = elapsed;
          currentTimeRef.current = elapsed;
          if (!isTrayModeRef.current) {
            setCurrentTime(elapsed);
          }

          // Safety fallback: only auto-skip if elapsed well exceeds true duration (+8s grace period)
          if (trueDur > 0 && elapsed >= (trueDur + 8)) {
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNextRef.current?.();
            return;
          }
        }
      } else {
        curTime = currentTimeRef.current || 0;
      }

      if (isTrayModeRef.current) return;

      // Update real-time countdown when 10s or less remains
      if (trueDur > 15 && curTime > 5) {
        const remaining = trueDur - curTime;
        if (remaining <= 10 && remaining >= 1) {
          if (isNextTrackPopupEnabledRef.current) {
            const useNew = shouldNextBeNewDiscovery();
            const nextOne = useNew
              ? (preloadedNextTrackRef.current || upcomingTrack)
              : (upcomingTrack || preloadedNextTrackRef.current);
            if (nextOne) {
              setNextTrackPopup(prev => ({
                title: nextOne.title,
                artist: nextOne.artist,
                thumbnail: nextOne.cover_art || undefined,
                source: nextOne.source,
                modeLabel: getPlaylistModeLabel(activeQueueContextRef.current),
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
  }, [upcomingTrack]);

  // ─── INSTANT RESYNC WHEN SWITCHING BACK TO APP WINDOW ────────────────────
  const syncPlaybackStateNow = useCallback(async () => {
    const track = currentTrackRef.current;
    if (!track) return;

    if (track.source === 'local') {
      if (onlineAudioRef.current && onlineAudioRef.current.src) {
        const playing = !onlineAudioRef.current.paused;
        isPlayingRef.current = playing;
        setIsPlaying(playing);
        currentTimeRef.current = onlineAudioRef.current.currentTime;
        setCurrentTime(onlineAudioRef.current.currentTime);
        if (onlineAudioRef.current.duration > 0 && !isNaN(onlineAudioRef.current.duration)) {
          durationRef.current = onlineAudioRef.current.duration;
          setDuration(onlineAudioRef.current.duration);
        }
      } else {
        try {
          const status = await invoke<PlaybackStatus>('get_playback_status');
          isPlayingRef.current = status.is_playing;
          setIsPlaying(status.is_playing);
          currentTimeRef.current = status.current_time_secs;
          setCurrentTime(status.current_time_secs);
          if (status.duration_secs > 0) {
            durationRef.current = status.duration_secs;
            setDuration(status.duration_secs);
          }
        } catch {}
      }
    } else if (track.source === 'audius' || (track.source === 'youtube' && ytMusicFallbackActiveRef.current)) {
      if (onlineAudioRef.current) {
        const playing = !onlineAudioRef.current.paused;
        isPlayingRef.current = playing;
        setIsPlaying(playing);
        currentTimeRef.current = onlineAudioRef.current.currentTime;
        setCurrentTime(onlineAudioRef.current.currentTime);
        if (onlineAudioRef.current.duration > 0 && !isNaN(onlineAudioRef.current.duration)) {
          durationRef.current = onlineAudioRef.current.duration;
          setDuration(onlineAudioRef.current.duration);
        }
      }
    } else if (isPlayingRef.current && playStartTimestampRef.current) {
      // Instantly recalculate true elapsed time from real system clock!
      const elapsed = accumulatedTimeRef.current + (Date.now() - playStartTimestampRef.current) / 1000;
      currentTimeRef.current = elapsed;
      setCurrentTime(elapsed);
      // Ping YouTube to ensure state is fresh
      if (track.source === 'youtube' && ytIframeRef.current?.contentWindow) {
        ytIframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
      }
    } else {
      setCurrentTime(currentTimeRef.current || accumulatedTimeRef.current || 0);
      setIsPlaying(isPlayingRef.current);
      if (durationRef.current > 0) setDuration(durationRef.current);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('focus', syncPlaybackStateNow);
    return () => {
      window.removeEventListener('focus', syncPlaybackStateNow);
    };
  }, [syncPlaybackStateNow]);

  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // YouTube events
        if (data.event === 'onError') {
          if (currentTrackRef.current?.source !== 'youtube') return;
          const erroredTrack = currentTrackRef.current;
          console.warn('[YouTube Player] Embed blocked or unavailable, code:', data.info, '-> Auto-resolving via YouTube Music API...');
          if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
          fallbackToYoutubeMusicStream(erroredTrack).then((recovered) => {
            if (!recovered && currentTrackRef.current?.id === erroredTrack.id) {
              showNotification('⚠️ Bài hát này bị giới hạn khu vực trên YouTube. Tự động chuyển bài...');
              ytUnavailableTimerRef.current = setTimeout(() => {
                handleNext();
              }, 2500);
            }
          });
        }

        if (data.event === 'onStateChange') {
          if (currentTrackRef.current?.source !== 'youtube') return;
          if (data.info === 1) {
            isPlayingRef.current = true;
            setIsPlaying(true);
            if (!playStartTimestampRef.current) {
              playStartTimestampRef.current = Date.now();
            }
            ytHasStartedPlayingRef.current = true;
            if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
          } else if (data.info === 3) {
            ytHasStartedPlayingRef.current = true;
            if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
          } else if (data.info === 2) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            if (playStartTimestampRef.current) {
              accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
              playStartTimestampRef.current = null;
            }
          } else if (data.info === 0) {
            isPlayingRef.current = false;
            setIsPlaying(false);
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNext();
          }
        }
        if (data.event === 'infoDelivery' && data.info) {
          if (currentTrackRef.current?.source !== 'youtube') return;
          const isCurLive = checkIsLiveTrack(currentTrackRef.current);
          if (typeof data.info.currentTime === 'number') {
            const rawCur = data.info.currentTime;
            if (rawCur > 0) {
              ytHasStartedPlayingRef.current = true;
              if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
            }
            // Guard against YouTube Live streams sending DVR/epoch timestamps
            if (isCurLive || rawCur > 86400) {
              durationRef.current = 0;
              if (!isTrayModeRef.current) setDuration(0);
            } else if (rawCur >= 0) {
              currentTimeRef.current = rawCur;
              accumulatedTimeRef.current = rawCur;
              if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
              if (!isTrayModeRef.current) setCurrentTime(rawCur);
            }
          }
          if (typeof data.info.duration === 'number') {
            if (isCurLive) {
              durationRef.current = 0;
              if (!isTrayModeRef.current) setDuration(0);
            } else if (data.info.duration > 0 && data.info.duration < 86400) {
              durationRef.current = data.info.duration;
              if (!isTrayModeRef.current) setDuration(data.info.duration);
            } else if (data.info.duration === 0) {
              durationRef.current = 0;
              if (!isTrayModeRef.current) setDuration(0);
            }
          }
          if (data.info.playerState === 1) {
            isPlayingRef.current = true;
            if (!playStartTimestampRef.current) playStartTimestampRef.current = Date.now();
            if (!isTrayModeRef.current) setIsPlaying(true);
          }
          if (data.info.playerState === 2) {
            isPlayingRef.current = false;
            if (playStartTimestampRef.current) {
              accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
              playStartTimestampRef.current = null;
            }
            if (!isTrayModeRef.current) setIsPlaying(false);
          }
        }

        // SoundCloud Widget events
        const scEvent = data.soundcloudEvent || (typeof data.method === 'string' && ['play', 'pause', 'finish', 'playProgress', 'seek'].includes(data.method) ? data.method : null);
        if (scEvent) {
          if (currentTrackRef.current?.source !== 'soundcloud') return;

          // Extract duration from SoundCloud widget events if provided
          const rawDur = data.data?.duration ?? data.value?.duration ?? data.duration;
          if (typeof rawDur === 'number' && rawDur > 0) {
            const durSecs = Math.round(rawDur / 1000);
            if (durSecs > 0 && durSecs < 86400) {
              durationRef.current = durSecs;
              if (!isTrayModeRef.current) setDuration(durSecs);
            }
          }
          if (scEvent === 'play') {
            isPlayingRef.current = true;
            setIsPlaying(true);
            playStartTimestampRef.current = Date.now();
          }
          if (scEvent === 'pause') {
            isPlayingRef.current = false;
            setIsPlaying(false);
            if (playStartTimestampRef.current) {
              accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
              playStartTimestampRef.current = null;
            }
          }
          if (scEvent === 'finish') {
            isPlayingRef.current = false;
            setIsPlaying(false);
            playStartTimestampRef.current = null;
            accumulatedTimeRef.current = 0;
            handleNext();
          }
          if (scEvent === 'playProgress') {
            const rawPos = data.data?.currentPosition ?? data.value?.currentPosition ?? 0;
            const posSecs = rawPos / 1000;
            if (posSecs > 0) {
              currentTimeRef.current = posSecs;
              accumulatedTimeRef.current = posSecs;
              if (isPlayingRef.current) playStartTimestampRef.current = Date.now();
              if (!isTrayModeRef.current) setCurrentTime(posSecs);
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
    const sendListening = () => {
      try {
        ytIframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: 1 }), '*'
        );
      } catch {}
    };
    sendListening();
    const timer1 = setTimeout(sendListening, 500);
    const timer2 = setTimeout(sendListening, 1500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [ytVideoId]);

  // ─── AUDIUS & LOCAL HTML5 audio element (Native decoding for MP3, M4A, WebM, etc.) ───
  useEffect(() => {
    const audio = new Audio();
    onlineAudioRef.current = audio;
    const onTimeUpdate = () => {
      if (
        currentTrackRef.current?.source === 'audius' ||
        currentTrackRef.current?.source === 'local' ||
        (currentTrackRef.current?.source === 'youtube' && ytMusicFallbackActiveRef.current)
      ) {
        currentTimeRef.current = audio.currentTime;
        if (audio.duration > 0 && !isNaN(audio.duration)) {
          durationRef.current = audio.duration;
        }
        if (!isTrayModeRef.current) {
          setCurrentTime(audio.currentTime);
          if (audio.duration > 0 && !isNaN(audio.duration)) {
            setDuration(audio.duration);
          }
        }
      }
    };
    const onEnded = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      playStartTimestampRef.current = null;
      accumulatedTimeRef.current = 0;
      handleNextRef.current?.();
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => { audio.pause(); audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded); };
  }, []);

  // ─── LOCAL playback polling ───────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      if (currentTrackRef.current?.source !== 'local') return;
      // If native browser HTML5 audio is currently playing, it manages its own timeupdate & isPlaying
      if (onlineAudioRef.current && onlineAudioRef.current.src) {
        return;
      }
      try {
        const status = await invoke<PlaybackStatus>('get_playback_status');
        isPlayingRef.current = status.is_playing;
        currentTimeRef.current = status.current_time_secs;
        if (status.duration_secs > 0) durationRef.current = status.duration_secs;
        if (!isTrayModeRef.current) {
          setIsPlaying(status.is_playing);
          setCurrentTime(status.current_time_secs);
          if (status.duration_secs > 0) setDuration(status.duration_secs);
        }

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

  // Auto-resolve blocked/unavailable YouTube videos via YouTube Music API (`WEB_REMIX` + `VISIONOS` direct audio stream)
  const fallbackToYoutubeMusicStream = async (track: Track): Promise<boolean> => {
    if (ytMusicFallbackTriedRef.current) return false;
    ytMusicFallbackTriedRef.current = true;

    let rawVid = track.path_or_url || track.id;
    if (rawVid.startsWith('yt_')) rawVid = rawVid.replace('yt_', '');
    if (rawVid.includes('v=')) rawVid = rawVid.split('v=')[1].split('&')[0];

    try {
      const res = await invoke<{
        stream_url: string | null;
        resolved_video_id: string;
        duration_secs: number;
      }>('resolve_youtube_music_stream', {
        videoId: rawVid,
        title: track.title,
        artist: track.artist,
      });

      // Ensure user hasn't switched to another track while resolving
      if (currentTrackRef.current?.id !== track.id) return true;

      if (res.stream_url && onlineAudioRef.current) {
        if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
        sendYtCmd('stopVideo');
        setYtVideoId(null);
        setShowYoutubeVideo(false);

        ytMusicFallbackActiveRef.current = true;
        onlineAudioRef.current.pause();
        onlineAudioRef.current.src = res.stream_url;
        onlineAudioRef.current.volume = volume;

        if (res.duration_secs > 0) {
          durationRef.current = res.duration_secs;
          if (!isTrayModeRef.current) setDuration(res.duration_secs);
        }

        await onlineAudioRef.current.play();
        ytHasStartedPlayingRef.current = true;
        isPlayingRef.current = true;
        setIsPlaying(true);
        playStartTimestampRef.current = Date.now();
        showNotification(`🎵 YouTube Music Hi-Fi: ${track.title}`);
        return true;
      }

      if (res.resolved_video_id && res.resolved_video_id !== rawVid) {
        setYtVideoId(res.resolved_video_id);
        return true;
      }
    } catch (err) {
      console.warn('[YouTube Music Fallback] Error resolving stream:', err);
    }
    return false;
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

    // Track position in active playlist and alternate 'mix' mode (Old Playlist Track <-> New Discovery Track)
    const activeQ = getEffectiveQueue();
    const qIdx = activeQ.findIndex(t => t.id === track.id);
    if (qIdx !== -1) {
      lastPlaylistIndexRef.current = qIdx;
      mixNextIsNewRef.current = true;
    } else {
      mixNextIsNewRef.current = false;
    }

    currentTrackRef.current = track;
    setCurrentTrack(track);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    ytMusicFallbackActiveRef.current = false;
    ytMusicFallbackTriedRef.current = false;

    // Record into in-memory listened set immediately so candidate promotion never picks the currently playing track
    if (track.title) listenedHistoryTitlesRef.current.add(track.title.trim().toLowerCase());
    if (track.id) listenedHistoryTitlesRef.current.add(track.id.toLowerCase());
    if (track.path_or_url) listenedHistoryTitlesRef.current.add(track.path_or_url.toLowerCase());

    // Immediately promote an existing pre-fetched discovery candidate (0ms delay, no waiting for network!)
    const trackTitleNorm = track.title.trim().toLowerCase();
    const isValidNewCandidate = (c: Track | null): c is Track =>
      Boolean(
        c &&
        c.id !== track.id &&
        c.title.trim().toLowerCase() !== trackTitleNorm &&
        !listenedHistoryTitlesRef.current.has(c.title.trim().toLowerCase()) &&
        !isTrackInUserPlaylists(c.title, c.path_or_url)
      );

    let nextPreloaded: Track | null = null;
    const curArtistNorm = track.artist.trim().toLowerCase();
    if (
      curArtistNorm &&
      isValidNewCandidate(preloadedNextTrackRef.current) &&
      preloadedNextTrackRef.current.artist.trim().toLowerCase() === curArtistNorm
    ) {
      nextPreloaded = preloadedNextTrackRef.current;
    } else {
      // Clear stale candidates completely so we never leak unrelated songs into the new track
      nextPreloaded = null;
      preloadedAlternativesRef.current = [];
    }
    preloadedNextTrackRef.current = nextPreloaded;
    setPreloadedNextTrack(nextPreloaded);

    const isLiveTrack = checkIsLiveTrack(track);
    const initialDur = isLiveTrack ? 0 : (track.duration_secs || 0);
    durationRef.current = initialDur;
    setDuration(initialDur);
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (isNextTrackPopupEnabledRef.current && !isTrayModeRef.current) {
      if (nextPreloaded) {
        setIsAiLoadingNext(false);
        const immediateData = buildImmediatePopupData();
        if (immediateData) {
          setNextTrackPopup(immediateData);
        }
      } else {
        // AI is loading related tracks for this new song
        setIsAiLoadingNext(true);
        setNextTrackPopup(null);
        fetchUpcomingForTrack(track);
      }
    }

    // Reset Wall-clock timer (start timestamp only when playback actually begins for online streams)
    accumulatedTimeRef.current = 0;
    playStartTimestampRef.current = track.source === 'youtube' ? null : Date.now();

    // Record history to SQLite if logged in
    if (currentUserRef.current) {
      invoke('db_add_history', { userId: currentUserRef.current.id, track }).catch(console.error);
    }

    if (track.source === 'local') {
      if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
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
          isPlayingRef.current = true;
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
          if (onlineAudioRef.current) onlineAudioRef.current.src = '';
          await invoke('play_track', { track });
          isPlayingRef.current = true;
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

      if (onlineAudioRef.current) {
        onlineAudioRef.current.pause();
        onlineAudioRef.current.src = '';
      }

      let videoId = track.path_or_url || track.id;
      if (videoId.startsWith('yt_')) videoId = videoId.replace('yt_', '');
      if (videoId.includes('v=')) videoId = videoId.split('v=')[1].split('&')[0];
      setYtVideoId(videoId);
      isPlayingRef.current = true;
      setIsPlaying(true);
      showNotification(`▶ YouTube Hi-Fi: ${track.title}`);

      ytHasStartedPlayingRef.current = false;
      if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
      ytUnavailableTimerRef.current = setTimeout(() => {
        if (!ytHasStartedPlayingRef.current && currentTrackRef.current?.source === 'youtube') {
          const stalledTrack = currentTrackRef.current;
          console.warn('[YouTube Watchdog] Embed stalled after 3.5s, trying YouTube Music API stream...');
          fallbackToYoutubeMusicStream(stalledTrack).then((recovered) => {
            if (!recovered && currentTrackRef.current?.id === stalledTrack.id && !ytHasStartedPlayingRef.current) {
              showNotification('⚠️ Bài hát này không khả dụng. Tự động chuyển bài tiếp theo...');
              setTimeout(() => {
                handleNext();
              }, 1500);
            }
          });
        }
      }, 3500);

    } else if (track.source === 'soundcloud') {
      if (ytUnavailableTimerRef.current) clearTimeout(ytUnavailableTimerRef.current);
      try { await invoke('stop_track'); } catch {}
      // COMPLETELY STOP YOUTUBE & CLEAR VIDEO & HIDE POPUP!
      sendYtCmd('stopVideo');
      setYtVideoId(null);
      setShowYoutubeVideo(false);

      if (onlineAudioRef.current) {
        onlineAudioRef.current.pause();
        onlineAudioRef.current.src = '';
      }

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
        isPlayingRef.current = true;
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
            isPlayingRef.current = true;
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

  const handlePlayTrack = (track: Track, customQueue?: Track[]) => {
    if (customQueue && customQueue.length > 0) {
      activeQueueRef.current = customQueue;
      setActiveQueue(customQueue);
      activeQueueContextRef.current = 'albums';
      setActiveQueueContext('albums');
    } else {
      activeQueueContextRef.current = currentView;
      setActiveQueueContext(currentView);
      activeQueueRef.current = displayedTracksRef.current;
      setActiveQueue(displayedTracksRef.current);
    }
    playTrackInternal(track);
  };

  const handleTogglePlay = async () => {
    const track = currentTrackRef.current;
    if (!track) return;

    if (isPlayingRef.current) {
      // Transitioning to PAUSE
      if (playStartTimestampRef.current) {
        accumulatedTimeRef.current += (Date.now() - playStartTimestampRef.current) / 1000;
        playStartTimestampRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlaying(false);

      if (track.source === 'local') {
        onlineAudioRef.current?.pause();
        try { await invoke('pause_track'); } catch {}
      } else if (track.source === 'youtube') {
        if (ytMusicFallbackActiveRef.current && onlineAudioRef.current?.src) {
          onlineAudioRef.current.pause();
        } else {
          sendYtCmd('pauseVideo');
        }
      } else if (track.source === 'soundcloud') {
        sendScCmd('pause');
      } else {
        onlineAudioRef.current?.pause();
      }

    } else {
      // Transitioning to PLAY
      playStartTimestampRef.current = Date.now();
      isPlayingRef.current = true;
      setIsPlaying(true);

      if (track.source === 'local') {
        if (onlineAudioRef.current && onlineAudioRef.current.src && onlineAudioRef.current.src.length > 0) {
          onlineAudioRef.current.play().catch(console.error);
        } else {
          try { await invoke('resume_track'); } catch {}
        }
      } else if (track.source === 'youtube') {
        if (ytMusicFallbackActiveRef.current && onlineAudioRef.current?.src) {
          onlineAudioRef.current.play().catch(console.error);
        } else {
          sendYtCmd('playVideo');
        }
      } else if (track.source === 'soundcloud') {
        sendScCmd('play');
      } else {
        onlineAudioRef.current?.play().catch(console.error);
      }
    }
  };

  const handleTogglePlayRef = useRef(handleTogglePlay);
  handleTogglePlayRef.current = handleTogglePlay;
  const handleUserPrevRef = useRef<() => void>(() => {});

  // ─── SYSTEM TRAY & RAM OPTIMIZER (MỤC 3: GIẢI PHÓNG BỘ NHỚ KHI ẨN / THU NHỎ <= 150MB) ───
  useEffect(() => {
    let unlistenPlay: (() => void) | undefined;
    let unlistenPrev: (() => void) | undefined;
    let unlistenNext: (() => void) | undefined;
    let unlistenState: (() => void) | undefined;

    const enterTrayLowMemoryMode = () => {
      isTrayModeRef.current = true;
      setIsTrayMode(true);
      setShowYoutubeVideo(false);
      document.documentElement.classList.add('app-minimized');
      invoke('trim_memory').catch(() => {});
    };

    const exitTrayLowMemoryMode = () => {
      isTrayModeRef.current = false;
      setIsTrayMode(false);
      document.documentElement.classList.remove('app-minimized');
      syncPlaybackStateNow();
    };

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
        enterTrayLowMemoryMode();
      } else {
        exitTrayLowMemoryMode();
      }
    }).then(fn => { unlistenState = fn; });

    // Lắng nghe sự kiện visibility chuẩn của trình duyệt / WebView2
    const handleVisibilityChange = () => {
      if (document.hidden) {
        enterTrayLowMemoryMode();
      } else {
        exitTrayLowMemoryMode();
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
  }, [syncPlaybackStateNow]);

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
      if (ytMusicFallbackActiveRef.current && onlineAudioRef.current?.src) {
        onlineAudioRef.current.currentTime = secs;
      } else {
        sendYtCmd('seekTo', [secs, true]);
      }
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

    // When recommendation mode is active ('fresh' = 100% outside playlist, 'mix' = alternating old & new), follow handleNext
    if (recommendModeRef.current !== 'off') {
      handleNext(true);
      return;
    }

    const nextTrack = getNextPlaylistTrack(currentTrackRef.current);
    if (nextTrack) {
      playTrackInternal(nextTrack);
    }
  };

  const handleUserPrev = () => {
    const isDedicatedPlaylist = isScopedPlaylistContext(activeQueueContextRef.current);

    if (!isDedicatedPlaylist && playbackHistoryStackRef.current.length > 0) {
      const cur = currentTrackRef.current;
      if (cur) {
        playbackForwardStackRef.current.push(cur);
      }
      const prevTrack = playbackHistoryStackRef.current.pop()!;
      playTrackInternal(prevTrack, true);
      showNotification(`⏮ ${prevTrack.title} - ${prevTrack.artist}`);
      return;
    }

    // Move to previous track in active playlist
    const list = getEffectiveQueue();
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
        setLocalFolder(selected);
        localStorage.setItem('spytify_local_folder', selected);
        const scanned = await invoke<Track[]>('scan_music_folder', { folderPath: selected });
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
        setTracks(prev => {
          return deduplicateTracks([...scanned, ...prev]);
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

      // Crucial fix: Mark the online track as downloaded in-place so its row in the current table remains intact,
      // and prepend savedTrack so it's instantly visible under "Nhạc trên máy" without breaking track tables!
      setTracks(prev => {
        const updated = prev.map(t => {
          if (
            t.id === track.id ||
            (t.path_or_url && t.path_or_url === track.path_or_url) ||
            (t.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
             t.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
          ) {
            return { ...t, is_downloaded: true };
          }
          return t;
        });

        const hasSaved = updated.some(t => t.id === savedTrack.id || (t.path_or_url && t.path_or_url === savedTrack.path_or_url));
        return hasSaved ? updated : [savedTrack, ...updated];
      });

      // If the online track was in favorites, also add the savedTrack ID to favorites
      if (favorites.has(track.id)) {
        setFavorites(prev => new Set(prev).add(savedTrack.id));
        invoke('db_add_favorite', { trackId: savedTrack.id }).catch(() => {});
      }

      // If this was the playing track, mark it as downloaded without mutating active player stream
      if (
        currentTrackRef.current?.id === track.id ||
        (currentTrackRef.current?.path_or_url && currentTrackRef.current.path_or_url === track.path_or_url) ||
        (currentTrackRef.current?.title.trim().toLowerCase() === track.title.trim().toLowerCase() &&
         currentTrackRef.current?.artist.trim().toLowerCase() === track.artist.trim().toLowerCase())
      ) {
        const updatedCurrent: Track = {
          ...currentTrackRef.current,
          is_downloaded: true,
        };
        currentTrackRef.current = updatedCurrent;
        setCurrentTrack(updatedCurrent);
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
        try {
          const scanned = await invoke<Track[]>('scan_music_folder', { folderPath: selected });
          if (scanned && scanned.length > 0) {
            setTracks(prev => deduplicateTracks([...scanned, ...prev]));
          }
        } catch {}
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
    const safeUrl = result.url_or_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const deterministicId = `${result.source}_${safeUrl}`;

    // Prevent duplicate entries by reusing existing track if already in library
    const existing = tracks.find(
      t => t.id === deterministicId ||
           (t.path_or_url && t.path_or_url === result.url_or_id) ||
           (t.title.trim().toLowerCase() === result.title.trim().toLowerCase() &&
            t.artist.trim().toLowerCase() === result.artist.trim().toLowerCase())
    );

    const track: Track = existing || {
      id: deterministicId,
      title: result.title,
      artist: result.artist,
      album: result.album,
      duration_secs: result.duration_secs,
      path_or_url: result.url_or_id,
      cover_art: result.thumbnail,
      source: result.source,
    };

    activeQueueContextRef.current = currentView;
    setActiveQueueContext(currentView);
    setTracks(prev => {
      const filtered = prev.filter(t => t.id !== track.id && t.path_or_url !== track.path_or_url);
      return [track, ...filtered];
    });
    playTrackInternal(track);
  };

  const localCount = tracks.filter(t => t.source === 'local').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-[#a0a0a0] overflow-hidden select-none font-sans">
      {/* Spy Minimalist Discord-style Startup Screen */}
      {!isTrayMode && showSplash && (
        <SplashScreen
          onFinish={() => setShowSplash(false)}
          themeMode={themeMode}
          accentColor={accentColor}
        />
      )}

      {/* ─── NEXT TRACK POPUP (SMOOTH PLAYBACK FLOATING WIDGET) ── */}
      {!isTrayMode && (nextTrackPopup || (isAiLoadingNext && currentTrack)) && isNextTrackPopupEnabled && (
        <div 
          className={`fixed right-6 z-50 p-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex flex-col gap-2.5 transition-all duration-300 ${
            themeMode === 'light' ? 'bg-white/95' : 'bg-[#0c0c14]/95'
          } ${
            showYoutubeVideo ? 'bottom-[300px]' : 'bottom-24'
          } ${
            isNextTrackPopupCollapsed ? 'w-80' : 'w-88 max-w-[calc(100vw-3rem)]'
          }`}
          style={{
            borderColor: `${accentColor}60`,
            boxShadow: themeMode === 'light'
              ? `0 12px 35px rgba(15, 23, 42, 0.14), 0 0 14px ${accentColor}25`
              : `0 12px 35px rgba(0,0,0,0.8), 0 0 16px ${accentColor}30`
          }}
        >
          {isNextTrackPopupCollapsed && nextTrackPopup ? (
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <span className="text-[10px] font-mono font-bold uppercase flex-shrink-0" style={{ color: accentColor }}>
                  {currentTrack ? `⏭ ${getTranslation(language, 'popup.nextTrack')}:` : '✨ AI MIX:'}
                </span>
                <span className="text-xs font-semibold text-white truncate" title={nextTrackPopup.title}>
                  {nextTrackPopup.title}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    if ((!currentTrack || shouldNextBeNewDiscovery()) && preloadedNextTrackRef.current) {
                      playTrackInternal(preloadedNextTrackRef.current);
                    } else {
                      handleUserNext();
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
                  className="p-1 text-[#666] hover:text-white cursor-pointer text-xs leading-none"
                  title={getTranslation(language, 'popup.close')}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (isAiLoadingNext && !nextTrackPopup) ? (
            <div className="flex flex-col gap-2.5 py-1">
              <style>{`
                @keyframes spytifyPopupPulse {
                  0%, 100% { transform: scale(1) translateY(0px); }
                  50% { transform: scale(1.08) translateY(-3px); }
                }
              `}</style>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: accentColor }}>
                  <Sparkles className="w-3 h-3 animate-spin" />
                  {getTranslation(language, 'popup.aiAnalyzing')}
                </span>
                <button 
                  onClick={handleToggleNextTrackPopupEnabled}
                  className="text-[#666] hover:text-white transition-colors cursor-pointer text-xs p-1 leading-none"
                  title={getTranslation(language, 'popup.close')}
                >
                  ✕
                </button>
              </div>

              {/* Spy Logo Breathing Glow Box & Analyzing Text */}
              <div className="flex flex-col items-center justify-center py-2.5 select-none">
                <div
                  style={{
                    animation: 'spytifyPopupPulse 1.2s ease-in-out infinite',
                    filter: `drop-shadow(0 4px 16px ${accentColor}80)`,
                  }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#151520] border border-[#2a2a3e] p-2"
                >
                  <img
                    src={spytifyLogo}
                    alt="Spytify"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-white animate-pulse">
                  {getTranslation(language, 'popup.findingRelated')}
                </p>
                <p className="text-[10px] font-mono text-[#888899] mt-0.5 truncate max-w-[220px]">
                  {currentTrack?.title} • {currentTrack?.artist}
                </p>
              </div>

              {/* Shimmer Skeleton Placeholder */}
              <div className="space-y-2 p-2 rounded-xl bg-[#12121a]/60 border border-[#1e1e2c]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#20202e] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-4/5 bg-[#252536] rounded-full animate-pulse" />
                    <div className="h-2 w-2/5 bg-[#1b1b26] rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ) : nextTrackPopup ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1c1c28] pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: accentColor }}>
                    <span className="animate-pulse">{currentTrack ? '⏭' : '✨'}</span>{' '}
                    {currentTrack ? getTranslation(language, 'popup.nextTrack') : getTranslation(language, 'popup.aiMixRecommend')}
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
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, nextTrackPopup.thumbnail)}
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
                    if ((!currentTrack || shouldNextBeNewDiscovery()) && preloadedNextTrackRef.current) {
                      playTrackInternal(preloadedNextTrackRef.current);
                    } else {
                      handleUserNext();
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
                              src={optimizeThumbnailUrl(alt.cover_art, alt.path_or_url || alt.id)} 
                              alt={alt.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, alt.path_or_url || alt.id)}
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
          ) : null}
        </div>
      )}
      {/* Toast Notification — Invincible Accent (Hiển thị ngay trên thanh Play) */}
      {!isTrayMode && statusMessage && (
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

      {!isTrayMode && (
        <>
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

          {/* Software Update Modal */}
          {updateInfo && (
            <UpdateModal
              isOpen={isUpdateModalOpen}
              updateInfo={updateInfo}
              accentColor={accentColor}
              onClose={() => setIsUpdateModalOpen(false)}
            />
          )}
        </>
      )}

      {/* YouTube iframe — stable bottom-right positioning without jumping */}
      {ytVideoId && (
        <div
          className={`fixed bottom-24 right-6 w-80 h-48 rounded-xl bg-black shadow-2xl border border-[#222] z-40 transition-all duration-300 overflow-hidden ${
            showYoutubeVideo && !isTrayMode
              ? 'opacity-100 scale-100 pointer-events-auto shadow-[0_16px_36px_rgba(0,0,0,0.9)]'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          {showYoutubeVideo && !isTrayMode && (
            <button
              onClick={() => setShowYoutubeVideo(false)}
              className="absolute top-2 right-2 z-50 p-1.5 rounded-full bg-black/80 hover:bg-black text-white border border-[#333] cursor-pointer shadow-md transition-colors"
              title={getTranslation(language, 'header.minimizeMv')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <iframe
            ref={ytIframeRef}
            src={`https://www.youtube.com/embed/${ytVideoId}?enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
            onLoad={() => {
              try {
                ytIframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ event: 'listening', id: 1 }), '*'
                );
              } catch {}
            }}
            title="YouTube Player"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* SoundCloud Widget — hidden player */}
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

      {/* Main Layout (Unmounted in Tray Mode to free all UI/Image/Canvas RAM) */}
      {!isTrayMode && (
      <>
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
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
          {/* Header Bar — Minimalist */}
          <header className="h-12 px-4 sm:px-6 flex items-center justify-between border-b border-[#141416] bg-black/95 backdrop-blur z-50">
            <div className="flex items-center gap-2.5 text-xs font-medium text-[#888]">
              <button
                onClick={toggleSidebarCollapse}
                title={isSidebarCollapsed ? "Mở rộng thanh điều hướng (Ctrl+B)" : "Thu nhỏ thanh điều hướng (Ctrl+B)"}
                className="p-1.5 rounded-lg bg-[#101014] hover:bg-[#1c1c24] border border-[#202028] text-[#888899] hover:text-white transition-all cursor-pointer flex items-center justify-center group"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-[#00E5FF] group-hover:scale-110 transition-transform" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 group-hover:text-white transition-colors" />
                )}
              </button>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666]">
                {currentView === 'community'
                  ? 'TRẠM SÓNG & CỘNG ĐỒNG'
                  : currentView === 'search'
                  ? 'TÌM KIẾM'
                  : currentView === 'albums'
                  ? 'ALBUM CỦA BẠN'
                  : currentView === 'ai_mix'
                  ? 'AI MIX STUDIO'
                  : currentView === 'profile'
                  ? 'HỒ SƠ CÁ NHÂN'
                  : currentView === 'youtube'
                  ? 'YOUTUBE MUSIC'
                  : currentView === 'soundcloud'
                  ? 'SOUNDCLOUD'
                  : currentView === 'audius'
                  ? 'AUDIUS HI-FI'
                  : 'THỊNH HÀNH'}
              </span>
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
                  {showYoutubeVideo ? getTranslation(language, 'header.minimizeMv') : 'MV'}
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
          <div className={`flex-1 ${currentView === 'community' ? 'p-0 overflow-hidden flex flex-col' : 'overflow-y-auto px-7 py-5'}`}>
            {showVisualizer && currentView !== 'profile' && currentView !== 'ai_mix' && currentView !== 'community' && <AudioVisualizer isPlaying={isPlaying} language={language} accentColor={accentColor} source={currentTrack?.source} />}

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
            ) : currentView === 'community' ? (
              <CommunityView
                currentUser={currentUser}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
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
                downloadFolder={downloadFolder}
                onChangeDownloadFolder={handleChangeDownloadFolder}
                onOpenDownloadFolder={handleOpenDownloadFolder}
                onOpenUpdateModal={(info) => {
                  setUpdateInfo(info);
                  setIsUpdateModalOpen(true);
                }}
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
                    <span>{getTranslation(language, 'stream.findSong')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['Sơn Tùng M-TP', 'V-Pop Hot Hits', 'Lo-Fi Chill', 'Alan Walker', 'YOASOBI', 'The Weeknd'].map(t => (
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
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">{getTranslation(language, 'stream.soundcloudTitle')}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.soundcloudSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>{getTranslation(language, 'stream.findSong')}</span>
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
            ) : currentView === 'audius' ? (
              <div>
                <div className="mb-5 p-5 rounded-xl bg-[#080808] border border-[#181818] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 font-mono" style={{ color: accentColor }}>
                      <AudiusIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      AUDIUS OPEN HI-FI (320KBPS)
                    </span>
                    <h2 className="text-xl font-extrabold text-white mt-1 tracking-tight">{getTranslation(language, 'stream.audiusTitle')}</h2>
                    <p className="text-xs text-[#666] mt-0.5">{getTranslation(language, 'stream.audiusSub')}</p>
                  </div>
                  <button
                    onClick={() => setCurrentView('search')}
                    className="px-4 py-2 rounded bg-white hover:bg-neutral-200 text-black font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>{getTranslation(language, 'stream.findSong')}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {['EDM Festival', 'Synthwave Retro', 'Trap & Bass', 'Lo-Fi Study Beats', 'Future Bass', 'Deep House 320K'].map(t => (
                    <button
                      key={t}
                      onClick={async () => {
                        showNotification(`${getTranslation(language, 'toast.searching')}: "${t}" (Audius 320K)...`);
                        const r = await handleSearchOnline(t, 'audius');
                        if (r.length) handlePlaySearchResult(r[0]);
                      }}
                      className="px-3 py-1 bg-[#0a0a0a] hover:bg-[#141414] border border-[#1c1c1c] text-xs text-[#888] hover:text-white rounded flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <AudiusIcon className="w-3 h-3" style={{ color: accentColor }} />{t}
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
                      {currentView === 'local' ? getTranslation(language, 'view.localBadge') : getTranslation(language, 'view.favoritesBadge')}
                    </span>
                    <h2 className="text-2xl font-black text-white mt-1 tracking-tight">
                      {currentView === 'local' ? getTranslation(language, 'view.localTitle') : getTranslation(language, 'view.favoritesTitle')}
                    </h2>
                    <p className="text-xs text-[#777] mt-0.5">{getTranslation(language, 'view.dbSyncedCount', { count: displayedTracks.length })}</p>
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
        upcomingModeLabel={nextTrackPopup?.modeLabel || getPlaylistModeLabel(activeQueueContext)}
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
        isNextTrackPopupEnabled={Boolean(isNextTrackPopupEnabled && nextTrackPopup)}
        onToggleNextTrackPopupEnabled={handleToggleNextTrackPopupEnabled}
      />
      </>
      )}
    </div>
  );
}
