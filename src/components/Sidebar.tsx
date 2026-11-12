import React from 'react';
import { 
  Compass, Search, Library, FolderPlus, HardDrive, Disc3, Heart, Radio, Disc, Sparkles, User as UserIcon, LogIn, Flame
} from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { ViewType, User } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSelectFolder: () => void;
  localTrackCount: number;
  favoritesCount: number;
  currentUser: User | null;
  onOpenAuth: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  onSelectFolder,
  localTrackCount,
  favoritesCount,
  currentUser,
  onOpenAuth,
}) => {
  const navItem = (
    view: ViewType,
    label: string,
    icon: React.ReactNode,
    badge?: React.ReactNode,
    isYellowAccent?: boolean
  ) => {
    const isActive = currentView === view;
    const activeBorderColor = isYellowAccent ? 'border-[#ffe600]' : 'border-[#00e5ff]';
    const activeTextColor = isYellowAccent ? 'text-[#ffe600]' : 'text-[#00e5ff]';

    return (
      <button
        onClick={() => onViewChange(view)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all text-xs tracking-wide cursor-pointer ${
          isActive
            ? `bg-[#141416] text-white font-semibold border-l-2 ${activeBorderColor}`
            : 'text-[#888888] hover:text-white hover:bg-[#0c0c0e]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={isActive ? activeTextColor : 'text-[#888888]'}>{icon}</span>
          <span>{label}</span>
        </div>
        {badge}
      </button>
    );
  };

  return (
    <aside className="w-56 bg-black flex flex-col h-full border-r border-[#141416] select-none text-xs">
      {/* Brand: Spytify — Minimalist */}
      <div className="p-5 pb-4 flex items-center justify-between border-b border-[#141416]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#ffe600] flex items-center justify-center shadow-sm">
            <Disc className="w-4 h-4 text-black" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">
              Spytify
            </h1>
            <p className="text-[10px] text-[#666]">music</p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="p-3 space-y-0.5">
        {navItem('library', 'Thịnh hành', <Flame className="w-4 h-4 text-[#ffe600]" />, undefined, true)}
        {navItem('search', 'Tìm kiếm', <Search className="w-4 h-4" />, undefined, false)}
        {navItem('ai_mix', 'AI Mix', <Sparkles className="w-4 h-4 text-[#ffe600]" />,
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#ffe600]/10 text-[#ffe600] font-mono">AI</span>,
          true
        )}
        {navItem('profile', 'Tài khoản', <UserIcon className="w-4 h-4" />,
          currentUser ? <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]"></span> : undefined,
          false
        )}
      </div>

      {/* Library Section */}
      <div className="mt-4 px-4 flex items-center justify-between text-[#555] text-[10px] font-medium tracking-wide">
        <span>Thư viện</span>
        <button
          onClick={onSelectFolder}
          title="Chọn thư mục nhạc"
          className="p-1 hover:text-[#ffe600] rounded transition-colors text-[#666] cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-1 px-3 flex-1 overflow-y-auto space-y-0.5">
        {navItem('local', 'Nhạc trên máy', <HardDrive className="w-4 h-4" />,
          <span className="text-[10px] text-[#666] font-mono">{localTrackCount}</span>,
          true
        )}
        {navItem('youtube', 'YouTube', <YoutubeIcon className="w-4 h-4" />,
          <span className="w-1.5 h-1.5 rounded-full bg-red-500/60"></span>,
          false
        )}
        {navItem('soundcloud', 'SoundCloud', <SoundCloudIcon className="w-4 h-4" />,
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60"></span>,
          true
        )}
        {navItem('audius', 'Audius (320k)', <AudiusIcon className="w-4 h-4 text-[#00e5ff]" />,
          <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]/60"></span>,
          false
        )}
        {navItem('favorites', 'Yêu thích', <Heart className="w-4 h-4 text-[#ffe600]" />,
          <span className="text-[10px] text-[#666] font-mono">{favoritesCount}</span>,
          true
        )}
      </div>

      {/* Bottom User Area */}
      <div className="p-3 border-t border-[#141416]">
        {currentUser ? (
          <button
            onClick={() => onViewChange('profile')}
            className="w-full p-2.5 rounded-xl bg-[#0a0a0c] hover:bg-[#141418] border border-[#1a1a20] hover:border-[#ffe600]/40 flex items-center justify-between transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ffe600] to-[#00e5ff] text-black font-black text-xs flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_rgba(255,230,0,0.3)]">
                {currentUser.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{currentUser.display_name}</p>
                <p className="text-[10px] text-[#00e5ff] truncate font-mono">@{currentUser.username}</p>
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full py-2 px-3 rounded-lg bg-[#141416] hover:bg-gradient-to-r hover:from-[#ffe600] hover:to-[#00e5ff] hover:text-black border border-[#222228] text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md group"
          >
            <LogIn className="w-3.5 h-3.5 text-[#ffe600] group-hover:text-black transition-colors" />
            <span className="group-hover:font-black transition-all">Đăng nhập / Đăng ký</span>
          </button>
        )}
      </div>
    </aside>
  );
};
