import React, { useState } from 'react';
import { Search, Loader2, Play, Music, Disc3, Flame } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { SearchResult, Track } from '../types';

interface SearchViewProps {
  onPlaySearchResult: (result: SearchResult) => void;
  onSearchOnline: (query: string, source: string) => Promise<SearchResult[]>;
  localTracks: Track[];
  onTrackSelect: (track: Track) => void;
}

const POPULAR = ['Sơn Tùng M-TP', 'Alan Walker', 'V-Pop 2025', 'Lo-Fi Beats', 'Chill Hip Hop', 'Phùng Khánh Linh', 'The Weeknd'];

type Filter = 'all' | 'youtube' | 'soundcloud' | 'audius' | 'local';

export const SearchView: React.FC<SearchViewProps> = ({ onPlaySearchResult, onSearchOnline, localTracks, onTrackSelect }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const doSearch = async (q: string, f: Filter) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await onSearchOnline(q.trim(), f === 'all' ? 'all' : f);
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSearch(query, filter); };
  const handleFilterChange = (f: Filter) => { setFilter(f); if (query) doSearch(query, f); };
  const handleQuick = (term: string) => { setQuery(term); doSearch(term, filter); };

  const filteredLocal = localTracks.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.artist.toLowerCase().includes(query.toLowerCase())
  );

  const sourceIcon = (source: string, sm = false) => {
    const cls = sm ? 'w-3 h-3' : 'w-3.5 h-3.5';
    if (source === 'youtube') return <YoutubeIcon className={`${cls} text-red-400`} />;
    if (source === 'soundcloud') return <SoundCloudIcon className={`${cls} text-orange-400`} />;
    if (source === 'audius') return <AudiusIcon className={`${cls} text-[#cc00ff]`} />;
    return <Disc3 className={`${cls} text-[#00e5ff]`} />;
  };

  const filters: { id: Filter; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'youtube', label: 'YouTube Stream', icon: <YoutubeIcon className="w-3 h-3 text-red-400" /> },
    { id: 'soundcloud', label: 'SoundCloud', icon: <SoundCloudIcon className="w-3 h-3 text-orange-400" /> },
    { id: 'audius', label: 'Audius Open Hi-Fi', icon: <AudiusIcon className="w-3 h-3 text-[#cc00ff]" /> },
    { id: 'local', label: 'Bộ nhớ máy' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl mb-6">
        <h2 className="text-xl font-black tracking-tight text-white mb-3 flex items-center gap-2">
          <span>TÌM KIẾM ÂM NHẠC</span>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#1a1910] text-[#ffe600] border border-[#ffe600]/30">
            SPYTIFY HERO
          </span>
        </h2>
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-[#666] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm nghệ sĩ, bài hát hoặc album..."
            className="w-full pl-10 pr-28 py-2.5 bg-[#0a0a0c] hover:bg-[#111114] focus:bg-[#111114] text-white rounded-lg text-xs outline-none border border-[#1e1e24] focus:border-[#ffe600] transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 px-3.5 py-1.5 bg-[#ffe600] hover:bg-[#00e5ff] disabled:opacity-50 text-black text-[11px] font-black rounded-md cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(255,230,0,0.3)]"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Tìm'}
          </button>
        </form>

        {/* Filter Pills — Invincible Hero Style */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => handleFilterChange(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-gradient-to-r from-[#ffe600] to-[#00e5ff] text-black font-black shadow-[0_0_10px_rgba(255,230,0,0.35)]'
                  : 'bg-[#0d0d10] text-[#888] hover:text-white hover:bg-[#16161c] border border-[#1c1c22]'
              }`}
            >
              {f.icon}{f.label}
            </button>
          ))}
        </div>

        {/* Popular Tags */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 text-[11px]">
          <span className="text-[#666] flex items-center gap-1 font-medium flex-shrink-0">
            <Flame className="w-3 h-3 text-[#ffe600]" />Xu hướng:
          </span>
          {POPULAR.map(t => (
            <button
              key={t}
              onClick={() => handleQuick(t)}
              className="px-2.5 py-0.5 bg-[#08080a] hover:bg-[#141418] text-[#888] hover:text-[#00e5ff] rounded border border-[#181820] flex-shrink-0 cursor-pointer transition-colors text-[10px]"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-[#ffe600]">
          <Loader2 className="w-7 h-7 animate-spin drop-shadow-[0_0_8px_#ffe600]" />
        </div>
      )}

      {/* Online Results Grid */}
      {!loading && results.length > 0 && filter !== 'local' && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 border-b border-[#141414] pb-2">
            <h3 className="text-sm font-bold text-white tracking-wider uppercase">
              KẾT QUẢ TRỰC TUYẾN
            </h3>
            <span className="text-[11px] text-[#555] font-mono">{results.length} bài hát</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {results.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item)}
                className="bg-[#0a0a0a] hover:bg-[#141414] p-2.5 rounded-lg border border-[#161616] hover:border-[#222] transition-all group cursor-pointer flex flex-col"
              >
                <div className="w-full aspect-square rounded bg-[#111] overflow-hidden mb-2 relative">
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#333]">
                      <Music className="w-8 h-8" />
                    </div>
                  )}
                  {/* Play Overlay */}
                  <div className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[#ffe600] hover:bg-[#00e5ff] text-black flex items-center justify-center shadow-[0_0_10px_rgba(255,230,0,0.4)] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  {/* Format Tag */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/85 text-white/90 flex items-center gap-1">
                    {sourceIcon(item.source, true)}
                    <span className="uppercase">{item.source}</span>
                  </div>
                </div>
                <span className="font-semibold text-white text-xs truncate mb-0.5" title={item.title}>
                  {item.title}
                </span>
                <span className="text-[11px] text-[#666] truncate font-mono">{item.artist}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Local Matches */}
      {query && filter !== 'youtube' && filter !== 'soundcloud' && filter !== 'audius' && filteredLocal.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wider text-[#777]">
            Trùng khớp trên máy ({filteredLocal.length})
          </h3>
          <div className="space-y-1">
            {filteredLocal.slice(0, 8).map(track => (
              <div
                key={track.id}
                onClick={() => onTrackSelect(track)}
                className="flex items-center justify-between p-2 rounded hover:bg-[#0f0f0f] border border-transparent hover:border-[#1a1a1a] cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-[#161616] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {track.cover_art ? (
                      <img src={track.cover_art} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-4 h-4 text-[#444]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-white group-hover:text-[#00e5ff] transition-colors">
                      {track.title}
                    </h4>
                    <p className="text-[11px] text-[#666]">{track.artist}</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
