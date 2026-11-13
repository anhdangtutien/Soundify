import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PlaybackStatus, Track } from '../types';

interface RustUiSnapshot {
  active_tab: string;
  search_query: string;
  tracks: Track[];
  playback: PlaybackStatus;
  recommend_mode: string;
  ram_saved_mode: boolean;
  rendered_blitz_html: string;
}

interface RustFastUiViewProps {
  userId?: string;
  localTracks: Track[];
  onExitRustUi: () => void;
  onPlayTrackFromRust: (track: Track) => void;
}

export const RustFastUiView: React.FC<RustFastUiViewProps> = ({
  userId,
  localTracks,
  onExitRustUi,
  onPlayTrackFromRust,
}) => {
  const [snapshot, setSnapshot] = useState<RustUiSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const refreshSnapshot = async (syncInitial = false) => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_get_snapshot', {
        userId: syncInitial ? (userId || 'guest') : null,
        localTracks: syncInitial ? localTracks : null,
      });
      setSnapshot(snap);
    } catch (e) {
      console.error('Rust UI snapshot error:', e);
    }
  };

  useEffect(() => {
    invoke('trim_memory').catch(() => {});
    refreshSnapshot(true);
    const timer = setInterval(() => {
      refreshSnapshot(false);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const handleSwitchTab = async (tab: string) => {
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_switch_tab', { tab });
      setSnapshot(snap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFilterChange = async (val: string) => {
    setQuery(val);
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_filter', { query: val });
      setSnapshot(snap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOnlineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const snap = await invoke<RustUiSnapshot>('rust_ui_search_online', { query: query.trim() });
      setSnapshot(snap);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRowClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.blitz-row') as HTMLElement | null;
    if (!target) return;
    const idxStr = target.getAttribute('data-idx');
    if (idxStr === null) return;
    const index = parseInt(idxStr, 10);
    if (isNaN(index)) return;

    try {
      const playedTrack = await invoke<Track | null>('rust_ui_play_index', { index });
      if (playedTrack) {
        onPlayTrackFromRust(playedTrack);
        refreshSnapshot(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#0a0a0e',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* Top Blitz Rust Native Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#111118',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              background: '#ff2a55',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
            }}
          >
            ⚡ RUST NATIVE UI (BLITZ / STYLO LAYOUT)
          </span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            Zero Virtual-DOM • Direct Rust Rodio Streamer (YT Music + Audius + Local)
          </span>
        </div>

        <button
          onClick={onExitRustUi}
          style={{
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🎨 Quay về Full TypeScript UI
        </button>
      </div>

      {/* Fast Tabs & Direct Rust Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#0e0e14',
        }}
      >
        {[
          { id: 'favorites', label: '❤️ Yêu thích (SQLite)' },
          { id: 'local', label: '💿 Nhạc trên máy (Local)' },
          { id: 'search', label: '🌐 Tìm kiếm Online (YT Music + Audius)' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => handleSwitchTab(t.id)}
            style={{
              background: snapshot?.active_tab === t.id ? '#ff2a55' : '#181822',
              color: snapshot?.active_tab === t.id ? '#fff' : '#9ca3af',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '5px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}

        <form onSubmit={handleOnlineSearch} style={{ display: 'flex', flex: 1, gap: '6px', marginLeft: '8px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Lọc nhanh (0ms) hoặc nhấn Enter để tìm trên YouTube Music + Audius..."
            style={{
              flex: 1,
              background: '#161620',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '5px',
              padding: '6px 12px',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={isSearching}
            style={{
              background: '#10b981',
              color: '#052e16',
              border: 'none',
              borderRadius: '5px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isSearching ? 'Đang tìm...' : 'Tìm Online'}
          </button>
        </form>
      </div>

      {/* Blitz Pre-Rendered Track Table from Rust String Buffer */}
      <div
        onClick={handleRowClick}
        style={{
          flex: 1,
          overflowY: 'auto',
          contentVisibility: 'auto',
        }}
        dangerouslySetInnerHTML={{
          __html:
            snapshot?.rendered_blitz_html ||
            '<div style="padding:24px;color:#6b7280;font-size:13px;">Chưa có bài hát trong danh sách này.</div>',
        }}
      />
    </div>
  );
};
