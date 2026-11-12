import React, { useState } from 'react';
import { Search, Loader2, Play, Music, Disc3 } from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { SearchResult, Track } from '../types';

interface SearchViewProps {
  onPlaySearchResult: (result: SearchResult) => void;
  onSearchOnline: (query: string, source: string) => Promise<SearchResult[]>;
  localTracks: Track[];
  onTrackSelect: (track: Track) => void;
}

const POPULAR = ['Die With A Smile', 'APT. ROSÉ', 'Sơn Tùng M-TP', 'Creepy Nuts', 'Alan Walker', 'V-Pop 2025', 'Lo-Fi Beats', 'Billie Eilish'];

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
    if (source === 'youtube') return <YoutubeIcon className={`${cls} text-[#ff4e6b]`} />;
    if (source === 'soundcloud') return <SoundCloudIcon className={`${cls} text-orange-400`} />;
    if (source === 'audius') return <AudiusIcon className={`${cls} text-[#ff2a55]`} />;
    return <Disc3 className={`${cls} text-white`} />;
  };

  const filters: { id: Filter; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'youtube', label: 'YouTube Stream', icon: <YoutubeIcon className="w-3 h-3 text-[#ff4e6b]" /> },
    { id: 'soundcloud', label: 'SoundCloud', icon: <SoundCloudIcon className="w-3 h-3 text-orange-400" /> },
    { id: 'audius', label: 'Audius Hi-Fi', icon: <AudiusIcon className="w-3 h-3 text-white" /> },
    { id: 'local', label: 'Bộ nhớ máy' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl mb-6">
        <h2 className="text-lg font-bold tracking-tight text-white mb-3">
          Tìm kiếm
        </h2>
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Search className="w-4 h-4 text-[#666] absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm nghệ sĩ, bài hát hoặc album..."
            className="w-full pl-10 pr-28 py-2.5 bg-[#0a0a0d] hover:bg-[#121216] focus:bg-[#121216] text-white rounded-lg text-xs outline-none border border-[#1e1e26] focus:border-[#ff2a55] transition-all"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-1.5 px-3.5 py-1.5 bg-[#ff2a55] hover:bg-white hover:text-black disabled:opacity-50 text-white text-[11px] font-bold rounded-md cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(255,42,85,0.3)]"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Tìm'}
          </button>
        </form>

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
            <span className="text-[10px] text-[#666] uppercase font-mono">Gợi ý:</span>
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
          <Loader2 className="w-4 h-4 animate-spin text-[#ff2a55]" />
          <span>Đang tìm kiếm trên các nguồn âm nhạc...</span>
        </div>
      )}

      {/* Local tracks matched */}
      {filter !== 'youtube' && filter !== 'soundcloud' && filter !== 'audius' && filteredLocal.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wider font-mono">
            Nhạc trên máy ({filteredLocal.length})
          </h3>
          <div className="space-y-1">
            {filteredLocal.map(t => (
              <div
                key={t.id}
                onClick={() => onTrackSelect(t)}
                className="flex items-center justify-between p-2 rounded-lg bg-[#0c0c10] hover:bg-[#14141a] border border-[#161620] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#181820] flex items-center justify-center text-[#555]">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#ff2a55] transition-colors">{t.title}</p>
                    <p className="text-[11px] text-[#777]">{t.artist}</p>
                  </div>
                </div>
                <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Online results */}
      {results.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-wider font-mono">
            Kết quả trực tuyến ({results.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => onPlaySearchResult(r)}
                className="p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#ff2a55]/40 transition-all flex items-center gap-3 cursor-pointer group shadow-sm"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#16161e]">
                  {r.thumbnail ? (
                    <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover" />
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
                  <p className="text-xs font-semibold text-white truncate group-hover:text-[#ff2a55] transition-colors" title={r.title}>
                    {r.title}
                  </p>
                  <p className="text-[11px] text-[#8e8e9f] truncate mt-0.5">{r.artist}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {sourceIcon(r.source, true)}
                    <span className="text-[10px] text-[#666] font-mono uppercase">{r.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
