import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Cpu, Sparkles, Play, Music, RefreshCw, Loader2, CheckCircle2, Sliders, Zap, Compass
} from 'lucide-react';
import { Track, User, RecommendationResult, TrainingReport, SearchResult } from '../types';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';

interface AiMixViewProps {
  currentUser: User | null;
  allTracks: Track[];
  onPlayTrack: (track: Track) => void;
  onOpenAuth: () => void;
  smartDjEnabled: boolean;
  onToggleSmartDj: () => void;
  accentColor?: string;
  language?: LanguageCode;
}

const DEFAULT_GENRES = [
  // ─── MOOD & LIFESTYLE VIBE PLAYLISTS ───
  'Low Cortisol & Chill',
  'Deep Focus & Working',
  'Lock In & Grind Mode',
  'Gym & Beast Workout',
  'Late Night Drive',
  'Coffee Shop & Study',
  'Rainy Day Acoustic',
  'Gaming & Phonk Rush',
  'Peaceful Sleep & Ambient',
  'Morning Boost & Vibes',

  // ─── MUSIC GENRES & REGIONAL HITS ───
  'K-Pop & Idol',
  'V-Pop Trending',
  'US-UK Pop Hits',
  'EDM & Festival Dance',
  'Lo-Fi Chill & Study',
  'Phonk & Drift Beats',
  'Hip-Hop, Rap & Trap',
  'Acoustic & Indie Ballad',
  'R&B & Neo-Soul',
  'J-Pop & Anime OST',
  'C-Pop & Mandopop',
  'Synthwave & Cyberpunk 80s',
  'Deep House & Club Remix',
  'City Pop & Retro Groove',
  'Rock & Alternative',
  'Drill & UK Bass',
  'Hyperpop & Glitchcore',
  'Jazz & Coffee Lounge',
  'Cinematic & Epic Soundtracks',
  'Nightcore & Speed Up Remix',
];

const GENRE_SEARCH_QUERIES: Record<string, string> = {
  // Mood & Activity Playlists
  'Low Cortisol & Chill': 'low cortisol playlist peaceful chill study relax aesthetic',
  'Deep Focus & Working': 'deep focus music for working study coding lofi ambient chill',
  'Lock In & Grind Mode': 'lock in playlist study grind phonk focus aesthetic beats',
  'Gym & Beast Workout': 'gym workout motivation aggressive phonk edm beast mode bass',
  'Late Night Drive': 'late night drive synthwave phonk chill playlist aesthetic',
  'Coffee Shop & Study': 'coffee shop ambience cozy study lofi acoustic playlist',
  'Rainy Day Acoustic': 'rainy day acoustic guitar cozy aesthetic playlist songs',
  'Gaming & Phonk Rush': 'gaming phonk drift high energy combat aggressive bass',
  'Peaceful Sleep & Ambient': 'peaceful sleep ambient music delta waves healing relaxation',
  'Morning Boost & Vibes': 'morning boost positive energy upbeat feel good acoustic pop',

  // Regional & Music Genres
  'K-Pop & Idol': 'kpop melon top 100 trending viral hits official mv audio',
  'V-Pop Trending': 'vpop thinh hanh trending hits official music video audio',
  'US-UK Pop Hits': 'billboard hot 100 global pop viral hits official audio',
  'EDM & Festival Dance': 'festival edm electronic dance banger progressive house official',
  'Lo-Fi Chill & Study': 'lofi chill beats study relax sleep beats official audio',
  'Phonk & Drift Beats': 'drift phonk brazilian phonk aggressive cowbell trending audio',
  'Hip-Hop, Rap & Trap': 'top trending rap hip hop trap bass boosted official audio',
  'Acoustic & Indie Ballad': 'acoustic indie ballad gentle guitar emotional official audio',
  'R&B & Neo-Soul': 'chill rnb soul smooth vibes contemporary groove official audio',
  'J-Pop & Anime OST': 'jpop anime viral opening theme song official music video',
  'C-Pop & Mandopop': 'cpop mandopop trending hot songs official music video audio',
  'Synthwave & Cyberpunk 80s': 'retrowave synthwave 80s cyberpunk electronic neon night drive',
  'Deep House & Club Remix': 'deep house club remix selected ibiza vocal chillout audio',
  'City Pop & Retro Groove': 'japanese city pop 80s retro funk groove aesthetic',
  'Rock & Alternative': 'popular rock alternative hits modern indie rock official audio',
  'Drill & UK Bass': 'uk drill bass rap heavy 808 trending beats audio',
  'Hyperpop & Glitchcore': 'hyperpop glitchcore energetic futuristic pop audio',
  'Jazz & Coffee Lounge': 'smooth jazz coffee shop cozy lounge instrumental audio',
  'Cinematic & Epic Soundtracks': 'epic cinematic orchestral soundtrack hans zimmer style trailer',
  'Nightcore & Speed Up Remix': 'nightcore speed up viral tiktok remix official audio',
};

const getDefaultGenreForLang = (lang: LanguageCode): string => {
  switch (lang) {
    case 'ko': return 'K-Pop & Idol';
    case 'ja': return 'J-Pop & Anime OST';
    case 'zh-CN': return 'C-Pop & Mandopop';
    case 'en-US': return 'US-UK Pop Hits';
    case 'vi':
    default: return 'V-Pop Trending';
  }
};

export const AiMixView: React.FC<AiMixViewProps> = ({
  currentUser,
  allTracks,
  onPlayTrack,
  onOpenAuth,
  smartDjEnabled,
  onToggleSmartDj,
  accentColor = '#ff2a55',
  language = 'vi',
}) => {
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [report, setReport] = useState<TrainingReport | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Genre recommendations state
  const [selectedGenre, setSelectedGenre] = useState<string>(() => getDefaultGenreForLang(language));
  const [genreTracks, setGenreTracks] = useState<Track[]>([]);
  const [loadingGenreTracks, setLoadingGenreTracks] = useState(false);

  useEffect(() => {
    setSelectedGenre(getDefaultGenreForLang(language));
  }, [language]);

  // Available genres based on AI report or defaults
  const availableGenres = useMemo(() => {
    if (report?.top_genres && report.top_genres.length > 0) {
      // Merge AI top genres with default genres ensuring uniqueness
      const set = new Set([...report.top_genres, ...DEFAULT_GENRES]);
      return Array.from(set);
    }
    return DEFAULT_GENRES;
  }, [report?.top_genres]);

  const fetchRecommendations = async () => {
    if (!currentUser || allTracks.length === 0) return;
    setLoadingRecs(true);
    try {
      const recs = await invoke<RecommendationResult[]>('ai_recommend_tracks', {
        userId: currentUser.id,
        candidates: allTracks,
      });
      setRecommendations(recs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  };

  const loadGenreTracks = async (genre: string) => {
    setLoadingGenreTracks(true);
    try {
      // 1. Filter matching local/cached tracks from allTracks
      const gLower = genre.toLowerCase().split('/')[0].trim();
      const localMatches = allTracks.filter(t => {
        const text = `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase();
        return text.includes(gLower) || (gLower === 'v-pop' && (text.includes('vpop') || text.includes('sơn tùng') || text.includes('vũ')));
      }).slice(0, 6);

      // 2. Fetch online tracks for that genre
      const query = GENRE_SEARCH_QUERIES[genre] || `${genre} popular hits official audio`;
      const searchResults = await invoke<SearchResult[]>('search_online', {
        query,
        source: 'youtube',
      });

      const onlineTracks: Track[] = (searchResults || []).slice(0, 12).map((res, idx) => ({
        id: `genre_${genre}_${idx}_${Date.now()}`,
        title: res.title,
        artist: res.artist,
        album: res.album || genre,
        duration_secs: res.duration_secs,
        path_or_url: res.url_or_id,
        cover_art: res.thumbnail,
        source: res.source,
      }));

      // Combine and deduplicate
      const combined = [...localMatches];
      for (const ot of onlineTracks) {
        if (!combined.some(t => t.title.toLowerCase() === ot.title.toLowerCase())) {
          combined.push(ot);
        }
      }
      setGenreTracks(combined);
    } catch (err) {
      console.error('Failed to load genre tracks:', err);
    } finally {
      setLoadingGenreTracks(false);
    }
  };

  const handleTrainAi = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    setTraining(true);
    setTrainingProgress(10);

    const t1 = setTimeout(() => setTrainingProgress(35), 300);
    const t2 = setTimeout(() => setTrainingProgress(70), 700);

    try {
      const rep = await invoke<TrainingReport>('ai_train_model', { userId: currentUser.id });
      setTrainingProgress(100);
      setReport(rep);
      if (rep.top_genres && rep.top_genres.length > 0) {
        setSelectedGenre(rep.top_genres[0]);
      }
      await fetchRecommendations();
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setTimeout(() => setTraining(false), 500);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRecommendations();
    }
  }, [currentUser, allTracks.length]);

  useEffect(() => {
    loadGenreTracks(selectedGenre);
  }, [selectedGenre]);

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto select-none">
      {/* Header Banner — Spy AI Studio */}
      <div className="mb-6 p-5 rounded-2xl bg-[#0a0a0d] border border-[#161620] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span 
              className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded border font-mono flex items-center gap-1"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
              }}
            >
              <Cpu className="w-3 h-3" style={{ color: accentColor }} />
              {getTranslation(language, 'aimix.badge')}
            </span>
            <span className="text-[10px] text-[#777] font-mono">
              {getTranslation(language, 'aimix.badgeSub')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {getTranslation(language, 'aimix.title')}
          </h2>
          <p className="text-xs text-[#8e8e9f] mt-1 max-w-lg leading-relaxed">
            {getTranslation(language, 'aimix.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTrainAi}
            disabled={training}
            style={{
              backgroundColor: accentColor,
              color: getContrastTextColor(accentColor),
              boxShadow: `0 0 12px ${accentColor}40`,
            }}
            className="px-4 py-2 hover:opacity-90 active:scale-95 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {training ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{getTranslation(language, 'aimix.analyzing', { progress: trainingProgress })}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>{getTranslation(language, 'aimix.trainBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Smart DJ Toggle Card */}
      <div className="mb-6 p-4 rounded-xl bg-[#0d0d12] border border-[#1a1a24] flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#14141c] flex items-center justify-center text-white border border-[#222]">
            <Sliders className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">
              {getTranslation(language, 'aimix.smartDjTitle')}
            </h3>
            <p className="text-[11px] text-[#777]">
              {getTranslation(language, 'aimix.smartDjDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleSmartDj}
          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
            smartDjEnabled ? '' : 'bg-[#22222a]'
          }`}
          style={smartDjEnabled ? { backgroundColor: accentColor } : undefined}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              smartDjEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Training Report */}
      {report && (
        <div className="mb-6 p-4 rounded-xl bg-[#0d0d12] border border-[#22222c] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
            <span>{getTranslation(language, 'aimix.reportComplete', { status: report.status })}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.analyzedData')}</span>
              <p className="text-sm font-bold text-white mt-0.5">
                {getTranslation(language, 'aimix.tracksCount', { count: report.tracks_analyzed })}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.accuracy')}</span>
              <p className="text-sm font-bold mt-0.5" style={{ color: accentColor }}>
                {(report.accuracy > 1 ? report.accuracy : report.accuracy * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.epochs')}</span>
              <p className="text-sm font-bold text-white mt-0.5">
                {getTranslation(language, 'aimix.epochsCount', { count: report.epochs })}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'aimix.topGenres')}</span>
              <p className="text-sm font-bold text-white mt-0.5 truncate" title={report.top_genres?.join(', ')}>
                {report.top_genres?.join(', ') || getTranslation(language, 'aimix.diverse')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── GENRE-BASED RECOMMENDATIONS (Đề xuất theo thể loại hay nghe) ─── */}
      <div className="mb-8 p-5 rounded-2xl bg-[#0a0a0e] border border-[#181822] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="text-sm font-bold text-white tracking-wide">
                {getTranslation(language, 'aimix.genreSectionTitle')}
              </h3>
              <span 
                className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border"
                style={{
                  color: accentColor,
                  backgroundColor: `${accentColor}12`,
                  borderColor: `${accentColor}25`,
                }}
              >
                AI Curated
              </span>
            </div>
            <p className="text-xs text-[#777] mt-1">
              {getTranslation(language, 'aimix.genreSectionSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {genreTracks.length > 0 && (
              <button
                onClick={() => onPlayTrack(genreTracks[0])}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{getTranslation(language, 'aimix.playGenreAll')}</span>
              </button>
            )}
            <button
              onClick={() => loadGenreTracks(selectedGenre)}
              disabled={loadingGenreTracks}
              className="p-1.5 rounded-lg bg-[#14141c] hover:bg-[#1c1c28] text-[#888] hover:text-white transition-all cursor-pointer border border-[#22222e]"
              title={getTranslation(language, 'aimix.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGenreTracks ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Genre Selector Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
          {availableGenres.map((genre, idx) => {
            const isSelected = selectedGenre === genre;
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? ''
                    : 'bg-[#121218] text-[#9e9ea7] border-[#1e1e28] hover:text-white hover:bg-[#1a1a24]'
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: accentColor,
                        color: getContrastTextColor(accentColor),
                        borderColor: accentColor,
                        boxShadow: `0 0 10px ${accentColor}35`,
                      }
                    : undefined
                }
              >
                {idx === 0 && <span className="text-[10px]">⭐</span>}
                <span>{genre}</span>
              </button>
            );
          })}
        </div>

        {/* Tracks List for Selected Genre */}
        {loadingGenreTracks ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#666] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
            <p className="text-xs">{getTranslation(language, 'aimix.loadingGenre')}</p>
          </div>
        ) : genreTracks.length === 0 ? (
          <div className="text-center py-8 text-[#666]">
            <p className="text-xs">{getTranslation(language, 'aimix.noGenreTracks')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {genreTracks.map((track) => {
              const isLiveItem = track.source === 'youtube' && (!track.duration_secs || track.duration_secs <= 0);
              const mins = Math.floor(track.duration_secs / 60);
              const secs = (track.duration_secs % 60).toString().padStart(2, '0');
              const durStr = track.duration_secs > 0 ? `${mins}:${secs}` : '';

              return (
                <div
                  key={track.id}
                  onClick={() => onPlayTrack(track)}
                  className="p-2.5 rounded-xl bg-[#0e0e13] hover:bg-[#15151e] border border-[#1a1a24] hover:border-[#2a2a38] transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                      {track.cover_art ? (
                        <img
                          src={optimizeThumbnailUrl(track.cover_art, track.path_or_url || track.id)}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, track.path_or_url || track.id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#555]">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-4 h-4 fill-current text-white" />
                      </div>
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors" title={track.title}>
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#8e8e9f] truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isLiveItem ? (
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        LIVE
                      </span>
                    ) : (
                      <>
                        {durStr && <span className="text-[10px] text-[#555] font-mono">{durStr}</span>}
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#181822] text-[#888] border border-[#22222e]">
                          {track.source === 'youtube' ? 'YT Stream' : track.source === 'soundcloud' ? 'SoundCloud' : track.source === 'audius' ? 'Audius' : 'Local'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommendations List (General AI Mix) */}
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-[#161620] pb-2">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
            {getTranslation(language, 'aimix.forYou', { count: recommendations.length })}
          </h3>
          <button
            onClick={fetchRecommendations}
            disabled={loadingRecs}
            className="text-[11px] text-[#777] hover:text-white flex items-center gap-1 cursor-pointer font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${loadingRecs ? 'animate-spin' : ''}`} />
            <span>{getTranslation(language, 'aimix.refresh')}</span>
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-xs">{getTranslation(language, 'aimix.noRecs')}</p>
            <p className="text-[11px] text-[#555] mt-1">{getTranslation(language, 'aimix.noRecsHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                onClick={() => onPlayTrack(rec.track)}
                className="p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                    {rec.track.cover_art ? (
                      <img
                        src={optimizeThumbnailUrl(rec.track.cover_art, rec.track.path_or_url || rec.track.id)}
                        alt={rec.track.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, rec.track.path_or_url || rec.track.id)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white" />
                    </div>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-white truncate transition-colors" title={rec.track.title}>
                      {rec.track.title}
                    </p>
                    <p className="text-[11px] text-[#8e8e9f] truncate">{rec.track.artist}</p>
                    {rec.reason && (
                      <p className="text-[10px] text-[#666] truncate mt-0.5">{rec.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span 
                    className="text-[10px] font-mono px-2 py-0.5 rounded border"
                    style={{
                      color: accentColor,
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}30`,
                    }}
                  >
                    {Math.round(rec.match_score > 1 ? rec.match_score : rec.match_score * 100)}% Match
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
