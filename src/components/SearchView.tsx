import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Loader2, Play, Music, Disc3, Sparkles, ArrowUpRight, X } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { SearchResult, Track } from '../types';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface SearchViewProps {
  onPlaySearchResult: (result: SearchResult) => void;
  onSearchOnline: (query: string, source: string) => Promise<SearchResult[]>;
  localTracks: Track[];
  onTrackSelect: (track: Track) => void;
  currentTrack?: Track | null;
  accentColor?: string;
  language?: LanguageCode;
}

const POPULAR = ['Die With A Smile', 'APT. ROSÉ', 'Sơn Tùng M-TP', 'Creepy Nuts', 'Alan Walker', 'V-Pop 2025', 'Lo-Fi Beats', 'Billie Eilish'];

type Filter = 'all' | 'youtube' | 'soundcloud' | 'audius' | 'local';

export const SearchView: React.FC<SearchViewProps> = ({ 
  onPlaySearchResult, onSearchOnline, localTracks, onTrackSelect,
  currentTrack,
  accentColor = '#00E5FF',
  language = 'vi',
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isTyping, setIsTyping] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions when clicking anywhere outside the search container
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setIsTyping(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Debounced auto-complete keyword suggestions only when actively typing
  useEffect(() => {
    if (!isTyping) {
      setShowSuggestions(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const remoteSug = await invoke<string[]>('get_search_suggestions', { query: q });
        const localMatches = localTracks
          .filter(t => t.title.toLowerCase().includes(q.toLowerCase()) || t.artist.toLowerCase().includes(q.toLowerCase()))
          .map(t => t.title)
          .slice(0, 3);
        const combined = Array.from(new Set([...localMatches, ...remoteSug])).slice(0, 7);
        setSuggestions(combined);
        if (combined.length > 0) {
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error('Failed to get suggestions:', e);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isTyping, localTracks]);

  const doSearch = async (q: string, f: Filter) => {
    if (!q.trim()) return;
    setIsTyping(false);
    setShowSuggestions(false);
    setLoading(true);
    try {
      const res = await onSearchOnline(q.trim(), f === 'all' ? 'all' : f);
      // Keep memory low by capping DOM results to 24 items
      setResults(res ? res.slice(0, 24) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    doSearch(query, filter); 
  };
  
  const handleFilterChange = (f: Filter) => { 
    setFilter(f); 
    if (query) doSearch(query, f); 
  };
  
  const handleQuick = (term: string) => { 
    setQuery(term); 
    doSearch(term, filter); 
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
      return;
    }

    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        const chosen = suggestions[selectedIndex];
        setQuery(chosen);
        setShowSuggestions(false);
        doSearch(chosen, filter);
      }
    }
  };

  const filteredLocal = localTracks.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.artist.toLowerCase().includes(query.toLowerCase())
  );

  const sourceIcon = (source: string, sm = false) => {
    const cls = sm ? 'w-3 h-3' : 'w-3.5 h-3.5';
    if (source === 'youtube') return <YoutubeIcon className={`${cls} text-[#ff4e6b]`} />;
    if (source === 'soundcloud') return <SoundCloudIcon className={`${cls} text-orange-400`} />;
    if (source === 'audius') return <AudiusIcon className={`${cls}`} style={{ color: accentColor }} />;
    return <Disc3 className={`${cls} text-white`} />;
  };

  const filters: { id: Filter; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: getTranslation(language, 'search.filterAll') },
    { id: 'youtube', label: getTranslation(language, 'search.filterYoutube'), icon: <YoutubeIcon className="w-3 h-3 text-[#ff4e6b]" /> },
    { id: 'soundcloud', label: getTranslation(language, 'search.filterSoundcloud'), icon: <SoundCloudIcon className="w-3 h-3 text-orange-400" /> },
    { id: 'audius', label: getTranslation(language, 'search.filterAudius'), icon: <AudiusIcon className="w-3 h-3 text-white" /> },
    { id: 'local', label: getTranslation(language, 'search.filterLocal') },
  ];

  return (
    <div className="flex-1 max-w-4xl pb-16">
      <div className="max-w-2xl mb-6">
        <h2 className="text-lg font-bold tracking-tight text-white mb-3">
          {getTranslation(language, 'search.title')}
        </h2>
        <div className="relative z-10" ref={searchContainerRef}>
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-[#666] absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setIsTyping(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={getTranslation(language, 'search.placeholder')}
              className="w-full pl-10 pr-32 py-2.5 bg-[#0a0a0d] hover:bg-[#121216] focus:bg-[#121216] text-white rounded-lg text-xs outline-none border border-[#1e1e26] transition-all"
              style={{ borderColor: query ? `${accentColor}60` : undefined }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                  setShowSuggestions(false);
                  setIsTyping(false);
                  inputRef.current?.focus();
                }}
                className="absolute right-16 p-1 text-[#666] hover:text-white transition-colors cursor-pointer"
                title={getTranslation(language, 'search.clear')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
                boxShadow: `0 0 10px ${accentColor}40`,
              }}
              className="absolute right-1.5 px-4 py-1.5 hover:opacity-90 active:scale-95 disabled:opacity-50 text-[11px] font-bold rounded-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : getTranslation(language, 'search.btn')}
            </button>
          </form>

          {/* Keyword Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              className="absolute top-full left-0 right-0 mt-2 py-1.5 rounded-xl bg-[#0e0e14] border shadow-2xl z-50 font-sans"
              style={{
                borderColor: `${accentColor}50`,
                boxShadow: `0 16px 36px rgba(0,0,0,0.9), 0 0 16px ${accentColor}25`
              }}
            >
              <div className="px-3.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#666] flex items-center justify-between border-b border-[#1c1c28] mb-1">
                <span className="flex items-center gap-1.5" style={{ color: accentColor }}>
                  <Sparkles className="w-3 h-3" />
                  {getTranslation(language, 'search.suggestions')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[#555]">{getTranslation(language, 'search.hintNav')}</span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(false)}
                    className="p-0.5 rounded hover:bg-[#222] text-[#777] hover:text-white transition-colors cursor-pointer"
                    title={getTranslation(language, 'popup.close')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {suggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={() => {
                      setQuery(sug);
                      setShowSuggestions(false);
                      doSearch(sug, filter);
                    }}
                    className={`px-3.5 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      selectedIndex === idx 
                        ? 'bg-[#181824] text-white font-semibold' 
                        : 'text-[#bbb] hover:text-white hover:bg-[#14141c]'
                    }`}
                    style={selectedIndex === idx ? { color: accentColor } : undefined}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Search className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
                      <span className="truncate">{sug}</span>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-[#555] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => handleFilterChange(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-white text-black font-bold shadow-[0_0_8px_rgba(255,255,255,0.2)]'
                  : 'bg-[#0d0d10] text-[#888899] hover:text-white hover:bg-[#16161e] border border-[#1c1c24]'
              }`}
            >
              {f.icon}{f.label}
            </button>
          ))}
        </div>

        {/* Quick searches */}
        {!query && (
          <div className="mt-4 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#666] uppercase font-mono">{getTranslation(language, 'search.quick')}</span>
            {POPULAR.map(term => (
              <button
                key={term}
                onClick={() => handleQuick(term)}
                className="px-2.5 py-0.5 rounded-full bg-[#101014] hover:bg-[#181820] text-[#888] hover:text-white text-[11px] border border-[#1a1a22] transition-colors cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#888] py-8">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
          <span>{getTranslation(language, 'search.loading')}</span>
        </div>
      )}

      {/* Local tracks matched */}
      {filter !== 'youtube' && filter !== 'soundcloud' && filter !== 'audius' && filteredLocal.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wider font-mono">
            {getTranslation(language, 'nav.localMusic')} ({filteredLocal.length})
          </h3>
          <div className="space-y-1">
            {filteredLocal.map(t => {
              const isActive = currentTrack?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => onTrackSelect(t)}
                  style={isActive ? { borderColor: `${accentColor}70`, backgroundColor: `${accentColor}12` } : undefined}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#0c0c10] hover:bg-[#14141a] border border-[#161620] cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#181820] flex-shrink-0 flex items-center justify-center text-[#555] border border-[#222]">
                      {t.cover_art ? (
                        <img
                          src={optimizeThumbnailUrl(t.cover_art, t.path_or_url || t.id)}
                          alt={t.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, t.path_or_url || t.id)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p 
                        className="text-xs font-semibold text-white transition-colors truncate"
                        style={isActive ? { color: accentColor } : undefined}
                      >
                        {t.title}
                      </p>
                      <p className="text-[11px] text-[#777] truncate">{t.artist}</p>
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Online results */}
      {results.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-wider font-mono">
            Online Results ({results.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {results.map((r, i) => {
              const isMatchCurrent = currentTrack && (
                r.url_or_id === currentTrack.path_or_url ||
                r.title.toLowerCase().trim() === currentTrack.title.toLowerCase().trim()
              );
              return (
                <div
                  key={i}
                  onClick={() => onPlaySearchResult(r)}
                  style={isMatchCurrent ? {
                    borderColor: `${accentColor}80`,
                    boxShadow: `0 0 16px ${accentColor}30`,
                    backgroundColor: `${accentColor}10`
                  } : undefined}
                  className="p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] transition-all flex items-center gap-3 cursor-pointer group shadow-sm hover:border-zinc-500/40"
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#16161e]">
                    {r.thumbnail ? (
                      <img
                        src={optimizeThumbnailUrl(r.thumbnail, r.url_or_id)}
                        alt={r.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, r.url_or_id)}
                        loading="lazy"
                        decoding="async"
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

                  <div className="overflow-hidden flex-1">
                    <p 
                      className="text-xs font-semibold text-white truncate transition-colors" 
                      title={r.title}
                      style={isMatchCurrent ? { color: accentColor } : undefined}
                    >
                      {r.title}
                    </p>
                    <p className="text-[11px] text-[#8e8e9f] truncate mt-0.5">{r.artist}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {sourceIcon(r.source, true)}
                      <span className="text-[10px] text-[#666] font-mono uppercase">{r.source}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
