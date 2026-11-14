import React, { useState } from 'react';
import { X, Plus, FolderPlus, Check, Disc, Music } from 'lucide-react';
import { Track, UserAlbum } from '../types';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { getContrastTextColor, sanitizeTrackTitle } from '../utils/trackUtils';

interface AddToAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackToAdd: Track | null;
  albums: UserAlbum[];
  onAddTrackToAlbum: (albumId: string, track: Track) => void;
  onCreateAlbum: (title: string, description: string) => UserAlbum;
  language?: LanguageCode;
  accentColor?: string;
}

const normalizeStr = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const AddToAlbumModal: React.FC<AddToAlbumModalProps> = ({
  isOpen,
  onClose,
  trackToAdd,
  albums,
  onAddTrackToAlbum,
  onCreateAlbum,
  language = 'vi',
  accentColor = '#00E5FF',
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [addedAlbumId, setAddedAlbumId] = useState<string | null>(null);

  if (!isOpen || !trackToAdd) return null;

  const isTrackInAlbum = (album: UserAlbum, track: Track) => {
    return (album.tracks || []).some(t => 
      t.id === track.id || 
      normalizeStr(t.title) === normalizeStr(track.title)
    );
  };

  const handleSelectAlbum = (albumId: string) => {
    const targetAlbum = albums.find(a => a.id === albumId);
    if (targetAlbum && isTrackInAlbum(targetAlbum, trackToAdd)) {
      setAddedAlbumId(albumId);
      setTimeout(() => {
        setAddedAlbumId(null);
        onClose();
      }, 500);
      return;
    }

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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-[#0a0a0d] border border-[#1e1e28] rounded-2xl p-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#777] hover:text-white p-1 rounded-lg cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ 
              backgroundColor: accentColor,
              color: getContrastTextColor(accentColor),
            }}
          >
            <FolderPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">{getTranslation(language, 'player.addToAlbum')}</h3>
            <p className="text-[11px] text-[#777] truncate max-w-[220px]" title={trackToAdd.title}>
              {sanitizeTrackTitle(trackToAdd.title)}
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
              placeholder={getTranslation(language, 'album.namePlaceholder') || "Album name..."}
              className="w-full px-3 py-2 bg-[#121218] border border-[#22222e] text-white rounded-xl text-xs outline-none transition-colors"
              style={{ borderColor: `${accentColor}70` }}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-3 py-1.5 rounded-lg bg-[#14141c] hover:bg-[#1e1e28] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
              >
                {getTranslation(language, 'popup.close')}
              </button>
              <button
                type="submit"
                disabled={!newAlbumTitle.trim()}
                style={{ 
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 12px ${accentColor}40`,
                }}
                className="px-3.5 py-1.5 rounded-lg hover:opacity-90 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {getTranslation(language, 'album.createAndAdd') || getTranslation(language, 'album.createTitle') || 'Create Album'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 pt-2">
            <button
              onClick={() => setIsCreatingNew(true)}
              style={{ borderColor: `${accentColor}40` }}
              className="w-full p-2.5 rounded-xl border border-dashed text-xs font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-[#14141c]"
            >
              <Plus className="w-4 h-4" style={{ color: accentColor }} />
              <span style={{ color: accentColor }}>{getTranslation(language, 'album.createTitle') || 'Create Album'}</span>
            </button>

            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {albums.length === 0 ? (
                <p className="text-[11px] text-[#666] text-center py-4">{getTranslation(language, 'album.noAlbums') || "No albums yet"}</p>
              ) : (
                albums.map((a) => {
                  const alreadyIn = isTrackInAlbum(a, trackToAdd);
                  const isJustAdded = addedAlbumId === a.id;

                  return (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAlbum(a.id)}
                      className="w-full p-2 rounded-xl bg-[#0e0e14] hover:bg-[#161620] border border-[#1a1a24] flex items-center justify-between text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div 
                          className="w-8 h-8 rounded-lg bg-[#14141c] flex items-center justify-center flex-shrink-0"
                          style={{ color: accentColor }}
                        >
                          <Disc className="w-4 h-4" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                          <p className="text-[10px] text-[#777] font-mono">{getTranslation(language, 'album.trackCount', { count: a.tracks.length })}</p>
                        </div>
                      </div>

                      {isJustAdded || alreadyIn ? (
                        <span className="text-[10px] font-mono flex items-center gap-1 font-bold" style={{ color: accentColor }}>
                          <Check className="w-3.5 h-3.5" />
                          <span>{isJustAdded ? getTranslation(language, 'toast.addedToAlbum') : getTranslation(language, 'toast.albumTrackExists')}</span>
                        </span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 text-[10px] text-white font-mono transition-opacity">
                          + {getTranslation(language, 'player.play')}
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
