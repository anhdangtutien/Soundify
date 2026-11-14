import React, { useState } from 'react';
import { 
  Search, FolderPlus, HardDrive, Heart, Sparkles, User as UserIcon, LogIn, Flame, Layers, Radio,
  PanelLeftClose, PanelLeftOpen
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(prev => {
        const next = !prev;
        try {
          localStorage.setItem('spytify_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const navItem = (
    view: ViewType,
    label: string,
    icon: React.ReactNode,
    badge?: React.ReactNode,
    dotIndicator?: string,
  ) => {
    const isActive = currentView === view;

    if (isCollapsed) {
      return (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          title={label}
          style={{
            borderLeftColor: isActive ? accentColor : 'transparent',
          }}
          className={`w-full flex items-center justify-center py-2.5 rounded-lg transition-all cursor-pointer border-l-2 relative group ${
            isActive
              ? 'bg-[#14141a] text-white shadow-sm'
              : 'text-[#888899] hover:text-white hover:bg-[#0e0e12]'
          }`}
        >
          <span style={{ color: isActive ? accentColor : '#777788' }}>{icon}</span>
          {dotIndicator && (
            <span
              className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: dotIndicator }}
            />
          )}
          {view === 'community' && (
            <span className="absolute top-2 right-2.5 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: accentColor }} />
            </span>
          )}
          {view === 'ai_mix' && (
            <span 
              className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </button>
      );
    }

    return (
      <button
        key={view}
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
    <aside 
      className={`${
        isCollapsed ? 'w-16' : 'w-56'
      } bg-black flex flex-col h-full border-r border-[#141418] select-none text-xs transition-all duration-200 ease-in-out flex-shrink-0 z-20`}
    >
      {/* Brand Header */}
      {isCollapsed ? (
        <div className="p-3 py-3.5 flex flex-col items-center justify-center border-b border-[#141418]">
          <button
            onClick={handleToggle}
            title={getTranslation(language, 'sidebar.expand')}
            className="w-10 h-10 rounded-xl overflow-hidden bg-[#101014] border border-[#262630] hover:border-[#00E5FF]/60 flex items-center justify-center flex-shrink-0 cursor-pointer relative group transition-all"
            style={{ boxShadow: `0 0 10px ${accentColor}25` }}
          >
            <img src={spytifyLogo} alt="Spytify" className="w-full h-full object-cover group-hover:opacity-20 transition-opacity" />
            <PanelLeftOpen className="w-4 h-4 text-white absolute opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      ) : (
        <div className="p-4 pb-3.5 flex items-center justify-between border-b border-[#141418]">
          <div 
            onClick={handleToggle}
            className="flex items-center gap-3 cursor-pointer group/brand"
            title={getTranslation(language, 'sidebar.collapse')}
          >
            <div 
              className="w-9 h-9 rounded-xl overflow-hidden bg-[#101014] border border-[#262630] group-hover/brand:border-[#00E5FF]/60 flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ boxShadow: `0 0 12px ${accentColor}35` }}
            >
              <img src={spytifyLogo} alt="Spytify" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5 group-hover/brand:text-[#00E5FF] transition-colors">
                <span>Spytify</span>
                <span 
                  className="w-1.5 h-1.5 rounded-full animate-ping"
                  style={{ backgroundColor: accentColor }}
                ></span>
              </h1>
              <p 
                className="text-[10px] font-mono tracking-wider font-bold mt-0.5"
                style={{ color: accentColor }}
              >
                SPY MUSIC
              </p>
            </div>
          </div>

          <button
            onClick={handleToggle}
            title={getTranslation(language, 'sidebar.collapse')}
            className="p-1.5 rounded-lg hover:bg-[#161620] text-[#666677] hover:text-white transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Nav */}
      <div className={`space-y-0.5 ${isCollapsed ? 'p-2' : 'p-3'}`}>
        {navItem('library', getTranslation(language, 'nav.trending'), <Flame className="w-4 h-4" />)}
        {navItem('search', getTranslation(language, 'nav.search'), <Search className="w-4 h-4" />)}
        {navItem('community', getTranslation(language, 'nav.community'), <Radio className="w-4 h-4" />,
          <span 
            className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border flex items-center gap-1"
            style={{ 
              color: accentColor, 
              backgroundColor: `${accentColor}18`, 
              borderColor: `${accentColor}35` 
            }}
          >
            <span className="w-1 h-1 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
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
      {isCollapsed ? (
        <div className="my-2 border-t border-[#141418] mx-2" />
      ) : (
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
      )}

      {/* Library Nav Items */}
      <div className={`flex-1 overflow-y-auto space-y-0.5 ${isCollapsed ? 'px-2' : 'mt-1 px-3'}`}>
        {navItem('local', getTranslation(language, 'nav.localMusic'), <HardDrive className="w-4 h-4" />,
          <span className="text-[10px] text-[#666] font-mono">{localTrackCount}</span>
        )}
        {navItem('youtube', 'YouTube', <YoutubeIcon className="w-4 h-4" />,
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }}></span>,
          accentColor
        )}
        {navItem('soundcloud', 'SoundCloud', <SoundCloudIcon className="w-4 h-4" />,
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>,
          '#fb923c'
        )}
        {navItem('audius', 'Audius (320k)', <AudiusIcon className="w-4 h-4 text-white" />,
          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>,
          '#ffffff'
        )}
        {navItem('favorites', getTranslation(language, 'nav.favorites'), <Heart className="w-4 h-4" style={{ color: accentColor }} />,
          <span className="text-[10px] text-[#666] font-mono">{favoritesCount}</span>,
          accentColor
        )}
      </div>

      {/* Bottom User Area */}
      <div className={`${isCollapsed ? 'p-2 flex justify-center' : 'p-3'} border-t border-[#141418]`}>
        {currentUser ? (
          isCollapsed ? (
            <button
              onClick={() => onViewChange('profile')}
              title={`${currentUser.display_name} (@${currentUser.username})`}
              className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 text-black font-black text-xs flex items-center justify-center flex-shrink-0 hover:border-white transition-all cursor-pointer"
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
            </button>
          ) : (
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
          )
        ) : (
          isCollapsed ? (
            <button
              onClick={onOpenAuth}
              title={getTranslation(language, 'profile.loginBtn')}
              className="w-10 h-10 rounded-xl bg-[#101014] hover:bg-[#181820] border border-[#22222a] hover:border-white/40 flex items-center justify-center transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4 transition-colors" style={{ color: accentColor }} />
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full py-2 px-3 rounded-lg bg-[#101014] hover:bg-[#181820] border border-[#22222a] hover:border-white/40 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
            >
              <LogIn className="w-3.5 h-3.5 transition-colors" style={{ color: accentColor }} />
              <span className="transition-all">{getTranslation(language, 'profile.loginBtn')}</span>
            </button>
          )
        )}
      </div>

      {/* App Version Tag Footer */}
      {isCollapsed ? (
        <div className="py-2.5 flex items-center justify-center border-t border-[#141418]">
          <span className="text-[9px] font-mono text-[#555] font-bold">v{CURRENT_VERSION}</span>
        </div>
      ) : (
        <div className="px-3.5 py-2 flex items-center justify-between text-[10px] font-mono text-[#555] border-t border-[#141418]">
          <span className="text-[#666]">Spytify Client</span>
          <button
            onClick={() => onViewChange('profile')}
            title={getTranslation(language, 'sidebar.checkUpdate')}
            className="px-1.5 py-0.5 rounded bg-[#101014] hover:bg-[#181822] border border-[#202028] text-[#888] hover:text-white transition-colors cursor-pointer font-bold text-[9px]"
          >
            v{CURRENT_VERSION}
          </button>
        </div>
      )}
    </aside>
  );
};
