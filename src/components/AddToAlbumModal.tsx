import React, { useState } from 'react';
import { X, Plus, FolderPlus, Check, Disc, Music } from 'lucide-react';
import { Track, UserAlbum } from '../types';

interface AddToAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackToAdd: Track | null;
  albums: UserAlbum[];
  onAddTrackToAlbum: (albumId: string, track: Track) => void;
  onCreateAlbum: (title: string, description: string) => UserAlbum;
}

export const AddToAlbumModal: React.FC<AddToAlbumModalProps> = ({
  isOpen,
  onClose,
  trackToAdd,
  albums,
  onAddTrackToAlbum,
  onCreateAlbum,
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [addedAlbumId, setAddedAlbumId] = useState<string | null>(null);

  if (!isOpen || !trackToAdd) return null;

  const handleSelectAlbum = (albumId: string) => {
    onAddTrackToAlbum(albumId, trackToAdd);
    setAddedAlbumId(albumId);
    setTimeout(() => {
      setAddedAlbumId(null);
      onClose();
    }, 600);
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumTitle.trim()) return;
    const created = onCreateAlbum(newAlbumTitle.trim(), '');
    onAddTrackToAlbum(created.id, trackToAdd);
    setNewAlbumTitle('');
    setIsCreatingNew(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff2a55] flex items-center justify-center text-white shadow-sm">
            <FolderPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Thêm vào Album</h3>
            <p className="text-[11px] text-[#777] truncate max-w-[220px]" title={trackToAdd.title}>
              {trackToAdd.title}
            </p>
          </div>
        </div>

        {isCreatingNew ? (
          <form onSubmit={handleCreateAndAdd} className="space-y-3 pt-2">
            <input
              type="text"
              required
              value={newAlbumTitle}
              onChange={(e) => setNewAlbumTitle(e.target.value)}
              placeholder="Nhập tên album mới..."
              className="w-full px-3 py-2 bg-[#121218] border border-[#22222e] focus:border-[#ff2a55] text-white rounded-xl text-xs outline-none transition-colors"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-3 py-1.5 rounded-lg bg-[#14141c] hover:bg-[#1e1e28] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!newAlbumTitle.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-[#ff2a55] hover:bg-white hover:text-black text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
              >
                Tạo &amp; Thêm
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full p-2.5 rounded-xl border border-dashed border-[#262636] hover:border-[#ff2a55] text-xs font-bold text-white hover:text-[#ff2a55] flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo album mới</span>
            </button>

            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {albums.length === 0 ? (
                <p className="text-[11px] text-[#666] text-center py-4">Bạn chưa có album nào. Hãy tạo mới ở trên!</p>
              ) : (
                albums.map((a) => {
                  const alreadyIn = a.tracks.some(t => t.id === trackToAdd.id);
                  const isJustAdded = addedAlbumId === a.id;

                  return (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAlbum(a.id)}
                      className="w-full p-2 rounded-xl bg-[#0e0e14] hover:bg-[#161620] border border-[#1a1a24] flex items-center justify-between text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-[#14141c] flex items-center justify-center text-[#ff2a55] flex-shrink-0">
                          <Disc className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                          <p className="text-[10px] text-[#777] font-mono">{a.tracks.length} bài hát</p>
                        </div>
                      </div>

                      {isJustAdded || alreadyIn ? (
                        <span className="text-[10px] text-[#ff2a55] font-mono flex items-center gap-1 font-bold">
                          <Check className="w-3.5 h-3.5" />
                          <span>{isJustAdded ? 'Đã thêm!' : 'Đã có'}</span>
                        </span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-white font-mono transition-opacity">
                          + Chọn
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
