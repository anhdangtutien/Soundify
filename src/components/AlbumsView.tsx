import React, { useState, useMemo } from 'react';
import { 
  Plus, Disc, Play, Trash2, Music, ArrowLeft, Clock3, FolderPlus, 
  Sparkles, Layers, Check, X
} from 'lucide-react';
import { Track, UserAlbum } from '../types';
import { TrackTable } from './TrackTable';
import { deduplicateTracks } from '../utils/trackUtils';

interface AlbumsViewProps {
  albums: UserAlbum[];
  onCreateAlbum: (title: string, description: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onRemoveTrackFromAlbum: (albumId: string, trackId: string) => void;
  onPlayTrack: (track: Track) => void;
  onPlayAlbum: (album: UserAlbum) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  onTogglePlay: () => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({
  albums,
  onCreateAlbum,
  onDeleteAlbum,
  onRemoveTrackFromAlbum,
  onPlayTrack,
  onPlayAlbum,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  onTogglePlay,
}) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);
  const cleanAlbumTracks = useMemo(() => {
    return selectedAlbum ? deduplicateTracks(selectedAlbum.tracks || []) : [];
  }, [selectedAlbum]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateAlbum(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setIsCreateModalOpen(false);
  };

  const formatTotalTime = (tracks: Track[]) => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
    const mins = Math.floor(totalSecs / 60);
    return `${mins} phút`;
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto select-none space-y-6">
      {/* ─── MODAL TẠO ALBUM MỚI ────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#ff2a55] flex items-center justify-center text-white shadow-[0_0_12px_rgba(255,42,85,0.4)]">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Tạo Album Mới</h3>
                <p className="text-[11px] text-[#777] font-mono">Tự lập danh sách phát theo sở thích cá nhân</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-1.5 font-mono">
                  Tên Album <span className="text-[#ff2a55]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Nhạc Tập Trung Làm Việc, V-Pop Chill..."
                  className="w-full px-3.5 py-2.5 bg-[#121218] border border-[#22222e] focus:border-[#ff2a55] text-white rounded-xl text-xs outline-none transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#888] mb-1.5 font-mono">
                  Mô tả (Tùy chọn)
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mô tả cảm xúc hoặc thể loại của album này..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#121218] border border-[#22222e] focus:border-[#ff2a55] text-white rounded-xl text-xs outline-none transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#14141c] hover:bg-[#1e1e28] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-[#ff2a55] hover:bg-white hover:text-black text-xs font-bold text-white transition-all shadow-[0_0_12px_rgba(255,42,85,0.35)] cursor-pointer disabled:opacity-50"
                >
                  Tạo Album
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CHI TIẾT ALBUM ĐANG CHỌN ────────────────────────────────────── */}
      {selectedAlbum ? (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedAlbumId(null)}
            className="flex items-center gap-2 text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại tất cả Album</span>
          </button>

          {/* Album Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-black border border-[#1c1c24] flex flex-col sm:flex-row items-center gap-6 shadow-xl">
            <div className="w-36 h-36 rounded-2xl overflow-hidden bg-[#14141c] border border-[#262632] flex-shrink-0 flex items-center justify-center relative shadow-lg">
              {selectedAlbum.tracks.length > 0 && selectedAlbum.tracks[0].cover_art ? (
                <img
                  src={selectedAlbum.tracks[0].cover_art}
                  alt={selectedAlbum.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc className="w-16 h-16 text-[#ff2a55]" />
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#ff2a55] font-bold px-2.5 py-0.5 rounded bg-[#ff2a55]/15 border border-[#ff2a55]/30">
                Album Người Dùng
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight">{selectedAlbum.title}</h1>
              {selectedAlbum.description && (
                <p className="text-xs text-[#8e8e9f] max-w-xl">{selectedAlbum.description}</p>
              )}
              <div className="text-xs text-[#666] font-mono flex items-center justify-center sm:justify-start gap-3 pt-1">
                <span>{cleanAlbumTracks.length} bài hát</span>
                <span>•</span>
                <span>{formatTotalTime(cleanAlbumTracks)}</span>
                <span>•</span>
                <span>Tạo lúc {new Date(selectedAlbum.created_at).toLocaleDateString()}</span>
              </div>

              <div className="pt-3 flex items-center justify-center sm:justify-start gap-3">
                <button
                  onClick={() => onPlayAlbum({ ...selectedAlbum, tracks: cleanAlbumTracks })}
                  disabled={cleanAlbumTracks.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#ff2a55] hover:text-white text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-40"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Phát tất cả</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Bạn có chắc chắn muốn xóa album "${selectedAlbum.title}"?`)) {
                      onDeleteAlbum(selectedAlbum.id);
                      setSelectedAlbumId(null);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[#14141c] hover:bg-red-500/20 text-[#888] hover:text-red-400 border border-[#22222e] transition-colors cursor-pointer"
                  title="Xóa Album này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-[#ff2a55]" />
              Danh sách bài hát trong Album ({cleanAlbumTracks.length})
            </h2>

            {cleanAlbumTracks.length === 0 ? (
              <div className="text-center py-12 bg-[#08080a] border border-[#161620] rounded-2xl p-6">
                <Disc className="w-10 h-10 text-[#444] mx-auto mb-2" />
                <p className="text-xs font-bold text-white">Album chưa có bài hát nào</p>
                <p className="text-[11px] text-[#666] mt-1 max-w-sm mx-auto">
                  Bạn có thể bấm vào biểu tượng dấu cộng <span className="text-[#ff2a55] font-bold">+</span> trên bất kỳ bài hát nào ở tab Thịnh hành, Tìm kiếm để thêm vào album này!
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {cleanAlbumTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    className="p-2.5 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] flex items-center justify-between gap-3 group transition-colors"
                  >
                    <div
                      onClick={() => onPlayTrack(track)}
                      className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer"
                    >
                      <span className="w-5 text-center text-xs font-mono text-[#555] group-hover:text-white">
                        {idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                        {track.cover_art ? (
                          <img src={track.cover_art} alt={track.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#555]">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3.5 h-3.5 fill-current text-white" />
                        </div>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-[#ff2a55] transition-colors">
                          {track.title}
                        </p>
                        <p className="text-[11px] text-[#8e8e9f] truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[10px] text-[#666] font-mono uppercase px-2 py-0.5 rounded bg-[#14141c]">
                        {track.source}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTrackFromAlbum(selectedAlbum.id, track.id);
                        }}
                        className="p-1.5 text-[#555] hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Gỡ khỏi Album"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─── DANH SÁCH TẤT CẢ ALBUM ────────────────────────────────────────── */
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#161620]">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#ff2a55]" />
                Album Của Bạn
              </h1>
              <p className="text-xs text-[#777] mt-0.5 font-mono">Tự do phân loại &amp; sáng tạo danh sách bài hát yêu thích</p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#ff2a55] hover:bg-white hover:text-black text-white text-xs font-bold transition-all shadow-[0_0_12px_rgba(255,42,85,0.35)] cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Album mới</span>
            </button>
          </div>

          {albums.length === 0 ? (
            <div className="text-center py-16 bg-[#08080a] border border-[#161620] rounded-2xl p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#14141c] border border-[#222] flex items-center justify-center text-[#ff2a55] mx-auto shadow-sm">
                <FolderPlus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Chưa có album nào</h3>
              <p className="text-xs text-[#777] max-w-sm mx-auto">
                Hãy tạo album đầu tiên để gom các bản nhạc yêu thích vào một danh sách phát riêng!
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#ff2a55] hover:text-white text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo ngay bây giờ</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {albums.map((album) => {
                const coverArt = album.tracks.length > 0 ? album.tracks[0].cover_art : null;

                return (
                  <div
                    key={album.id}
                    onClick={() => setSelectedAlbumId(album.id)}
                    className="p-3 rounded-2xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#ff2a55]/40 transition-all flex flex-col group cursor-pointer shadow-sm"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-[#14141c] border border-[#1e1e28]">
                      {coverArt ? (
                        <img
                          src={coverArt}
                          alt={album.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#444] bg-gradient-to-br from-[#121218] to-[#0a0a0e]">
                          <Disc className="w-10 h-10 text-[#ff2a55]/80" />
                        </div>
                      )}

                      <div className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-white hover:bg-[#ff2a55] text-black hover:text-white flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white truncate group-hover:text-[#ff2a55] transition-colors" title={album.title}>
                      {album.title}
                    </p>
                    <p className="text-[11px] text-[#777] font-mono mt-0.5">
                      {album.tracks.length} bài hát
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
