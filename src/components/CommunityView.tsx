import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, MessageSquare, Headphones, Users, Disc, Play, Pause, Send, 
  Sparkles, Music, Plus, Hash, Volume2, Shield, Flame, Activity, Share2
} from 'lucide-react';
import { Track, User, CommunityServer, CommunityChannel, CommunityMessage, StageSession } from '../types';
import { getSupabaseClient } from '../services/supabase';
import { LanguageCode } from '../locales/i18n';

interface CommunityViewProps {
  currentUser: User | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  accentColor?: string;
  language?: LanguageCode;
}

// Pre-configured Cyberpunk Music Hubs (Zero lag, instant render)
const DEFAULT_SERVERS: CommunityServer[] = [
  {
    id: 'srv_cyber_2077',
    name: 'Cyber Lounge 2077',
    description: 'Trạm phát Synthwave, Cyberpunk Beats & Lofi mật vụ xuyên đêm.',
    icon: '⚡',
    badge: 'OFFICIAL',
    accent_color: '#00E5FF',
    channels: [
      { id: 'ch_cyber_gen', name: 'general-chat', type: 'text', topic: 'Kênh đàm thoại mật vụ' },
      { id: 'ch_cyber_share', name: 'music-radar', type: 'text', topic: 'Chia sẻ các giai điệu Cyberpunk & Synth đỉnh cao' },
      { id: 'ch_cyber_stage', name: 'neon-stage', type: 'stage', topic: 'Sân khấu nghe nhạc đồng bộ thời gian thực' },
    ],
  },
  {
    id: 'srv_vpop_lounge',
    name: 'V-Pop Quán Quân',
    description: 'Cộng đồng yêu nhạc Việt, Hit V-Pop, Ballad và Rap Việt thịnh hành.',
    icon: '🔥',
    badge: 'HOT',
    accent_color: '#FF2A55',
    channels: [
      { id: 'ch_vpop_gen', name: 'tro-chuyen', type: 'text', topic: 'Tán gẫu và bàn luận âm nhạc Việt' },
      { id: 'ch_vpop_share', name: 'de-xuat-bai-hat', type: 'text', topic: 'Gợi ý bài hát yêu thích' },
      { id: 'ch_vpop_stage', name: 'live-lounge', type: 'stage', topic: 'Phòng nghe nhạc cùng nhau' },
    ],
  },
  {
    id: 'srv_lofi_station',
    name: 'Lofi Chilling Hub',
    description: 'Giai điệu thư giãn học tập, làm việc sâu và tập trung cao độ.',
    icon: '☕',
    badge: 'RELAX',
    accent_color: '#00FF66',
    channels: [
      { id: 'ch_lofi_gen', name: 'chill-chat', type: 'text', topic: 'Không gian yên tĩnh' },
      { id: 'ch_lofi_stage', name: 'focus-stage', type: 'stage', topic: 'Phát nhạc tập trung 24/7' },
    ],
  },
];

// Sample welcome messages for clean starting state
const SEED_MESSAGES: Record<string, CommunityMessage[]> = {
  'ch_cyber_gen': [
    {
      id: 'msg_1',
      server_id: 'srv_cyber_2077',
      channel_id: 'ch_cyber_gen',
      user_id: 'usr_system',
      username: 'SYSTEM',
      display_name: 'Spytify Central',
      avatar: null,
      content: 'Chào mừng bạn đến với Cyber Lounge 2077! Kênh đàm thoại bảo mật của các mật vụ âm nhạc.',
      created_at: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      id: 'msg_2',
      server_id: 'srv_cyber_2077',
      channel_id: 'ch_cyber_gen',
      user_id: 'usr_guest_demo',
      username: 'ShadowAgent',
      display_name: 'Spectre',
      avatar: null,
      content: 'Hôm nay nghe album Synthwave nào phê nhất anh em?',
      created_at: new Date(Date.now() - 1800000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ],
};

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentUser,
  currentTrack,
  isPlaying,
  onPlayTrack,
  accentColor = '#FF2A55',
}) => {
  const [selectedServer, setSelectedServer] = useState<CommunityServer>(DEFAULT_SERVERS[0]);
  const [selectedChannel, setSelectedChannel] = useState<CommunityChannel>(DEFAULT_SERVERS[0].channels[0]);
  const [messages, setMessages] = useState<CommunityMessage[]>(SEED_MESSAGES['ch_cyber_gen'] || []);
  const [inputText, setInputText] = useState('');
  const [attachCurrentTrack, setAttachCurrentTrack] = useState(false);
  
  // Live Stage session state
  const [stageSession, setStageSession] = useState<StageSession>({
    server_id: 'srv_cyber_2077',
    channel_id: 'ch_cyber_stage',
    host_user_id: 'host_agent',
    host_name: 'DJ CyberHawk',
    current_track: null,
    position_secs: 0,
    is_playing: false,
    listener_count: 7,
    updated_at: Date.now(),
  });

  // Online members list (mock + real presence)
  const [onlineMembers, setOnlineMembers] = useState([
    { id: 'usr_host', name: 'DJ CyberHawk', role: 'DJ / HOST', listening: 'After Dark - Mr.Kitty', isHost: true },
    { id: 'usr_agent_01', name: 'NeonSamurai', role: 'OPERATIVE', listening: 'Resonance - HOME', isHost: false },
    { id: 'usr_agent_02', name: 'GhostOperative', role: 'OPERATIVE', listening: null, isHost: false },
    { id: 'usr_me', name: currentUser?.display_name || 'Bạn (Operative)', role: 'BẠN', listening: currentTrack?.title || null, isHost: false },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<any>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle server switch
  const handleSelectServer = (server: CommunityServer) => {
    setSelectedServer(server);
    setSelectedChannel(server.channels[0]);
    setMessages(SEED_MESSAGES[server.channels[0].id] || []);
  };

  // Handle channel switch
  const handleSelectChannel = (channel: CommunityChannel) => {
    setSelectedChannel(channel);
    setMessages(SEED_MESSAGES[channel.id] || []);
  };

  // Setup Realtime WebSocket connection on current channel
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const channelTopic = `spytify_room_${selectedServer.id}_${selectedChannel.id}`;
    const channel = client.channel(channelTopic, {
      config: {
        broadcast: { ack: false },
        presence: { key: currentUser?.id || 'guest_' + Math.floor(Math.random() * 9999) },
      },
    });

    activeChannelRef.current = channel;

    // 1. Listen for broadcasted chat messages
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (payload && payload.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          // Keep maximum 80 messages in memory to protect RAM
          const next = [...prev, payload];
          return next.slice(-80);
        });
      }
    });

    // 2. Listen for Live Stage DJ sync broadcasts
    channel.on('broadcast', { event: 'stage_sync' }, ({ payload }) => {
      if (payload) {
        setStageSession(payload);
      }
    });

    channel.subscribe();

    // Clean up when channel changes or unmounts (ZERO lingering background sockets!)
    return () => {
      channel.unsubscribe();
      activeChannelRef.current = null;
    };
  }, [selectedServer.id, selectedChannel.id, currentUser?.id]);

  // Send message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean && !attachCurrentTrack) return;

    const newMsg: CommunityMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      server_id: selectedServer.id,
      channel_id: selectedChannel.id,
      user_id: currentUser?.id || 'guest',
      username: currentUser?.username || 'operative',
      display_name: currentUser?.display_name || 'Khách Vô Danh',
      avatar: currentUser?.avatar || null,
      content: clean,
      track_embed: attachCurrentTrack ? currentTrack : null,
      created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Optimistic UI update
    setMessages(prev => [...prev.slice(-79), newMsg]);
    setInputText('');
    setAttachCurrentTrack(false);

    // Broadcast message via Supabase Realtime
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: newMsg,
      });
    }
  };

  // Broadcast current track as Stage Host
  const handleBroadcastMyTrackAsHost = () => {
    if (!currentTrack) return;
    const newSession: StageSession = {
      server_id: selectedServer.id,
      channel_id: selectedChannel.id,
      host_user_id: currentUser?.id || 'guest',
      host_name: currentUser?.display_name || 'Mật Vụ DJ',
      current_track: currentTrack,
      position_secs: 0,
      is_playing: true,
      listener_count: stageSession.listener_count + 1,
      updated_at: Date.now(),
    };
    setStageSession(newSession);

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'stage_sync',
        payload: newSession,
      });
    }
  };

  const isStage = selectedChannel.type === 'stage';

  return (
    <div className="flex-1 flex h-full bg-[#07070a] select-none text-white overflow-hidden font-sans">
      {/* ──────────────── 1. DISCORD-STYLE SERVER RAIL (FAR LEFT) ──────────────── */}
      <div className="w-16 bg-[#040407] border-r border-[#14141c] flex flex-col items-center py-3 gap-2.5 flex-shrink-0 z-20">
        <button
          onClick={() => handleSelectServer(DEFAULT_SERVERS[0])}
          className="w-11 h-11 rounded-2xl bg-[#0e0e16] border border-[#222230] hover:border-white/40 flex items-center justify-center text-white cursor-pointer transition-all hover:rounded-xl shadow-md group relative"
          title="Trạm tổng Spytify Hub"
        >
          <Radio className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          <span className="absolute -left-1 w-1 h-5 rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </button>

        <div className="w-8 h-[1px] bg-[#1a1a24] my-1" />

        {/* Server Icons List */}
        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          {DEFAULT_SERVERS.map(srv => {
            const isSelected = selectedServer.id === srv.id;
            return (
              <div key={srv.id} className="relative group flex items-center justify-center w-full">
                {/* Active Server Indicator Pill */}
                <span 
                  className={`absolute left-0 w-1 rounded-r-full transition-all duration-200 ${
                    isSelected ? 'h-8 bg-white' : 'h-2 bg-zinc-600 opacity-0 group-hover:opacity-100'
                  }`}
                />
                
                <button
                  onClick={() => handleSelectServer(srv)}
                  className={`w-11 h-11 flex items-center justify-center text-base font-bold cursor-pointer transition-all duration-200 shadow-md ${
                    isSelected 
                      ? 'rounded-xl border' 
                      : 'rounded-3xl hover:rounded-xl bg-[#0e0e14] border border-[#1e1e28] hover:border-white/30 text-zinc-300 hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${srv.accent_color}25` : undefined,
                    borderColor: isSelected ? srv.accent_color : undefined,
                    color: isSelected ? srv.accent_color : undefined,
                  }}
                  title={srv.name}
                >
                  {srv.icon}
                </button>
              </div>
            );
          })}

          <button
            onClick={() => alert('Tính năng tạo máy chủ tùy chỉnh cá nhân (Custom Server) đang được tối ưu hóa cho bản v1.1.0!')}
            className="w-11 h-11 rounded-3xl hover:rounded-xl bg-[#0e0e14] hover:bg-emerald-950/40 border border-[#20202a] hover:border-emerald-500/50 text-[#666] hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer mt-1"
            title="Tạo trạm sóng mới"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ──────────────── 2. CHANNELS LIST COLUMN ──────────────── */}
      <div className="w-52 bg-[#09090e] border-r border-[#15151e] flex flex-col flex-shrink-0 z-10">
        {/* Server Header */}
        <div className="p-3.5 border-b border-[#15151e] flex items-center justify-between">
          <div className="truncate">
            <h2 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5 truncate">
              <span>{selectedServer.name}</span>
              {selectedServer.badge && (
                <span 
                  className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold tracking-wider uppercase border"
                  style={{
                    backgroundColor: `${selectedServer.accent_color}18`,
                    color: selectedServer.accent_color,
                    borderColor: `${selectedServer.accent_color}35`,
                  }}
                >
                  {selectedServer.badge}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-[#777] font-mono truncate mt-0.5">{selectedServer.description}</p>
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs font-sans">
          {/* Text Channels Group */}
          <div>
            <p className="text-[10px] font-mono font-bold text-[#555] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-[#444]" />
              KÊNH TRÒ CHUYỆN
            </p>
            <div className="space-y-0.5">
              {selectedServer.channels
                .filter(c => c.type === 'text')
                .map(channel => {
                  const isCur = selectedChannel.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                        isCur
                          ? 'bg-[#151520] text-white font-semibold'
                          : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5 text-[#666]" />
                      <span className="truncate">{channel.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Live Stage Channels Group */}
          <div>
            <p className="text-[10px] font-mono font-bold text-[#555] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
              <Headphones className="w-3 h-3 text-[#444]" />
              SÂN KHẤU NGHE CHUNG
            </p>
            <div className="space-y-0.5">
              {selectedServer.channels
                .filter(c => c.type === 'stage')
                .map(channel => {
                  const isCur = selectedChannel.id === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                        isCur
                          ? 'bg-[#161624] text-white font-semibold'
                          : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Volume2 className="w-3.5 h-3.5" style={{ color: selectedServer.accent_color }} />
                        <span className="truncate">{channel.name}</span>
                      </div>
                      <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                        LIVE
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* User Mini Bar at bottom of channels */}
        <div className="p-2.5 border-t border-[#15151e] bg-[#07070a] flex items-center gap-2 text-xs">
          <div 
            className="w-7 h-7 rounded-lg overflow-hidden border border-white/20 flex items-center justify-center font-bold text-[10px] flex-shrink-0"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
          >
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{(currentUser?.display_name || 'A').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-semibold text-white truncate">{currentUser?.display_name || 'Mật Vụ Tự Do'}</p>
            <p className="text-[10px] text-[#666] font-mono truncate">Online • Bảo mật</p>
          </div>
        </div>
      </div>

      {/* ──────────────── 3. MAIN CHAT / STAGE AREA ──────────────── */}
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0f] overflow-hidden">
        {/* Channel Header Bar */}
        <div className="h-12 px-4 border-b border-[#151520] bg-black/50 backdrop-blur flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 truncate">
            {isStage ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Hash className="w-4 h-4 text-[#777]" />
            )}
            <h3 className="text-xs font-bold text-white tracking-wide truncate">{selectedChannel.name}</h3>
            {selectedChannel.topic && (
              <>
                <span className="text-[#333]">|</span>
                <p className="text-[11px] text-[#777] font-mono truncate hidden sm:block">{selectedChannel.topic}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#777]">
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {onlineMembers.length} Mật vụ
            </span>
          </div>
        </div>

        {/* ──────── LIVE STAGE DJ BOOTH (WHEN IN STAGE CHANNEL) ──────── */}
        {isStage && (
          <div className="m-3 p-4 rounded-xl bg-gradient-to-r from-[#0d0d16] via-[#10101c] to-[#0d0d16] border border-[#202030] shadow-xl relative overflow-hidden flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div 
                  className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center flex-shrink-0 shadow-lg relative group"
                  style={{ boxShadow: `0 0 16px ${selectedServer.accent_color}30` }}
                >
                  {stageSession.current_track?.cover_art ? (
                    <img src={stageSession.current_track.cover_art} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-6 h-6 animate-spin text-white/80" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider border"
                      style={{
                        backgroundColor: `${selectedServer.accent_color}20`,
                        color: selectedServer.accent_color,
                        borderColor: `${selectedServer.accent_color}40`,
                      }}
                    >
                      DJ LIVE STAGE
                    </span>
                    <span className="text-[10px] text-[#888] font-mono">Host: {stageSession.host_name}</span>
                  </div>
                  <h4 className="text-sm font-black text-white mt-0.5 tracking-tight">
                    {stageSession.current_track?.title || 'Chưa có bài hát nào được phát trên Sân khấu'}
                  </h4>
                  <p className="text-[11px] text-[#888] font-mono">
                    {stageSession.current_track?.artist || 'Bấm "Làm DJ" bên phải để phát nhạc của bạn cho cả phòng nghe'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                {stageSession.current_track && (
                  <button
                    onClick={() => onPlayTrack(stageSession.current_track!)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Nghe cùng Host</span>
                  </button>
                )}

                {currentTrack && (
                  <button
                    onClick={handleBroadcastMyTrackAsHost}
                    className="px-3 py-1.5 rounded-lg bg-[#181824] hover:bg-[#202030] border border-[#303044] text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Phát bài bạn đang nghe lên sân khấu cho mọi người cùng thưởng thức"
                  >
                    <Disc className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Làm DJ Sân Khấu</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          {messages.map(msg => (
            <div key={msg.id} className="flex items-start gap-3 group hover:bg-[#101016]/40 -mx-2 px-2 py-1 rounded-lg transition-colors">
              {/* User Avatar */}
              <div 
                className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                {msg.avatar ? (
                  <img src={msg.avatar} alt={msg.display_name} className="w-full h-full object-cover" />
                ) : (
                  <span>{msg.display_name.charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                    {msg.display_name}
                  </span>
                  <span className="text-[10px] text-[#555] font-mono">@{msg.username}</span>
                  <span className="text-[10px] text-[#444] font-mono">{msg.created_at}</span>
                </div>

                {msg.content && (
                  <p className="text-xs text-[#ddd] leading-relaxed break-words font-sans">
                    {msg.content}
                  </p>
                )}

                {/* Embedded Track Card (If Shared in Chat!) */}
                {msg.track_embed && (
                  <div className="mt-2 max-w-sm p-2.5 rounded-xl bg-[#12121c] border border-[#222234] hover:border-white/30 transition-colors flex items-center justify-between gap-3 shadow-md">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#1a1a26] flex items-center justify-center flex-shrink-0">
                        {msg.track_embed.cover_art ? (
                          <img src={msg.track_embed.cover_art} alt="cover" className="w-full h-full object-cover" />
                        ) : (
                          <Music className="w-4 h-4 text-[#888]" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate">{msg.track_embed.title}</p>
                        <p className="text-[10px] text-[#888] font-mono truncate">{msg.track_embed.artist}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onPlayTrack(msg.track_embed!)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black transition-all cursor-pointer flex-shrink-0"
                      title="Phát bài này"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="p-3 border-t border-[#151520] bg-[#07070a] flex-shrink-0">
          {attachCurrentTrack && currentTrack && (
            <div className="mb-2 p-1.5 px-3 rounded-lg bg-[#12121a] border border-[#242434] text-xs font-mono text-[#aaa] flex items-center justify-between">
              <span className="flex items-center gap-2 truncate text-cyan-400">
                <Music className="w-3.5 h-3.5" />
                Đính kèm bài hát: <b className="text-white truncate">{currentTrack.title} - {currentTrack.artist}</b>
              </span>
              <button 
                onClick={() => setAttachCurrentTrack(false)} 
                className="text-[#666] hover:text-white cursor-pointer ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            {/* Quick Share Current Track Button */}
            {currentTrack && (
              <button
                type="button"
                onClick={() => setAttachCurrentTrack(p => !p)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer flex-shrink-0 ${
                  attachCurrentTrack 
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                    : 'bg-[#101016] border-[#222230] text-[#777] hover:text-white'
                }`}
                title="Đính kèm bài hát bạn đang nghe vào tin nhắn"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Gửi tín hiệu vào #${selectedChannel.name}...`}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#101018] text-white text-xs border border-[#222232] focus:border-white/50 outline-none transition-colors font-sans"
            />

            <button
              type="submit"
              disabled={!inputText.trim() && !attachCurrentTrack}
              className="p-2.5 rounded-xl text-black font-bold flex items-center justify-center transition-all cursor-pointer disabled:opacity-40"
              style={{
                backgroundColor: accentColor,
                color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* ──────────────── 4. ONLINE MEMBERS LIST (RIGHT RAIL) ──────────────── */}
      <div className="w-48 bg-[#07070b] border-l border-[#15151e] flex flex-col p-3 overflow-y-auto no-scrollbar hidden md:flex flex-shrink-0 text-xs">
        <p className="text-[10px] font-mono font-bold text-[#555] uppercase tracking-wider mb-2">
          TRỰC TUYẾN — {onlineMembers.length}
        </p>
        <div className="space-y-2">
          {onlineMembers.map(mem => (
            <div key={mem.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#101018] transition-colors">
              <div className="relative">
                <div 
                  className="w-7 h-7 rounded-lg bg-[#14141e] border border-white/10 flex items-center justify-center font-bold text-[10px] text-white"
                >
                  {mem.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-black" />
              </div>
              <div className="truncate flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-zinc-300 truncate">{mem.name}</span>
                  {mem.isHost && (
                    <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded">
                      DJ
                    </span>
                  )}
                </div>
                {mem.listening && (
                  <p className="text-[9px] text-cyan-400/80 font-mono truncate flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5 animate-pulse" />
                    {mem.listening}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
