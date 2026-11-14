import React from 'react';
import { 
  Search, FolderPlus, HardDrive, Heart, Sparkles, User as UserIcon, LogIn, Flame, Layers, Radio
} from 'lucide-react';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { ViewType, User } from '../types';
import spytifyLogo from '../assets/spytify-logo.png';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { CURRENT_VERSION } from '../services/updater';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSelectFolder: () => void;
  localTrackCount: number;
  favoritesCount: number;
  albumCount: number;
  currentUser: User | null;
  onOpenAuth: () => void;
  accentColor?: string;
  themeMode?: 'dark' | 'light';
  language?: LanguageCode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  onSelectFolder,
  localTrackCount,
  favoritesCount,
  albumCount,
  currentUser,
  onOpenAuth,
  accentColor = '#ff2a55',
  themeMode = 'dark',
  language = 'vi',
}) => {
  const navItem = (
    view: ViewType,
    label: string,
    icon: React.ReactNode,
    badge?: React.ReactNode,
  ) => {
    const isActive = currentView === view;

    return (
      <button
        onClick={() => onViewChange(view)}
        style={{
          borderLeftColor: isActive ? accentColor : 'transparent',
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg transition-all text-xs tracking-wide cursor-pointer border-l-2 ${
          isActive
            ? 'bg-[#14141a] text-white font-semibold'
            : 'text-[#888899] hover:text-white hover:bg-[#0e0e12]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: isActive ? accentColor : '#777788' }}>{icon}</span>
          <span>{label}</span>
        </div>
        {badge}
      </button>
    );
  };

  return (
    <aside className="w-56 bg-black flex flex-col h-full border-r border-[#141418] select-none text-xs">
      {/* Brand: Spytify with User Custom Logo */}
      <div className="p-4 pb-3.5 flex items-center justify-between border-b border-[#141418]">
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-xl overflow-hidden bg-[#101014] border border-[#262630] flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: `0 0 12px ${accentColor}35` }}
          >
            <img src={spytifyLogo} alt="Spytify" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Spytify</span>
              <span 
                className="w-1.5 h-1.5 rounded-full animate-ping"
                style={{ backgroundColor: accentColor }}
              ></span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p 
                className="text-[10px] font-mono tracking-wider font-bold"
                style={{ color: accentColor }}
              >
                SPY MUSIC
              </p>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#13131c] text-[#888899] border border-[#22222e]">
                v{CURRENT_VERSION}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="p-3 space-y-0.5">
        {navItem('library', getTranslation(language, 'nav.trending'), <Flame className="w-4 h-4" />)}
        {navItem('search', getTranslation(language, 'nav.search'), <Search className="w-4 h-4" />)}
        {navItem('community', getTranslation(language, 'nav.community'), <Radio className="w-4 h-4" />,
          <span 
            className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border flex items-center gap-1"
            style={{ 
              color: '#00E5FF', 
              backgroundColor: '#00E5FF15', 
              borderColor: '#00E5FF30' 
            }}
          >
            <span className="w-1 h-1 rounded-full bg-[#00E5FF] animate-ping" />
            LIVE
          </span>
        )}
        {navItem('albums', getTranslation(language, 'nav.myAlbums'), <Layers className="w-4 h-4" />,
          <span className="text-[10px] text-[#666] font-mono">{albumCount}</span>
        )}
        {navItem('ai_mix', getTranslation(language, 'nav.aiMix'), <Sparkles className="w-4 h-4" />,
          <span 
            className="text-[9px] px-1.5 py-0.2 rounded font-mono border"
            style={{ 
              color: accentColor, 
              backgroundColor: `${accentColor}15`, 
              borderColor: `${accentColor}30` 
            }}
          >
            AI
          </span>
        )}
        {navItem('profile', getTranslation(language, 'nav.account'), <UserIcon className="w-4 h-4" />,
          currentUser ? (
            <span 
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            ></span>
          ) : undefined
        )}
      </div>

      {/* Library Section */}
      <div className="mt-4 px-4 flex items-center justify-between text-[#666677] text-[10px] font-semibold tracking-wider uppercase font-mono">
        <span>{getTranslation(language, 'nav.library')}</span>
        <button
          onClick={onSelectFolder}
          title={getTranslation(language, 'header.selectFolder')}
          className="p-1 hover:text-white rounded transition-colors text-[#777788] cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-1 px-3 flex-1 overflow-y-auto space-y-0.5">
        {navItem('local', getTranslation(language, 'nav.localMusic'), <HardDrive className="w-4 h-4" />,
          <span className="text-[10px] text-[#666] font-mono">{localTrackCount}</span>
        )}
        {navItem('youtube', 'YouTube', <YoutubeIcon className="w-4 h-4" />,
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>
        )}
        {navItem('soundcloud', 'SoundCloud', <SoundCloudIcon className="w-4 h-4" />,
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
        )}
        {navItem('audius', 'Audius (320k)', <AudiusIcon className="w-4 h-4 text-white" />,
          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
        )}
        {navItem('favorites', getTranslation(language, 'nav.favorites'), <Heart className="w-4 h-4" style={{ color: accentColor }} />,
          <span className="text-[10px] text-[#666] font-mono">{favoritesCount}</span>
        )}
      </div>

      {/* Bottom User Area */}
      <div className="p-3 border-t border-[#141418]">
        {currentUser ? (
          <button
            onClick={() => onViewChange('profile')}
            className="w-full p-2.5 rounded-xl bg-[#0c0c10] hover:bg-[#141418] border border-[#1e1e24] hover:border-white/30 flex items-center justify-between transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div 
                className="w-8 h-8 rounded-lg overflow-hidden border border-white/20 text-black font-black text-xs flex items-center justify-center flex-shrink-0"
                style={{ 
                  background: currentUser.avatar ? 'transparent' : `linear-gradient(135deg, ${accentColor} 0%, #ffffff 100%)`,
                  boxShadow: `0 0 8px ${accentColor}30` 
                }}
              >
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.display_name} className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.display_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{currentUser.display_name}</p>
                <p 
                  className="text-[10px] truncate font-mono" 
                  style={{ 
                    color: (themeMode === 'light' && (accentColor === '#FFFFFF' || accentColor === '#FFE600' || accentColor === '#00E5FF' || accentColor === '#00FF66')) 
                      ? '#64748b' 
                      : accentColor 
                  }}
                >
                  @{currentUser.username}
                </p>
              </div>
            </div>
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full py-2 px-3 rounded-lg bg-[#101014] hover:bg-[#181820] border border-[#22222a] hover:border-white/40 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
          >
            <LogIn className="w-3.5 h-3.5 transition-colors" style={{ color: accentColor }} />
            <span className="transition-all">{getTranslation(language, 'profile.loginBtn')}</span>
          </button>
        )}
      </div>

      {/* App Version Tag Footer */}
      <div className="px-3.5 py-2 flex items-center justify-between text-[10px] font-mono text-[#555] border-t border-[#141418]">
        <span className="text-[#666]">Spytify Client</span>
        <button
          onClick={() => onViewChange('profile')}
          title="Bấm để kiểm tra cập nhật & xem chi tiết phiên bản"
          className="px-1.5 py-0.5 rounded bg-[#101014] hover:bg-[#181822] border border-[#202028] text-[#888] hover:text-white transition-colors cursor-pointer font-bold text-[9px]"
        >
          v{CURRENT_VERSION}
        </button>
      </div>
    </aside>
  );
};
