import React, { useState, useMemo } from 'react';
import { 
  Plus, Disc, Play, Trash2, Music, ArrowLeft, Clock3, FolderPlus, 
  Sparkles, Layers, Check, X, Pencil, Image as ImageIcon
} from 'lucide-react';
import { Track, UserAlbum } from '../types';
import { TrackTable } from './TrackTable';
import { deduplicateTracks, getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface AlbumsViewProps {
  albums: UserAlbum[];
  onCreateAlbum: (title: string, description: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onUpdateAlbum?: (albumId: string, updates: Partial<UserAlbum>) => void;
  onRemoveTrackFromAlbum: (albumId: string, trackId: string) => void;
  onPlayTrack: (track: Track, albumTracks?: Track[]) => void;
  onPlayAlbum: (album: UserAlbum) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  onTogglePlay: () => void;
  accentColor?: string;
  language?: LanguageCode;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({
  albums,
  onCreateAlbum,
  onDeleteAlbum,
  onUpdateAlbum,
  onRemoveTrackFromAlbum,
  onPlayTrack,
  onPlayAlbum,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  onTogglePlay,
  accentColor = '#ff2a55',
  language = 'vi',
}) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCoverArt, setEditCoverArt] = useState('');

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

  const handleOpenEditModal = (album: UserAlbum) => {
    setEditTitle(album.title);
    setEditDesc(album.description || '');
    setEditCoverArt(album.cover_art || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlbum || !editTitle.trim()) return;
    onUpdateAlbum?.(selectedAlbum.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      cover_art: editCoverArt.trim() || null,
    });
    setIsEditModalOpen(false);
  };

  const formatTotalTime = (tracks: Track[]) => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration_secs || 0), 0);
    const mins = Math.floor(totalSecs / 60);
    return getTranslation(language, 'album.minutes', { mins });
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto select-none space-y-6">
      {/* ─── MODAL TẠO ALBUM MỚI ────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                style={{ 
                  backgroundColor: accentColor, 
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 12px ${accentColor}40`
                }}
              >
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {getTranslation(language, 'album.modalTitle')}
                </h3>
                <p className="text-[11px] text-[#777] font-mono">
                  {getTranslation(language, 'album.modalSubtitle')}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.nameLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={getTranslation(language, 'album.namePlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.descLabel')}
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={getTranslation(language, 'album.descPlaceholder')}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#888] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {getTranslation(language, 'album.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                    boxShadow: `0 0 14px ${accentColor}40`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 hover:opacity-90 shadow-md"
                >
                  {getTranslation(language, 'album.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CHỈNH SỬA ALBUM (TITLE, DESCRIPTION, COVER ART) ──────── */}
      {isEditModalOpen && selectedAlbum && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                style={{ 
                  backgroundColor: accentColor, 
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 12px ${accentColor}40`
                }}
              >
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {getTranslation(language, 'album.editModalTitle')}
                </h3>
                <p className="text-[11px] text-[#777] font-mono">
                  {getTranslation(language, 'album.editModalSubtitle')}
                </p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Cover Art Preview & Input */}
              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{getTranslation(language, 'album.coverArtLabel')}</span>
                </label>

                <div className="flex items-center gap-3.5 mb-2.5">
                  <div className="w-16 h-16 rounded-xl bg-[#14141c] border border-[#222] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {editCoverArt.trim() ? (
                      <img 
                        src={editCoverArt} 
                        alt="Preview" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500';
                        }}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Disc className="w-8 h-8 text-[#555]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="url"
                      value={editCoverArt}
                      onChange={(e) => setEditCoverArt(e.target.value)}
                      placeholder={getTranslation(language, 'album.coverArtPlaceholder')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors"
                    />
                  </div>
                </div>

                {/* Quick Pick from tracks in this album */}
                {cleanAlbumTracks.some(t => t.cover_art) && (
                  <div>
                    <span className="text-[10px] text-[#777] font-mono block mb-1.5">
                      {getTranslation(language, 'album.chooseFromTracks')}
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                      {cleanAlbumTracks
                        .filter(t => t.cover_art)
                        .slice(0, 8)
                        .map((t, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditCoverArt(t.cover_art || '')}
                            className={`w-10 h-10 rounded-lg overflow-hidden border flex-shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                              editCoverArt === t.cover_art ? 'border-2' : 'border-white/10 hover:border-white/40'
                            }`}
                            style={editCoverArt === t.cover_art ? { borderColor: accentColor } : undefined}
                          >
                            <img src={t.cover_art || ''} alt={t.title} className="w-full h-full object-cover" />
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.nameLabel')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#aaa] mb-1.5">
                  {getTranslation(language, 'album.descLabel')}
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141c] border border-[#22222e] text-white text-xs focus:outline-none focus:border-white/40 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#888] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {getTranslation(language, 'album.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim()}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                    boxShadow: `0 0 14px ${accentColor}40`,
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 hover:opacity-90 shadow-md"
                >
                  {getTranslation(language, 'album.saveChanges')}
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
            <span>{getTranslation(language, 'album.backToAll')}</span>
          </button>

          {/* Album Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-black border border-[#1c1c24] flex flex-col sm:flex-row items-center gap-6 shadow-xl">
            <div className="w-36 h-36 rounded-2xl overflow-hidden bg-[#14141c] border border-[#262632] flex-shrink-0 flex items-center justify-center relative shadow-lg">
              {selectedAlbum.cover_art ? (
                <img
                  src={optimizeThumbnailUrl(selectedAlbum.cover_art, selectedAlbum.id)}
                  alt={selectedAlbum.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, selectedAlbum.id)}
                  className="w-full h-full object-cover"
                />
              ) : selectedAlbum.tracks.length > 0 && selectedAlbum.tracks[0].cover_art ? (
                <img
                  src={optimizeThumbnailUrl(selectedAlbum.tracks[0].cover_art, selectedAlbum.tracks[0].path_or_url || selectedAlbum.tracks[0].id)}
                  alt={selectedAlbum.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, selectedAlbum.tracks[0].path_or_url || selectedAlbum.tracks[0].id)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc className="w-16 h-16" style={{ color: accentColor }} />
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <span 
                className="text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border"
                style={{
                  color: accentColor,
                  backgroundColor: `${accentColor}15`,
                  borderColor: `${accentColor}30`,
                }}
              >
                {getTranslation(language, 'album.userBadge')}
              </span>
              <h1 className="text-2xl font-black text-white tracking-tight">{selectedAlbum.title}</h1>
              {selectedAlbum.description && (
                <p className="text-xs text-[#8e8e9f] max-w-xl">{selectedAlbum.description}</p>
              )}
              <div className="text-xs text-[#666] font-mono flex items-center justify-center sm:justify-start gap-3 pt-1">
                <span>{getTranslation(language, 'album.trackCount', { count: cleanAlbumTracks.length })}</span>
                <span>•</span>
                <span>{formatTotalTime(cleanAlbumTracks)}</span>
                <span>•</span>
                <span>{getTranslation(language, 'album.createdAt')} {new Date(selectedAlbum.created_at).toLocaleDateString()}</span>
              </div>

              <div className="pt-3 flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                <button
                  onClick={() => onPlayAlbum({ ...selectedAlbum, tracks: cleanAlbumTracks })}
                  disabled={cleanAlbumTracks.length === 0}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                    boxShadow: `0 0 16px ${accentColor}40`,
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-40 hover:opacity-90"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>{getTranslation(language, 'album.playAll')}</span>
                </button>
                <button
                  onClick={() => handleOpenEditModal(selectedAlbum)}
                  className="px-4 py-2.5 rounded-xl bg-[#14141c] hover:bg-[#1f1f2c] text-white border border-[#22222e] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                  title={getTranslation(language, 'album.editAlbum')}
                >
                  <Pencil className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{getTranslation(language, 'album.editAlbum')}</span>
                </button>
                <button
                  onClick={() => {
                    if (confirm(getTranslation(language, 'album.deleteConfirm', { title: selectedAlbum.title }))) {
                      onDeleteAlbum(selectedAlbum.id);
                      setSelectedAlbumId(null);
                    }
                  }}
                  className="p-2.5 rounded-xl bg-[#14141c] hover:bg-red-500/20 text-[#888] hover:text-red-400 border border-[#22222e] transition-colors cursor-pointer"
                  title={getTranslation(language, 'album.deleteTitle')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
              <Music className="w-3.5 h-3.5" style={{ color: accentColor }} />
              {getTranslation(language, 'album.trackList', { count: cleanAlbumTracks.length })}
            </h2>

            {cleanAlbumTracks.length === 0 ? (
              <div className="text-center py-12 bg-[#08080a] border border-[#161620] rounded-2xl p-6">
                <Disc className="w-10 h-10 text-[#444] mx-auto mb-2" />
                <p className="text-xs font-bold text-white">
                  {getTranslation(language, 'album.noTracks')}
                </p>
                <p className="text-[11px] text-[#666] mt-1 max-w-sm mx-auto">
                  {getTranslation(language, 'album.noTracksHint')}
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
                      onClick={() => onPlayTrack(track, cleanAlbumTracks)}
                      className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer"
                    >
                      <span className="w-5 text-center text-xs font-mono text-[#555] group-hover:text-white">
                        {idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
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
                          <Play className="w-3.5 h-3.5 fill-current text-white" />
                        </div>
                      </div>
                      <div className="overflow-hidden">
                        <p 
                          className="text-xs font-semibold text-white truncate transition-colors"
                          style={{ color: currentTrack?.id === track.id ? accentColor : undefined }}
                        >
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
                        title={getTranslation(language, 'album.removeTrack')}
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
                <Layers className="w-5 h-5" style={{ color: accentColor }} />
                {getTranslation(language, 'album.title')}
              </h1>
              <p className="text-xs text-[#777] mt-0.5 font-mono">
                {getTranslation(language, 'album.subtitle')}
              </p>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
                boxShadow: `0 0 12px ${accentColor}40`,
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>{getTranslation(language, 'album.createNew')}</span>
            </button>
          </div>

          {albums.length === 0 ? (
            <div className="text-center py-16 bg-[#08080a] border border-[#161620] rounded-2xl p-8 space-y-3">
              <div 
                className="w-14 h-14 rounded-2xl bg-[#14141c] border border-[#222] flex items-center justify-center mx-auto shadow-sm"
                style={{ color: accentColor }}
              >
                <FolderPlus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {getTranslation(language, 'album.empty')}
              </h3>
              <p className="text-xs text-[#777] max-w-sm mx-auto">
                {getTranslation(language, 'album.emptyDesc')}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  style={{
                    backgroundColor: accentColor,
                    color: getContrastTextColor(accentColor),
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-2 hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>{getTranslation(language, 'album.createNow')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {albums.map((album) => {
                const coverArt = album.cover_art || (album.tracks.length > 0 ? album.tracks[0].cover_art : null);

                return (
                  <div
                    key={album.id}
                    onClick={() => setSelectedAlbumId(album.id)}
                    className="p-3 rounded-2xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#222230] transition-all flex flex-col group cursor-pointer shadow-sm"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-[#14141c] border border-[#1e1e28]">
                      {coverArt ? (
                        <img
                          src={optimizeThumbnailUrl(coverArt, album.id)}
                          alt={album.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, album.id)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#444] bg-gradient-to-br from-[#121218] to-[#0a0a0e]">
                          <Disc className="w-10 h-10" style={{ color: accentColor }} />
                        </div>
                      )}

                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (album.tracks.length > 0) {
                            onPlayAlbum({ ...album, tracks: deduplicateTracks(album.tracks) });
                          } else {
                            setSelectedAlbumId(album.id);
                          }
                        }}
                        className="absolute right-2 bottom-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                        style={{
                          backgroundColor: accentColor,
                          color: getContrastTextColor(accentColor),
                        }}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white truncate transition-colors">
                      {album.title}
                    </p>
                    <p className="text-[11px] text-[#777] font-mono mt-0.5">
                      {getTranslation(language, 'album.trackCount', { count: album.tracks.length })}
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
