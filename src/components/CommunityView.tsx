import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, MessageSquare, Headphones, Users, Disc, Play, Send, 
  Music, Plus, Hash, Volume2, Flame, Activity, Share2,
  Mic, MicOff, PhoneCall, PhoneOff, VolumeX, Signal, Shield,
  X, Sparkles, Palette, Check, Settings, Sliders, Volume1, RotateCcw, CheckCircle2,
  MoreVertical, UserPlus, UserCheck, Heart, UserMinus, Trash2, Copy, Crown, Info,
  Search, ShieldAlert, AlertCircle
} from 'lucide-react';
import { Track, User, CommunityServer, CommunityChannel, CommunityMessage, StageSession, VoiceParticipant, CommunityUserProfile } from '../types';
import { getSupabaseClient } from '../services/supabase';
import { LanguageCode, getTranslation } from '../locales/i18n';
import { getContrastTextColor } from '../utils/trackUtils';

interface CommunityViewProps {
  currentUser: User | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  accentColor?: string;
  language?: LanguageCode;
  themeMode?: 'dark' | 'light';
  onActiveServerChange?: (server: CommunityServer) => void;
}

// Default DJ stage track
const DEFAULT_DJ_TRACK: Track = {
  id: 'yt_after_dark',
  title: 'After Dark',
  artist: 'Mr.Kitty',
  album: 'Time (Cyberpunk Synthwave)',
  duration_secs: 259,
  path_or_url: 'sVx1mJDeUj8',
  source: 'youtube',
  cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
};

// Registered Operatives in Spytify Network
const INITIAL_USERS: CommunityUserProfile[] = [
  {
    id: 'usr_host',
    username: 'cyberhawk',
    display_name: 'DJ CyberHawk',
    avatar: null,
    role: 'DJ / HOST',
    status: 'online',
    bio: 'Resident DJ tại Cyber Lounge 2077. Chuyên dòng nhạc Synthwave, Cyberpunk Beats & Lofi mật vụ 320Kbps.',
    listening: 'After Dark - Mr.Kitty',
    listeningTrack: DEFAULT_DJ_TRACK,
    isHost: true,
    followsCurrentUser: true,
    joinedAt: '2024-01-15',
  },
  {
    id: 'usr_agent_01',
    username: 'neonsamurai',
    display_name: 'NeonSamurai',
    avatar: null,
    role: 'PRODUCER',
    status: 'online',
    bio: 'Cyberpunk Sound Designer & Beatsmith. Đam mê Synth & Phonk bass bùng nổ.',
    listening: 'Resonance - HOME',
    listeningTrack: {
      id: 'yt_resonance',
      title: 'Resonance',
      artist: 'HOME',
      album: 'Odyssey',
      duration_secs: 212,
      path_or_url: '8GW6sLrK40k',
      source: 'youtube',
      cover_art: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
    },
    isHost: false,
    followsCurrentUser: true,
    joinedAt: '2024-03-20',
  },
  {
    id: 'usr_luna_lofi',
    username: 'lunalofi',
    display_name: 'Luna Lofi',
    avatar: null,
    role: 'CHILL HOST',
    status: 'idle',
    bio: 'Thưởng thức trà chiều, mưa rơi và những giai điệu Lofi êm đềm.',
    listening: 'Snowman - WYS',
    listeningTrack: {
      id: 'yt_snowman',
      title: 'Snowman',
      artist: 'WYS',
      album: '1 Am. Study Session',
      duration_secs: 184,
      path_or_url: 'N_7nL37m33s',
      source: 'youtube',
      cover_art: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    isHost: false,
    followsCurrentUser: true,
    joinedAt: '2024-05-10',
  },
  {
    id: 'usr_ghost_op',
    username: 'ghostop',
    display_name: 'GhostOperative',
    avatar: null,
    role: 'AGENT',
    status: 'online',
    bio: 'Mật vụ bóng đêm Spytify. Âm nhạc là chìa khóa mở mọi cánh cửa.',
    listening: null,
    listeningTrack: null,
    isHost: false,
    followsCurrentUser: false,
    joinedAt: '2024-07-02',
  },
];

// Gentle Discord-style connection and disconnection sounds
function playAudioChime(type: 'join' | 'leave') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'join') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    } else {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

// Pre-configured Cyberpunk Music Hubs (including Bar & Club theme)
const BUILTIN_SERVERS: CommunityServer[] = [
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
      { id: 'ch_cyber_voice', name: 'Phòng Thoại Mật Vụ', type: 'voice', topic: 'Hội thoại trực tiếp thời gian thực (Discord Voice Call)' },
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
      { id: 'ch_lofi_voice', name: 'Phòng Học Tập & Chill', type: 'voice', topic: 'Bật mic học bài và thư giãn cùng nhau' },
    ],
  },
  {
    id: 'srv_underground_club',
    name: 'Neon Bar & Rave Club',
    description: 'Không gian tiệc tùng EDM, Deep House, Bass Boosted & Quầy Bar âm nhạc sôi động.',
    icon: '🍸',
    badge: 'NIGHTCLUB',
    accent_color: '#E040FB',
    channels: [
      { id: 'ch_club_gen', name: 'quay-bar-talk', type: 'text', topic: 'Trò chuyện và giao lưu tại quầy bar' },
      { id: 'ch_club_dj', name: 'yeu-cau-dj', type: 'text', topic: 'Yêu cầu bài hát sôi động' },
      { id: 'ch_club_voice', name: 'VIP Lounge Voice Call', type: 'voice', topic: 'Bật mic đàm thoại tại phòng VIP Club' },
    ],
  },
];

// Server Template Presets for Custom Server Creator
const SERVER_PRESETS = [
  {
    key: 'cyber',
    label: 'Cyber Lounge',
    icon: '⚡',
    color: '#00E5FF',
    desc: 'Trạm phát Synthwave, Cyberpunk Beats & Giác đấu ban đêm.',
    defaultChannels: [
      { name: 'general-chat', type: 'text' as const },
      { name: 'Phòng Thoại Mật Vụ', type: 'voice' as const },
    ]
  },
  {
    key: 'lofi',
    label: 'Lofi Chill Hub',
    icon: '☕',
    color: '#00FF66',
    desc: 'Không gian thư thái, học tập, đọc sách và tập trung cao độ.',
    defaultChannels: [
      { name: 'chill-chat', type: 'text' as const },
      { name: 'Phòng Học Tập & Chill', type: 'voice' as const },
    ]
  },
  {
    key: 'club',
    label: 'Bar & Nightclub',
    icon: '🍸',
    color: '#E040FB',
    desc: 'Quầy Bar sôi động, EDM, Deep House, Bassline tiệc tùng.',
    defaultChannels: [
      { name: 'quay-bar-talk', type: 'text' as const },
      { name: 'VIP Lounge Voice Call', type: 'voice' as const },
    ]
  },
  {
    key: 'custom',
    label: 'Tự do sáng tạo',
    icon: '🎧',
    color: '#FF2A55',
    desc: 'Tự đặt tên, biểu tượng và màu neon theo cá tính riêng của bạn.',
    defaultChannels: [
      { name: 'general-talk', type: 'text' as const },
      { name: 'Voice Call Room', type: 'voice' as const },
    ]
  }
];

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentUser,
  currentTrack,
  isPlaying,
  onPlayTrack,
  accentColor = '#FF2A55',
  language = 'vi',
  themeMode = 'dark',
  onActiveServerChange,
}) => {
  const isLight = themeMode === 'light';
  // Load custom servers from localStorage
  const [servers, setServers] = useState<CommunityServer[]>(() => {
    try {
      const saved = localStorage.getItem('spytify_user_servers');
      if (saved) {
        const parsed: CommunityServer[] = JSON.parse(saved);
        const cleaned = parsed.map(s => ({
          ...s,
          channels: s.channels.filter(c => c.type !== 'stage')
        }));
        return [...BUILTIN_SERVERS, ...cleaned];
      }
    } catch {}
    return BUILTIN_SERVERS;
  });

  const [selectedServer, setSelectedServer] = useState<CommunityServer>(servers[0]);
  const [selectedChannel, setSelectedChannel] = useState<CommunityChannel>(servers[0].channels[0]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachCurrentTrack, setAttachCurrentTrack] = useState(false);

  // ──────── MODAL TẠO SERVER MỚI ────────
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newServerPreset, setNewServerPreset] = useState('cyber');
  const [newServerName, setNewServerName] = useState('My Cyber Lounge');
  const [newServerDesc, setNewServerDesc] = useState('Trạm phát sóng âm nhạc mật vụ');
  const [newServerIcon, setNewServerIcon] = useState('⚡');
  const [newServerColor, setNewServerColor] = useState('#00E5FF');

  const getChannelName = (channel: CommunityChannel) => {
    if (channel.id === 'ch_cyber_voice') return getTranslation(language, 'community.agentVoiceRoom');
    return channel.name;
  };

  const getChannelTopic = (channel: CommunityChannel) => {
    if (channel.id === 'ch_cyber_gen') return getTranslation(language, 'community.generalChatTopic');
    if (channel.id === 'ch_cyber_share') return getTranslation(language, 'community.musicRadarTopic');
    if (channel.id === 'ch_cyber_voice') return getTranslation(language, 'community.agentVoiceTopic');
    return channel.topic;
  };

  // ──────── VOICE CALL STATE & SUPABASE SYNC ────────
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  // ──────── AUDIO & VOICE SETTINGS (MIC & SPEAKER) ────────
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [micVolume, setMicVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_mic_volume');
      return v ? Math.min(200, Math.max(0, parseInt(v, 10))) : 100;
    } catch {
      return 100;
    }
  });
  const [speakerVolume, setSpeakerVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_speaker_volume');
      return v ? Math.min(200, Math.max(0, parseInt(v, 10))) : 100;
    } catch {
      return 100;
    }
  });
  const [micSensitivity, setMicSensitivity] = useState<number>(() => {
    try {
      const v = localStorage.getItem('spytify_mic_sensitivity');
      return v ? parseInt(v, 10) : 14;
    } catch {
      return 14;
    }
  });
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_noise_suppression') !== 'false';
    } catch {
      return true;
    }
  });
  const [echoCancellation, setEchoCancellation] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spytify_echo_cancellation') !== 'false';
    } catch {
      return true;
    }
  });

  // ──────── MEMBER LIST VISIBILITY (DISCORD STYLE) ────────
  const [isMemberListVisible, setIsMemberListVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('spytify_member_list_visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleMemberList = () => {
    setIsMemberListVisible(prev => {
      const next = !prev;
      try {
        localStorage.setItem('spytify_member_list_visible', String(next));
      } catch {}
      return next;
    });
  };

  // Live Mic Test in Settings
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testMicLevel, setTestMicLevel] = useState(0);
  const testStreamRef = useRef<MediaStream | null>(null);
  const testCtxRef = useRef<AudioContext | null>(null);
  const testAnimRef = useRef<number | null>(null);

  // Microphone stream & Web Audio Analyser references
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // My unique participant ID (persisted per session)
  const myParticipantIdRef = useRef<string>(
    currentUser?.id || 'guest_' + Math.random().toString(36).substring(2, 8)
  );

  // Voice call participants in current channel (Synced in Realtime via Supabase & Invites!)
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);

  // Right-click context menu for online members
  const [memberMenu, setMemberMenu] = useState<{
    x: number;
    y: number;
    member: {
      id: string;
      name: string;
      role: string;
      listening: string | null;
      isHost?: boolean;
      status?: string;
      listeningTrack?: Track | null;
    };
  } | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setMemberMenu(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  const handleInviteMemberToVoice = (member: { id: string; name: string; isHost?: boolean }) => {
    // If not currently in voice, join voice first!
    if (!connectedVoiceChannel) {
      const voiceCh = selectedServer.channels.find(c => c.type === 'voice') || selectedChannel;
      handleJoinVoiceCall(voiceCh.id);
    }

    const newVp: VoiceParticipant = {
      id: member.id,
      name: member.name,
      username: member.id.replace('usr_', ''),
      avatar: null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: !!member.isHost,
      isHost: !!member.isHost,
    };

    setVoiceParticipants(prev => {
      if (prev.some(p => p.id === member.id)) return prev;
      return [...prev, newVp];
    });

    playAudioChime('join');
    setMemberMenu(null);
  };

  const handleRemoveMemberFromVoice = (memberId: string) => {
    setVoiceParticipants(prev => prev.filter(p => p.id !== memberId));
    playAudioChime('leave');
    setMemberMenu(null);
  };

  // Live Stage session state with authentic DJ CyberHawk stream
  const [stageSession, setStageSession] = useState<StageSession>({
    server_id: servers[0].id,
    channel_id: 'ch_cyber_stage',
    host_user_id: 'usr_host',
    host_name: 'DJ CyberHawk',
    current_track: DEFAULT_DJ_TRACK,
    position_secs: 42,
    is_playing: true,
    listener_count: 14,
    updated_at: Date.now(),
  });

  // ──────── REGISTERED USERS & MUTUAL FOLLOW FRIENDS SYSTEM ────────
  const [registeredUsers, setRegisteredUsers] = useState<CommunityUserProfile[]>(() => {
    try {
      const saved = localStorage.getItem('spytify_registered_users');
      if (saved) {
        const parsed: CommunityUserProfile[] = JSON.parse(saved);
        // Exclude fake/injected custom users from earlier searches
        const filtered = parsed.filter(u => !u.id.startsWith('usr_custom_') && u.username !== 'a');
        localStorage.setItem('spytify_registered_users', JSON.stringify(filtered));
        return filtered;
      }
    } catch {}
    return INITIAL_USERS;
  });

  // User's following list (stored in localStorage)
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('spytify_user_following');
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const filtered = parsed.filter(id => !id.startsWith('usr_custom_'));
        localStorage.setItem('spytify_user_following', JSON.stringify(filtered));
        return new Set(filtered);
      }
    } catch {}
    return new Set(['usr_host', 'usr_agent_01']);
  });

  // Individual user volume scaling (Discord-style: 0% - 200%, default 100%)
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('spytify_user_volumes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [isFriendsTabActive, setIsFriendsTabActive] = useState(false);
  const [friendsTab, setFriendsTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendMessage, setAddFriendMessage] = useState<string | null>(null);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<CommunityUserProfile | null>(null);

  // ──────── SERVER SETTINGS STATE ────────
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [serverSettingsTab, setServerSettingsTab] = useState<'overview' | 'members' | 'invites' | 'danger'>('overview');
  const [editServerName, setEditServerName] = useState('');
  const [editServerDesc, setEditServerDesc] = useState('');
  const [editServerIcon, setEditServerIcon] = useState('⚡');
  const [editServerColor, setEditServerColor] = useState('#00E5FF');
  const [editServerMaxMembers, setEditServerMaxMembers] = useState(50);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Follow / Unfollow logic
  const handleToggleFollow = (userId: string) => {
    setFollowingUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      try {
        localStorage.setItem('spytify_user_following', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Rule: A follows B and B follows A => Friends!
  const isMutualFriend = (user: CommunityUserProfile) => {
    return followingUserIds.has(user.id) && Boolean(user.followsCurrentUser);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFriendMessage(null);
    setAddFriendError(null);

    const cleanHandle = addFriendInput.trim().replace(/^@/, '').toLowerCase();
    if (!cleanHandle) return;

    // Check if adding self
    if (currentUser && (currentUser.username?.toLowerCase() === cleanHandle || currentUser.display_name?.toLowerCase() === cleanHandle)) {
      setAddFriendError('Bạn không thể tự kết bạn với chính mình!');
      setTimeout(() => setAddFriendError(null), 3500);
      return;
    }

    // 1. Check in known registered users
    let target = registeredUsers.find(u => 
      !u.id.startsWith('usr_custom_') && 
      (u.username.toLowerCase() === cleanHandle || u.display_name.toLowerCase() === cleanHandle)
    );

    // 2. Query Supabase Cloud Database for real users
    if (!target) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data } = await client
            .from('spytify_profiles')
            .select('id, username, display_name, avatar')
            .or(`username.ilike.${cleanHandle},display_name.ilike.${cleanHandle}`)
            .limit(1);

          if (data && data.length > 0) {
            const p = data[0];
            target = {
              id: p.id,
              username: p.username || cleanHandle,
              display_name: p.display_name || p.username || cleanHandle,
              avatar: p.avatar || null,
              role: 'AGENT',
              status: 'online',
              bio: 'Mật vụ Spytify từ hệ thống đám mây.',
              listening: null,
              isHost: false,
              followsCurrentUser: true,
              joinedAt: new Date().toISOString().split('T')[0],
            };
            setRegisteredUsers(prev => {
              const next = [...prev.filter(u => u.id !== target!.id), target!];
              localStorage.setItem('spytify_registered_users', JSON.stringify(next));
              return next;
            });
          }
        } catch (err) {
          console.error('Supabase user search failed:', err);
        }
      }
    }

    // 3. If STILL not found: STRICT REJECTION! Do NOT invent fake users!
    if (!target) {
      setAddFriendError(`Người dùng @${cleanHandle} không tồn tại trên hệ thống Spytify!`);
      setTimeout(() => setAddFriendError(null), 3500);
      return;
    }

    setFollowingUserIds(prev => {
      const next = new Set(prev);
      next.add(target!.id);
      localStorage.setItem('spytify_user_following', JSON.stringify(Array.from(next)));
      return next;
    });

    setAddFriendMessage(`Đã kết bạn thành công với ${target.display_name} (@${target.username})!`);
    setAddFriendInput('');
    setTimeout(() => setAddFriendMessage(null), 3500);
  };

  const handlePlayMemberTrack = (member: { listeningTrack?: Track | null, listening?: string | null }) => {
    if (member.listeningTrack) {
      onPlayTrack(member.listeningTrack);
    } else if (member.listening) {
      const parts = member.listening.split(' - ');
      const t: Track = {
        id: `yt_track_${Date.now()}`,
        title: parts[0] || member.listening,
        artist: parts[1] || 'Spytify Artist',
        album: 'Cyber Station Radio',
        duration_secs: 210,
        path_or_url: member.listening,
        source: 'youtube',
        cover_art: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
      };
      onPlayTrack(t);
    }
  };

  const handleOpenServerSettings = (srv: CommunityServer) => {
    setEditServerName(srv.name);
    setEditServerDesc(srv.description);
    setEditServerIcon(srv.icon);
    setEditServerColor(srv.accent_color);
    setEditServerMaxMembers(srv.max_members || 50);
    setServerSettingsTab('overview');
    setInviteCopied(false);
    setIsServerSettingsOpen(true);
  };

  const handleSaveServerSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editServerName.trim()) return;

    const updatedSrv: CommunityServer = {
      ...selectedServer,
      name: editServerName.trim(),
      description: editServerDesc.trim(),
      icon: editServerIcon.trim() || '⚡',
      accent_color: editServerColor,
      max_members: editServerMaxMembers,
    };

    const updatedList = servers.map(s => s.id === selectedServer.id ? updatedSrv : s);
    setServers(updatedList);
    setSelectedServer(updatedSrv);

    const customOnly = updatedList.filter(s => s.id.startsWith('srv_custom_') || s.is_custom);
    localStorage.setItem('spytify_user_servers', JSON.stringify(customOnly));

    onActiveServerChange?.(updatedSrv);
    setIsServerSettingsOpen(false);
  };

  const handleDeleteServer = (srvId: string) => {
    const nextServers = servers.filter(s => s.id !== srvId);
    setServers(nextServers);
    const customOnly = nextServers.filter(s => s.id.startsWith('srv_custom_') || s.is_custom);
    localStorage.setItem('spytify_user_servers', JSON.stringify(customOnly));
    setSelectedServer(nextServers[0]);
    setSelectedChannel(nextServers[0].channels[0]);
    onActiveServerChange?.(nextServers[0]);
    setIsServerSettingsOpen(false);
  };

  const handleKickMember = (memberId: string) => {
    setSelectedServer(prev => {
      const nextMemberIds = (prev.member_ids || ['usr_me', 'usr_host', 'usr_agent_01']).filter(id => id !== memberId);
      const updated = { ...prev, member_ids: nextMemberIds };
      setServers(curr => curr.map(s => s.id === prev.id ? updated : s));
      const customOnly = servers.map(s => s.id === prev.id ? updated : s).filter(s => s.id.startsWith('srv_custom_') || s.is_custom);
      localStorage.setItem('spytify_user_servers', JSON.stringify(customOnly));
      return updated;
    });
  };

  const handleCopyInvite = (srvId: string) => {
    navigator.clipboard.writeText(`spytify://station/join/${srvId}`);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  // Online members list synced with registered users
  const onlineMembers = [
    ...registeredUsers.map(u => ({
      id: u.id,
      name: u.display_name,
      role: u.role,
      listening: u.listening || null,
      listeningTrack: u.listeningTrack || null,
      isHost: Boolean(u.isHost),
      userProfile: u,
    })),
    {
      id: 'usr_me',
      name: currentUser?.display_name || 'Bạn (Operative)',
      role: 'BẠN',
      listening: currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : null,
      listeningTrack: currentTrack,
      isHost: false,
      userProfile: {
        id: 'usr_me',
        username: currentUser?.email?.split('@')[0] || 'me',
        display_name: currentUser?.display_name || 'Bạn (Operative)',
        avatar: currentUser?.avatar || null,
        role: 'BẠN',
        status: 'online' as const,
        bio: 'Mật vụ tối cao đang lắng nghe Spytify.',
        listening: currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : null,
        listeningTrack: currentTrack,
        isHost: false,
        followsCurrentUser: false,
      }
    }
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<any>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    onActiveServerChange?.(selectedServer);
  }, [selectedServer, onActiveServerChange]);

  // Handle server switch
  const handleSelectServer = (server: CommunityServer) => {
    setSelectedServer(server);
    setSelectedChannel(server.channels[0]);
    setMessages([]);
    onActiveServerChange?.(server);
  };

  // Handle channel switch
  const handleSelectChannel = (channel: CommunityChannel) => {
    setSelectedChannel(channel);
    setMessages([]);

    // Nếu là kênh Voice (như "Phòng Thoại Mật Vụ"): Tự động tham gia cuộc gọi ngay lập tức giống Discord!
    if (channel.type === 'voice') {
      if (connectedVoiceChannel !== channel.id) {
        handleJoinVoiceCall(channel.id);
      }
    }
  };

  // ──────── SUPABASE REALTIME SYNC (MESSAGES & VOICE STATE) ────────
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const channelTopic = `spytify_room_${selectedServer.id}_${selectedChannel.id}`;
    const channel = client.channel(channelTopic, {
      config: {
        broadcast: { ack: false },
        presence: { key: myParticipantIdRef.current },
      },
    });

    activeChannelRef.current = channel;

    // 1. Nhận tin nhắn chat mới từ mọi máy khác
    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (payload && payload.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.id)) return prev;
          return [...prev, payload].slice(-80);
        });
      }
    });

    // 2. Nhận tín hiệu Sân khấu Live Stage DJ
    channel.on('broadcast', { event: 'stage_sync' }, ({ payload }) => {
      if (payload) {
        setStageSession(payload);
      }
    });

    // 3. ĐỒNG BỘ HỘI THOẠI REALTIME (VOICE CALL STATE SYNC)
    channel.on('broadcast', { event: 'voice_presence' }, ({ payload }) => {
      if (!payload) return;
      if (payload.action === 'join' && payload.participant) {
        setVoiceParticipants(prev => {
          if (prev.some(p => p.id === payload.participant.id)) return prev;
          return [...prev, payload.participant];
        });
      } else if (payload.action === 'leave' && payload.userId) {
        setVoiceParticipants(prev => prev.filter(p => p.id !== payload.userId));
      }
    });

    channel.on('broadcast', { event: 'voice_speaking' }, ({ payload }) => {
      if (!payload) return;
      setVoiceParticipants(prev =>
        prev.map(p => (p.id === payload.userId ? { ...p, isSpeaking: payload.isSpeaking } : p))
      );
    });

    channel.on('broadcast', { event: 'voice_mute' }, ({ payload }) => {
      if (!payload) return;
      setVoiceParticipants(prev =>
        prev.map(p => (p.id === payload.userId ? { ...p, isMuted: payload.isMuted } : p))
      );
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
      activeChannelRef.current = null;
    };
  }, [selectedServer.id, selectedChannel.id]);

  // ──────── THAM GIA / RỜI CUỘC GỌI VOICE CALL ────────
  const handleJoinVoiceCall = async (targetChannelId?: string) => {
    const myId = myParticipantIdRef.current;
    const channelIdToConnect = targetChannelId || selectedChannel.id;

    // Dọn dẹp session cũ nếu đang kết nối ở kênh khác
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    micGainRef.current = null;

    const myParticipant: VoiceParticipant = {
      id: myId,
      name: currentUser?.display_name || 'Bạn',
      username: currentUser?.username || 'operative',
      avatar: currentUser?.avatar || null,
      isMuted: false,
      isDeafened: false,
      isSpeaking: false,
      isHost: selectedServer.id.startsWith('srv_custom_'),
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression,
          echoCancellation,
        },
      });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      const micGain = audioCtx.createGain();
      micGain.gain.setValueAtTime(micVolume / 100, audioCtx.currentTime);
      source.connect(micGain);
      micGain.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      micGainRef.current = micGain;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkAudioActivity = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const nowSpeaking = !isMuted && avg > micSensitivity;

        if (nowSpeaking !== wasSpeaking) {
          wasSpeaking = nowSpeaking;
          setIsUserSpeaking(nowSpeaking);

          // Phát sóng trạng thái nói Realtime qua Supabase!
          if (activeChannelRef.current) {
            activeChannelRef.current.send({
              type: 'broadcast',
              event: 'voice_speaking',
              payload: { userId: myId, isSpeaking: nowSpeaking },
            });
          }
        }

        animFrameRef.current = requestAnimationFrame(checkAudioActivity);
      };
      checkAudioActivity();

      setConnectedVoiceChannel(channelIdToConnect);
      playAudioChime('join');

      // Phát sóng trạng thái tham gia cuộc gọi qua Supabase!
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'join', participant: myParticipant },
        });
      }
    } catch {
      setConnectedVoiceChannel(channelIdToConnect);
      setIsMuted(true);
      playAudioChime('join');

      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_presence',
          payload: { action: 'join', participant: { ...myParticipant, isMuted: true } },
        });
      }
    }
  };

  const handleLeaveVoiceCall = () => {
    const myId = myParticipantIdRef.current;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    micGainRef.current = null;

    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'voice_presence',
        payload: { action: 'leave', userId: myId },
      });
    }

    setConnectedVoiceChannel(null);
    setIsUserSpeaking(false);
    playAudioChime('leave');
  };

  const handleToggleMute = () => {
    const myId = myParticipantIdRef.current;
    setIsMuted(prev => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(t => {
          t.enabled = !next;
        });
      }
      if (activeChannelRef.current) {
        activeChannelRef.current.send({
          type: 'broadcast',
          event: 'voice_mute',
          payload: { userId: myId, isMuted: next },
        });
      }
      return next;
    });
  };

  const handleToggleDeafen = () => {
    setIsDeafened(prev => !prev);
  };

  // ──────── AUDIO CONTROL HELPERS (VOLUME, CHIME, MIC TEST) ────────
  const handleMicVolumeChange = (newVol: number) => {
    setMicVolume(newVol);
    localStorage.setItem('spytify_mic_volume', String(newVol));
    if (micGainRef.current && audioContextRef.current) {
      try {
        micGainRef.current.gain.setValueAtTime(newVol / 100, audioContextRef.current.currentTime);
      } catch {}
    }
  };

  const handleSpeakerVolumeChange = (newVol: number) => {
    setSpeakerVolume(newVol);
    localStorage.setItem('spytify_speaker_volume', String(newVol));
  };

  const playSpeakerTestSound = (vol?: number) => {
    try {
      const effectiveVol = vol !== undefined ? vol : (isDeafened ? 0 : speakerVolume);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const volumeLevel = Math.max(0, Math.min(2, effectiveVol / 100)) * 0.25;
      gain.gain.setValueAtTime(volumeLevel, now);
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.25);
      osc2.frequency.setValueAtTime(659.25, now);
      osc2.frequency.exponentialRampToValueAtTime(1318.5, now + 0.25);

      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 600);
    } catch (e) {
      console.error('Test audio error:', e);
    }
  };

  const startMicTest = async () => {
    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression,
          echoCancellation,
        },
      });
      testStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(micVolume / 100, audioCtx.currentTime);
      source.connect(gain);
      gain.connect(analyser);

      testCtxRef.current = audioCtx;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100 * (micVolume / 100)));
        setTestMicLevel(normalized);
        testAnimRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      console.warn('Cannot test microphone:', err);
      setIsTestingMic(false);
    }
  };

  const stopMicTest = () => {
    setIsTestingMic(false);
    setTestMicLevel(0);
    if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current);
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (testCtxRef.current) {
      testCtxRef.current.close().catch(() => {});
      testCtxRef.current = null;
    }
  };

  // ──────── TỰ TẠO SERVER MỚI (CUSTOM SERVER CREATION) ────────
  const handleSelectPreset = (presetKey: string) => {
    const p = SERVER_PRESETS.find(x => x.key === presetKey);
    if (!p) return;
    setNewServerPreset(presetKey);
    setNewServerName(p.label);
    setNewServerDesc(p.desc);
    setNewServerIcon(p.icon);
    setNewServerColor(p.color);
  };

  const handleCreateServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim()) return;

    const p = SERVER_PRESETS.find(x => x.key === newServerPreset) || SERVER_PRESETS[0];
    const srvId = `srv_custom_${Date.now()}`;

    const newChannels: CommunityChannel[] = p.defaultChannels.map((c, idx) => ({
      id: `ch_${srvId}_${idx}`,
      name: c.name,
      type: c.type,
      topic: `${c.name} - Trạm ${newServerName}`,
    }));

    const createdServer: CommunityServer = {
      id: srvId,
      name: newServerName.trim(),
      description: newServerDesc.trim() || 'Trạm sóng âm nhạc cá nhân Spytify',
      icon: newServerIcon || '🎧',
      badge: 'OWNER',
      accent_color: newServerColor,
      channels: newChannels,
      is_verified: true,
      owner_id: currentUser?.id || 'usr_me',
      is_custom: true,
      max_members: 50,
      member_ids: ['usr_me', 'usr_host', 'usr_agent_01'],
    };

    const updated = [...servers, createdServer];
    setServers(updated);

    // Save custom servers to localStorage
    const customOnly = updated.filter(s => s.id.startsWith('srv_custom_'));
    localStorage.setItem('spytify_user_servers', JSON.stringify(customOnly));

    setIsCreateModalOpen(false);
    setSelectedServer(createdServer);
    setSelectedChannel(createdServer.channels[0]);
    setMessages([]);
  };

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

    setMessages(prev => [...prev.slice(-79), newMsg]);
    setInputText('');
    setAttachCurrentTrack(false);

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
  const isVoice = selectedChannel.type === 'voice';
  const isConnectedToCurrentVoice = connectedVoiceChannel === selectedChannel.id;

  return (
    <div className={`flex-1 flex h-full select-none overflow-hidden font-sans ${isLight ? 'bg-[#f8fafc] text-[#0f172a]' : 'bg-[#07070a] text-white'}`}>
      {/* ──────────────── 1. DISCORD-STYLE SERVER RAIL (FAR LEFT) ──────────────── */}
      <div className={`w-16 flex flex-col items-center py-3 gap-2 flex-shrink-0 z-20 border-r ${isLight ? 'bg-[#f1f5f9] border-[#e2e8f0]' : 'bg-[#040407] border-[#14141c]'}`}>
        {/* Top: Discord Direct Messages / Friends Button */}
        <button
          onClick={() => setIsFriendsTabActive(true)}
          className={`w-11 h-11 flex items-center justify-center cursor-pointer transition-all shadow-md group relative ${
            isFriendsTabActive
              ? 'rounded-xl border'
              : isLight
              ? 'rounded-2xl hover:rounded-xl bg-[#ffffff] border border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
              : 'rounded-2xl hover:rounded-xl bg-[#0e0e16] border border-[#222230] text-white hover:border-white/40'
          }`}
          style={{
            backgroundColor: isFriendsTabActive ? `${accentColor}25` : undefined,
            borderColor: isFriendsTabActive ? accentColor : undefined,
            color: isFriendsTabActive ? accentColor : undefined,
          }}
          title="Bạn bè & Tin nhắn trực tiếp (Friends & DMs)"
        >
          <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span 
            className={`absolute -left-1 w-1 rounded-r-full transition-all duration-200 ${
              isFriendsTabActive ? 'h-8 opacity-100' : 'h-2 opacity-0 group-hover:opacity-100'
            }`} 
            style={{ backgroundColor: accentColor }}
          />
        </button>

        <div className={`w-8 h-[1px] my-0.5 ${isLight ? 'bg-[#e2e8f0]' : 'bg-[#1a1a24]'}`} />

        {/* Server Icons List */}
        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto no-scrollbar">
          {servers.map(srv => {
            const isSelected = !isFriendsTabActive && selectedServer.id === srv.id;
            return (
              <div key={srv.id} className="relative group flex items-center justify-center w-full">
                <span 
                  className={`absolute left-0 w-1 rounded-r-full transition-all duration-200 ${
                    isSelected ? 'h-8' : 'h-2 bg-zinc-600 opacity-0 group-hover:opacity-100'
                  }`}
                  style={{ backgroundColor: isSelected ? accentColor : undefined }}
                />
                
                <button
                  onClick={() => {
                    setIsFriendsTabActive(false);
                    handleSelectServer(srv);
                  }}
                  className={`w-11 h-11 flex items-center justify-center text-base font-bold cursor-pointer transition-all duration-200 shadow-md ${
                    isSelected 
                      ? 'rounded-xl border' 
                      : isLight 
                      ? 'rounded-3xl hover:rounded-xl bg-[#ffffff] border border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                      : 'rounded-3xl hover:rounded-xl bg-[#0e0e14] border border-[#1e1e28] hover:border-white/30 text-zinc-300 hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${accentColor}25` : undefined,
                    borderColor: isSelected ? accentColor : undefined,
                    color: isSelected ? accentColor : undefined,
                  }}
                  title={srv.name}
                >
                  {srv.icon}
                </button>
              </div>
            );
          })}

          {/* NÚT "+" ĐỂ MỞ BẢNG TỰ TẠO SERVER */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className={`w-11 h-11 rounded-3xl hover:rounded-xl border flex items-center justify-center transition-all cursor-pointer mt-1 group ${
              isLight 
                ? 'bg-[#ffffff] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:border-emerald-500'
                : 'bg-[#0e0e14] hover:bg-emerald-950/40 border-[#20202a] hover:border-emerald-500/50 text-[#666] hover:text-emerald-400'
            }`}
            title={getTranslation(language, 'community.createServer')}
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      </div>

      {/* ──────────────── 2. CHANNELS LIST OR FRIENDS NAVIGATION COLUMN ──────────────── */}
      <div className={`w-56 flex flex-col flex-shrink-0 z-10 border-r ${isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#09090e] border-[#15151e]'}`}>
        {isFriendsTabActive ? (
          <>
            {/* Friends Navigation Header */}
            <div className={`p-3.5 border-b flex items-center justify-between ${isLight ? 'border-[#e2e8f0]' : 'border-[#15151e]'}`}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: accentColor }} />
                <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  Bạn Bè Mật Vụ
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                onClick={() => setFriendsTab('online')}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  friendsTab === 'online'
                    ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/10 text-white'
                    : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Trực tuyến</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                  {registeredUsers.filter(u => isMutualFriend(u) && u.status === 'online').length}
                </span>
              </button>

              <button
                onClick={() => setFriendsTab('all')}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  friendsTab === 'all'
                    ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/10 text-white'
                    : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tất cả bạn bè</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                  {registeredUsers.filter(u => isMutualFriend(u)).length}
                </span>
              </button>

              <button
                onClick={() => setFriendsTab('pending')}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  friendsTab === 'pending'
                    ? isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/10 text-white'
                    : isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-[#888] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-pink-400" />
                  <span>Đang theo dõi</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20">
                  {followingUserIds.size}
                </span>
              </button>

              <button
                onClick={() => setFriendsTab('add')}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                  friendsTab === 'add'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-emerald-500 hover:bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Thêm bạn mới</span>
                </div>
              </button>

              <div className="pt-3 pb-1 px-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#666]">
                  TIN NHẮN TRỰC TIẾP
                </span>
              </div>

              {registeredUsers.filter(u => isMutualFriend(u)).map(fr => (
                <div
                  key={fr.id}
                  onClick={() => setSelectedProfileUser(fr)}
                  className={`flex items-center gap-2 p-2 rounded-xl transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-white">
                      {fr.display_name.charAt(0)}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black ${
                      fr.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`} />
                  </div>
                  <div className="truncate flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                      {fr.display_name}
                    </p>
                    <p className="text-[9px] font-mono text-[#888] truncate">
                      {fr.listening ? `🎵 ${fr.listening}` : `@${fr.username}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Server Header */}
            <div className={`p-3.5 border-b flex items-center justify-between gap-2 ${isLight ? 'border-[#e2e8f0]' : 'border-[#15151e]'}`}>
              <div className="truncate flex-1">
                <h2 className={`text-xs font-black tracking-tight flex items-center gap-1.5 truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  <span>{selectedServer.name}</span>
                  {selectedServer.badge && (
                    <span 
                      className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold tracking-wider uppercase border"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        color: accentColor,
                        borderColor: `${accentColor}35`,
                      }}
                    >
                      {selectedServer.badge}
                    </span>
                  )}
                </h2>
                <p className={`text-[10px] font-mono truncate mt-0.5 ${isLight ? 'text-[#64748b]' : 'text-[#777]'}`}>{selectedServer.description}</p>
              </div>

              {/* Server Settings Cog Button */}
              <button
                onClick={() => handleOpenServerSettings(selectedServer)}
                title="Cài đặt máy chủ & Quản lý thành viên (Discord Server Settings)"
                className={`p-1.5 rounded-lg border transition-all cursor-pointer flex-shrink-0 ${
                  isLight 
                    ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900' 
                    : 'bg-[#12121a] hover:bg-[#1a1a26] border-[#222230] text-[#888] hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 hover:rotate-90 transition-transform" />
              </button>
            </div>

            {/* Channels List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs font-sans">
          {/* Text Channels Group */}
          <div>
            <p className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5 ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>
              <MessageSquare className="w-3 h-3 text-[#444]" />
              {getTranslation(language, 'community.textChannels')}
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
                          ? isLight ? 'bg-[#e2e8f0] text-[#0f172a] font-semibold' : 'bg-[#151520] text-white font-semibold'
                          : isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#edf2f7]' : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                      }`}
                    >
                      <Hash className="w-3.5 h-3.5 text-[#666]" />
                      <span className="truncate">{channel.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Voice Call Channels Group */}
          <div>
            <p className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5 ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>
              <Mic className="w-3 h-3 text-[#444]" />
              {getTranslation(language, 'community.voiceChannels')}
            </p>
            <div className="space-y-0.5">
              {selectedServer.channels
                .filter(c => c.type === 'voice')
                .map(channel => {
                  const isCur = selectedChannel.id === channel.id;
                  const isVoiceActive = connectedVoiceChannel === channel.id;
                  const otherVoiceParticipants = voiceParticipants.filter(p => p.id !== myParticipantIdRef.current);
                  const totalVoiceCount = (isVoiceActive ? 1 : 0) + otherVoiceParticipants.length;

                  return (
                    <div key={channel.id} className="space-y-1">
                      <button
                        onClick={() => handleSelectChannel(channel)}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left cursor-pointer transition-colors ${
                          isCur
                            ? isLight ? 'bg-[#e2e8f0] text-[#0f172a] font-semibold' : 'bg-[#161624] text-white font-semibold'
                            : isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#edf2f7]' : 'text-[#888899] hover:text-white hover:bg-[#0e0e14]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Volume2 className="w-3.5 h-3.5" style={{ color: isVoiceActive ? '#00FF66' : accentColor }} />
                          <span className="truncate">{getChannelName(channel)}</span>
                        </div>
                        {isVoiceActive ? (
                          <span 
                            className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded border"
                            style={{
                              color: accentColor,
                              backgroundColor: `${accentColor}18`,
                              borderColor: `${accentColor}40`,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
                            {getTranslation(language, 'community.connected')}
                          </span>
                        ) : (
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${isLight ? 'bg-[#ffffff] text-[#64748b] border-[#cbd5e1]' : 'bg-[#121218] text-[#666] border-[#202028]'}`}>
                            {totalVoiceCount} {getTranslation(language, 'community.members')}
                          </span>
                        )}
                      </button>

                      {/* Indented Participants list under voice channel */}
                      {(isVoiceActive || otherVoiceParticipants.length > 0) && (
                        <div className="pl-6 space-y-1 py-0.5">
                          {isVoiceActive && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: accentColor }}>
                              <div className="relative">
                                <span 
                                  className="w-4 h-4 rounded-full border text-[9px] font-bold flex items-center justify-center text-white"
                                  style={{
                                    backgroundColor: `${accentColor}30`,
                                    borderColor: accentColor,
                                  }}
                                >
                                  {(currentUser?.display_name || 'B').charAt(0)}
                                </span>
                                {isUserSpeaking && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
                                )}
                              </div>
                              <span className="truncate">{currentUser?.display_name || getTranslation(language, 'community.you')} ({getTranslation(language, 'community.you')})</span>
                              {isMuted && <MicOff className="w-2.5 h-2.5 text-red-400 ml-auto" />}
                            </div>
                          )}

                          {otherVoiceParticipants.map(vp => (
                            <div 
                              key={vp.id} 
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setMemberMenu({
                                  x: Math.min(e.clientX, window.innerWidth - 240),
                                  y: Math.min(e.clientY, window.innerHeight - 300),
                                  member: {
                                    id: vp.id,
                                    name: vp.name,
                                    role: vp.isHost ? 'DJ / HOST' : 'MEMBER',
                                    isHost: vp.isHost,
                                    status: 'online',
                                    listening: vp.isHost ? 'After Dark - Mr.Kitty' : null,
                                    listeningTrack: vp.isHost ? DEFAULT_DJ_TRACK : null,
                                  },
                                });
                              }}
                              className={`flex items-center gap-1.5 text-[11px] p-0.5 rounded hover:bg-white/5 cursor-pointer ${isLight ? 'text-[#475569]' : 'text-[#aaa]'}`}
                            >
                              <div className="relative">
                                <span className={`w-4 h-4 rounded-full border text-[9px] font-bold flex items-center justify-center ${isLight ? 'bg-[#e2e8f0] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#161622] border-white/20 text-white'}`}>
                                  {vp.name.charAt(0)}
                                </span>
                                {vp.isSpeaking && (
                                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />
                                )}
                              </div>
                              <span className="truncate">{vp.name}</span>
                              {vp.isHost && (
                                <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 rounded">
                                  DJ
                                </span>
                              )}
                              {vp.isMuted && <MicOff className="w-2.5 h-2.5 text-red-400 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Persistent Bottom Voice Status Bar */}
        {connectedVoiceChannel && (
          <div className={`p-2.5 border-t flex flex-col gap-2 animate-in fade-in duration-200 ${isLight ? 'bg-[#f1f5f9] border-[#e2e8f0]' : 'bg-[#0c0c14] border-[#181824]'}`}>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 font-mono flex items-center gap-1">
                    {getTranslation(language, 'community.callConnected')}
                    <span className="text-[8px] text-[#666]">18ms</span>
                  </p>
                  <p className={`text-[9px] font-mono truncate max-w-[120px] ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>
                    {selectedServer.channels.find(c => c.id === connectedVoiceChannel) ? getChannelName(selectedServer.channels.find(c => c.id === connectedVoiceChannel)!) : getTranslation(language, 'community.voiceChannelFallback')}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLeaveVoiceCall}
                className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900 border border-red-500/30 text-red-300 hover:text-white transition-colors cursor-pointer"
                title={getTranslation(language, 'community.disconnect')}
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 pt-0.5">
              <button
                onClick={handleToggleMute}
                className={`flex-1 py-1 px-2 rounded-md border text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isMuted 
                    ? 'bg-red-950/40 border-red-500/40 text-red-300' 
                    : isLight 
                    ? 'bg-[#ffffff] border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                    : 'bg-[#151522] border-[#262638] text-zinc-300 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                <span>{isMuted ? getTranslation(language, 'community.unmuteMic') : getTranslation(language, 'community.muteMic')}</span>
              </button>

              <button
                onClick={handleToggleDeafen}
                className={`flex-1 py-1 px-2 rounded-md border text-[10px] font-mono flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isDeafened 
                    ? 'bg-red-950/40 border-red-500/40 text-red-300' 
                    : isLight 
                    ? 'bg-[#ffffff] border-[#cbd5e1] text-[#334155] hover:text-[#0f172a]'
                    : 'bg-[#151522] border-[#262638] text-zinc-300 hover:text-white'
                }`}
              >
                {isDeafened ? <VolumeX className="w-3 h-3 text-red-400" /> : <Headphones className="w-3 h-3 text-cyan-400" />}
                <span>{isDeafened ? getTranslation(language, 'community.unmuteSpeaker') : getTranslation(language, 'community.muteSpeaker')}</span>
              </button>

              <button
                onClick={() => setIsAudioSettingsOpen(true)}
                title={getTranslation(language, 'community.audioSettingsTitle')}
                className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                  isLight 
                    ? 'bg-[#ffffff] hover:bg-[#edf2f7] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]' 
                    : 'bg-[#151522] hover:bg-[#202030] border-[#262638] text-[#888899] hover:text-[#00E5FF]'
                }`}
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* ──────────────── 3. MAIN CONTENT (CHAT / VOICE / STAGE OR FRIENDS HUB) ──────────────── */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${isLight ? 'bg-[#ffffff]' : 'bg-[#0a0a0f]'}`}>
        {isFriendsTabActive ? (
          <>
            {/* Friends Hub Header */}
            <div className={`h-12 px-5 border-b flex items-center justify-between flex-shrink-0 ${isLight ? 'bg-white/80 backdrop-blur border-[#e2e8f0]' : 'bg-black/50 backdrop-blur border-[#151520]'}`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Users className="w-4 h-4" style={{ color: accentColor }} />
                  <span className={isLight ? 'text-slate-900' : 'text-white'}>Bạn Bè Mật Vụ</span>
                </div>
                <div className="h-4 w-[1px] bg-zinc-700/40" />
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setFriendsTab('online')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      friendsTab === 'online'
                        ? isLight ? 'bg-slate-200 text-slate-900 font-bold' : 'bg-white/10 text-white font-bold'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    Trực tuyến
                  </button>
                  <button
                    onClick={() => setFriendsTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      friendsTab === 'all'
                        ? isLight ? 'bg-slate-200 text-slate-900 font-bold' : 'bg-white/10 text-white font-bold'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    onClick={() => setFriendsTab('pending')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      friendsTab === 'pending'
                        ? isLight ? 'bg-slate-200 text-slate-900 font-bold' : 'bg-white/10 text-white font-bold'
                        : 'text-[#888] hover:text-white'
                    }`}
                  >
                    Đang theo dõi
                  </button>
                  <button
                    onClick={() => setFriendsTab('add')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      friendsTab === 'add'
                        ? 'bg-emerald-500 text-black'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    + Thêm bạn
                  </button>
                </div>
              </div>

              {/* Quick Friend Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#666]" />
                <input
                  type="text"
                  value={friendSearchQuery}
                  onChange={e => setFriendSearchQuery(e.target.value)}
                  placeholder="Tìm bạn bè..."
                  className={`pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-colors ${
                    isLight 
                      ? 'bg-slate-100 text-slate-900 border-slate-200 placeholder-slate-400 focus:border-slate-400' 
                      : 'bg-[#12121a] text-white border-[#222230] placeholder-[#666] focus:border-white/40'
                  }`}
                />
              </div>
            </div>

            {/* Friends Hub Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {friendsTab === 'add' ? (
                <div className="max-w-xl mx-auto space-y-6 pt-4">
                  <div>
                    <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      THÊM BẠN BÈ MẬT VỤ
                    </h3>
                    <p className="text-xs text-[#888] mt-1">
                      Nhập tên người dùng hoặc handle (ví dụ: <code className="text-cyan-400 font-mono">@cyberhawk</code>). Quy tắc kết bạn: <b>Nếu bạn follow người kia và người kia follow lại thì là bạn bè</b>!
                    </p>
                  </div>

                  <form onSubmit={handleAddFriend} className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-3 text-[#666] font-mono text-sm">@</span>
                      <input
                        type="text"
                        value={addFriendInput}
                        onChange={e => setAddFriendInput(e.target.value)}
                        placeholder="Nhập tên người dùng hoặc @handle..."
                        className={`w-full pl-8 pr-4 py-2.5 rounded-xl text-xs font-sans border outline-none ${
                          isLight 
                            ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-slate-500' 
                            : 'bg-[#12121a] border-[#242436] text-white focus:border-cyan-400'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!addFriendInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-lg"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Kết bạn</span>
                    </button>
                  </form>

                  {addFriendMessage && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>{addFriendMessage}</span>
                    </div>
                  )}

                  {addFriendError && (
                    <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{addFriendError}</span>
                    </div>
                  )}

                  {/* Suggested Operatives */}
                  <div className="pt-4 border-t border-[#1a1a24]">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777] block mb-3">
                      GỢI Ý KẾT BẠN TRONG CỘNG ĐỒNG SPYTIFY
                    </span>
                    <div className="space-y-2">
                      {registeredUsers.map(u => {
                        const isFriend = isMutualFriend(u);
                        const isFollowing = followingUserIds.has(u.id);
                        return (
                          <div 
                            key={u.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0e0e16] border-[#1e1e2c]'
                            }`}
                          >
                            <div className="flex items-center gap-3 truncate">
                              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-sm text-white">
                                {u.display_name.charAt(0)}
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{u.display_name}</span>
                                  <span className="text-[10px] text-cyan-400 font-mono">@{u.username}</span>
                                  {isFriend && (
                                    <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                                      BẠN BÈ
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#888] font-mono truncate mt-0.5">{u.bio}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => setSelectedProfileUser(u)}
                                className="px-3 py-1.5 rounded-lg border border-[#2a2a3a] text-xs font-mono text-[#aaa] hover:text-white hover:bg-white/5 cursor-pointer"
                              >
                                Hồ sơ
                              </button>
                              <button
                                onClick={() => handleToggleFollow(u.id)}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                                  isFollowing
                                    ? 'bg-zinc-800 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-500/40'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md'
                                }`}
                              >
                                {isFollowing ? (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>{isFriend ? 'Bạn bè' : 'Đang theo dõi'}</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Kết bạn</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                // Online, All, or Pending lists
                <div className="space-y-2 max-w-4xl">
                  <div className="pb-2 flex items-center justify-between text-xs text-[#777] font-mono">
                    <span>
                      {friendsTab === 'online' 
                        ? `BẠN BÈ TRỰC TUYẾN — ${registeredUsers.filter(u => isMutualFriend(u) && u.status === 'online').length}`
                        : friendsTab === 'all'
                        ? `TẤT CẢ BẠN BÈ — ${registeredUsers.filter(u => isMutualFriend(u)).length}`
                        : `DANH SÁCH ĐANG THEO DÕI — ${followingUserIds.size}`}
                    </span>
                  </div>

                  {registeredUsers
                    .filter(u => {
                      if (friendSearchQuery) {
                        const q = friendSearchQuery.toLowerCase();
                        if (!u.display_name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q)) return false;
                      }
                      if (friendsTab === 'online') return isMutualFriend(u) && u.status === 'online';
                      if (friendsTab === 'all') return isMutualFriend(u);
                      if (friendsTab === 'pending') return followingUserIds.has(u.id);
                      return true;
                    })
                    .map(fr => {
                      const isFriend = isMutualFriend(fr);
                      return (
                        <div
                          key={fr.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                            isLight 
                              ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm' 
                              : 'bg-[#0d0d14] hover:bg-[#12121e] border-[#1e1e2c]'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 truncate">
                            <div className="relative flex-shrink-0 cursor-pointer" onClick={() => setSelectedProfileUser(fr)}>
                              <div className="w-11 h-11 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-base text-white shadow-md">
                                {fr.display_name.charAt(0)}
                              </div>
                              <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black ${
                                fr.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                              }`} />
                            </div>

                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span 
                                  onClick={() => setSelectedProfileUser(fr)}
                                  className={`text-sm font-bold truncate cursor-pointer hover:underline ${isLight ? 'text-slate-900' : 'text-white'}`}
                                >
                                  {fr.display_name}
                                </span>
                                <span className="text-xs text-[#777] font-mono">@{fr.username}</span>
                                {isFriend ? (
                                  <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    BẠN BÈ MẬT VỤ
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-mono text-cyan-400 bg-cyan-400/10 px-1.5 py-0.2 rounded">
                                    Đang theo dõi
                                  </span>
                                )}
                              </div>

                              {fr.listening ? (
                                <p className="text-xs text-cyan-400 font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                  <Activity className="w-3 h-3 animate-pulse text-cyan-400 flex-shrink-0" />
                                  <span className="truncate">Đang nghe: <b>{fr.listening}</b></span>
                                </p>
                              ) : (
                                <p className="text-[11px] text-[#777] font-mono truncate mt-0.5">{fr.bio}</p>
                              )}
                            </div>
                          </div>

                          {/* Friend Action Buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {fr.listening && (
                              <button
                                onClick={() => handlePlayMemberTrack(fr)}
                                className="px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105 active:scale-95 transition-all"
                                title={`Nghe bài này cùng ${fr.display_name}`}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Nghe cùng</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleInviteMemberToVoice({ id: fr.id, name: fr.display_name, isHost: fr.isHost })}
                              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-[#181824] hover:bg-[#222234] border-[#2c2c3e] text-zinc-300 hover:text-white'
                              }`}
                              title="Mời vào phòng thoại"
                            >
                              <PhoneCall className="w-4 h-4 text-emerald-400" />
                            </button>

                            <button
                              onClick={() => setSelectedProfileUser(fr)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#181824] hover:bg-[#222234] border-[#2c2c3e] text-zinc-300 hover:text-white'
                              }`}
                            >
                              Xem hồ sơ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Channel Header Bar */}
            <div className={`h-12 px-4 border-b flex items-center justify-between flex-shrink-0 ${isLight ? 'bg-[#ffffff]/80 backdrop-blur border-[#e2e8f0]' : 'bg-black/50 backdrop-blur border-[#151520]'}`}>
          <div className="flex items-center gap-2 truncate">
            {isVoice ? (
              <Mic className="w-4 h-4 text-emerald-400" />
            ) : isStage ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <Hash className="w-4 h-4 text-[#777]" />
            )}
            <h3 className={`text-xs font-bold tracking-wide truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{getChannelName(selectedChannel)}</h3>
            {selectedChannel.topic && (
              <>
                <span className={isLight ? 'text-[#cbd5e1]' : 'text-[#333]'}>|</span>
                <p className={`text-[11px] font-mono truncate hidden sm:block ${isLight ? 'text-[#64748b]' : 'text-[#777]'}`}>{getChannelTopic(selectedChannel)}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#777]">
            {/* Discord-style Member List Toggle Button (Single User Icon) */}
            <button
              onClick={toggleMemberList}
              title={getTranslation(language, 'community.toggleMemberList')}
              style={isMemberListVisible ? {
                backgroundColor: `${accentColor}25`,
                borderColor: `${accentColor}60`,
                color: accentColor,
                boxShadow: `0 0 10px ${accentColor}30`,
              } : undefined}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                isMemberListVisible
                  ? ''
                  : isLight
                  ? 'bg-[#ffffff] hover:bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]'
                  : 'bg-[#12121c] hover:bg-[#1a1a2a] border-[#222234] text-[#888899] hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ──────── 3A. DISCORD VOICE CALL ROOM VIEW ──────── */}
        {isVoice ? (
          <div className={`flex-1 flex flex-col p-6 items-center justify-between overflow-y-auto ${
            isLight ? 'bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9]' : 'bg-gradient-to-b from-[#08080f] to-[#040407]'
          }`}>
            {/* Participants Grid */}
            <div className="w-full max-w-4xl flex flex-col items-center pt-2 pb-6">
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Current User Card */}
                {isConnectedToCurrentVoice && (
                  <div 
                    className={`rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center relative aspect-[4/3] shadow-xl overflow-hidden group ${
                      isLight ? 'bg-[#ffffff] border-[#cbd5e1]' : 'bg-[#1e1f22] border-[#2b2d31]'
                    }`}
                    style={isUserSpeaking ? {
                      borderColor: accentColor,
                      boxShadow: `0 0 24px ${accentColor}50`
                    } : undefined}
                  >
                    <div className="relative">
                      <div 
                        className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          isLight ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#0f172a]' : 'border-white/20 bg-[#2b2d31] text-white'
                        }`}
                        style={isUserSpeaking ? {
                          borderColor: accentColor,
                          boxShadow: `0 0 20px ${accentColor}70`,
                        } : undefined}
                      >
                        {currentUser?.avatar ? (
                          <img src={currentUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span>{(currentUser?.display_name || 'B').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {isMuted && (
                        <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-red-600 border-2 border-black text-white shadow-md">
                          <MicOff className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Discord Bottom-left Tag */}
                    <div className={`absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md border max-w-[85%] truncate ${
                      isLight ? 'bg-[#ffffff]/95 border-[#cbd5e1]' : 'bg-black/85 border-white/10'
                    }`}>
                      <span className={`text-xs font-bold tracking-wide truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                        {currentUser?.display_name || getTranslation(language, 'community.you')}
                      </span>
                      <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-zinc-400'}`}>({getTranslation(language, 'community.you')})</span>
                      {isUserSpeaking && (
                        <span className="w-2 h-2 rounded-full animate-ping ml-1" style={{ backgroundColor: accentColor }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Other Invited / Real Participants */}
                {voiceParticipants
                  .filter(vp => vp.id !== myParticipantIdRef.current)
                  .map(vp => (
                    <div 
                      key={vp.id}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMemberMenu({
                          x: Math.min(e.clientX, window.innerWidth - 240),
                          y: Math.min(e.clientY, window.innerHeight - 300),
                          member: {
                            id: vp.id,
                            name: vp.name,
                            role: vp.isHost ? 'DJ / HOST' : 'MEMBER',
                            isHost: vp.isHost,
                            status: 'online',
                            listening: vp.isHost ? 'After Dark - Mr.Kitty' : null,
                            listeningTrack: vp.isHost ? DEFAULT_DJ_TRACK : null,
                          },
                        });
                      }}
                      className={`rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center relative aspect-[4/3] shadow-xl overflow-hidden group cursor-pointer ${
                        isLight ? 'bg-[#ffffff] border-[#cbd5e1]' : 'bg-[#1e1f22] border-[#2b2d31]'
                      }`}
                      style={vp.isSpeaking ? {
                        borderColor: accentColor,
                        boxShadow: `0 0 24px ${accentColor}50`
                      } : undefined}
                    >
                      {/* Discord Music Bot Stream Banner */}
                      {vp.isHost && (
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayMemberTrack({ listeningTrack: DEFAULT_DJ_TRACK });
                            }}
                            title="Bấm để nghe cùng bot phát nhạc!"
                            className="px-2 py-1 rounded-lg bg-black/80 border text-[10px] font-mono font-bold flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
                            style={{ borderColor: `${accentColor}50`, color: accentColor }}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="truncate max-w-[130px] text-white">After Dark</span>
                          </button>
                          <span className="text-[9px] font-mono text-zinc-300 bg-black/75 px-1.5 py-0.5 rounded border border-white/10">
                            {userVolumes[vp.id] ?? 100}% Vol
                          </span>
                        </div>
                      )}

                      <div className="relative">
                        <div 
                          className={`w-20 h-20 rounded-full overflow-hidden border-2 flex items-center justify-center text-xl font-bold transition-all ${
                            isLight ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#0f172a]' : 'border-white/20 bg-[#2b2d31] text-white'
                          }`}
                          style={vp.isSpeaking ? {
                            borderColor: accentColor,
                            boxShadow: `0 0 20px ${accentColor}70`,
                          } : undefined}
                        >
                          {vp.name.charAt(0).toUpperCase()}
                        </div>
                        {vp.isMuted && (
                          <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-red-600 border-2 border-black text-white shadow-md">
                            <MicOff className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>

                      {/* Discord Bottom-left Tag */}
                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/85 border border-white/10 max-w-[85%] truncate">
                        <span className="text-xs font-bold text-white tracking-wide truncate">{vp.name}</span>
                        {vp.isHost ? (
                          <span 
                            className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1"
                            style={{ color: accentColor, backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }}
                          >
                            <Radio className="w-2.5 h-2.5 animate-pulse" />
                            BOT
                          </span>
                        ) : (
                          <span className="text-[8px] font-mono text-zinc-400">
                            {userVolumes[vp.id] ?? 100}%
                          </span>
                        )}
                        {vp.isSpeaking && (
                          <span className="w-2 h-2 rounded-full animate-ping ml-1" style={{ backgroundColor: accentColor }} />
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Helpful DJ Invite Hint */}
              {voiceParticipants.filter(p => p.id !== myParticipantIdRef.current).length === 0 && (
                <p className="text-[11px] text-[#777] font-mono mt-4 text-center">
                  {getTranslation(language, 'community.djInviteHint')}
                </p>
              )}
            </div>

            {/* In-Call Controls Bottom Dock — Discord Signature Floating Dock */}
            <div className="my-2 z-10">
              {!isConnectedToCurrentVoice ? (
                <div className="p-3 px-6 rounded-2xl bg-[#111214]/90 border border-[#26282c] shadow-2xl flex flex-col items-center gap-2">
                  <button
                    onClick={() => handleJoinVoiceCall()}
                    className="py-2.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:scale-[1.02]"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>{getTranslation(language, 'community.reconnect')}</span>
                  </button>

                  <button
                    onClick={() => setIsAudioSettingsOpen(true)}
                    className="text-[11px] font-mono text-[#888] hover:text-[#00E5FF] flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{getTranslation(language, 'community.callAudioSettings')}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2 px-4 rounded-full bg-[#111214]/90 border border-[#26282c] shadow-[0_12px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl flex items-center gap-3">
                  {/* Mic Toggle Button */}
                  <button
                    onClick={handleToggleMute}
                    title={isMuted ? getTranslation(language, 'community.unmuteMic') : getTranslation(language, 'community.muteMic')}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      isMuted 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white hover:text-emerald-400'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
                  </button>

                  {/* Deafen Toggle Button */}
                  <button
                    onClick={handleToggleDeafen}
                    title={isDeafened ? getTranslation(language, 'community.unmuteSpeaker') : getTranslation(language, 'community.muteSpeaker')}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                      isDeafened 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-[#2b2d31] hover:bg-[#35373c] text-white hover:text-cyan-400'
                    }`}
                  >
                    {isDeafened ? <VolumeX className="w-5 h-5" /> : <Headphones className="w-5 h-5 text-cyan-400" />}
                  </button>

                  {/* Audio Settings Button */}
                  <button
                    onClick={() => setIsAudioSettingsOpen(true)}
                    className="w-11 h-11 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-zinc-300 hover:text-[#00E5FF] transition-all cursor-pointer flex items-center justify-center shadow-md"
                    title={getTranslation(language, 'community.voiceSettings')}
                  >
                    <Sliders className="w-5 h-5 text-emerald-400" />
                  </button>

                  {/* Disconnect Red Button */}
                  <button
                    onClick={handleLeaveVoiceCall}
                    className="px-5 h-11 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                    title={getTranslation(language, 'community.leaveRoom')}
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{getTranslation(language, 'community.leaveRoom')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ──────── 3B. TEXT CHAT OR STAGE CHANNEL ──────── */
          <>
            {/* Live Stage DJ Booth Banner */}
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
            <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar ${isLight ? 'bg-[#ffffff]' : 'bg-[#0a0a0f]'}`}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-start gap-3 -mx-2 px-2 py-1 rounded-lg transition-colors ${
                  isLight ? 'hover:bg-[#f1f5f9]' : 'hover:bg-[#101016]/40'
                }`}>
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

                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold hover:underline cursor-pointer ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                        {msg.display_name}
                      </span>
                      <span className={`text-[10px] font-mono ${isLight ? 'text-[#64748b]' : 'text-[#555]'}`}>@{msg.username}</span>
                      <span className={`text-[10px] font-mono ${isLight ? 'text-[#94a3b8]' : 'text-[#444]'}`}>{msg.created_at}</span>
                    </div>

                    {msg.content && (
                      <p className={`text-xs leading-relaxed break-words font-sans ${isLight ? 'text-[#334155]' : 'text-[#ddd]'}`}>
                        {msg.content}
                      </p>
                    )}

                    {/* Embedded Track Card */}
                    {msg.track_embed && (
                      <div className={`mt-2 max-w-sm p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 shadow-md ${
                        isLight ? 'bg-[#ffffff] border-[#cbd5e1] hover:border-[#94a3b8]' : 'bg-[#12121c] border-[#222234] hover:border-white/30'
                      }`}>
                        <div className="flex items-center gap-2.5 truncate">
                          <div className={`w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 ${
                            isLight ? 'bg-[#f1f5f9]' : 'bg-[#1a1a26]'
                          }`}>
                            {msg.track_embed.cover_art ? (
                              <img src={msg.track_embed.cover_art} alt="cover" className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-4 h-4 text-[#888]" />
                            )}
                          </div>
                          <div className="truncate">
                            <p className={`text-xs font-bold truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{msg.track_embed.title}</p>
                            <p className={`text-[10px] font-mono truncate ${isLight ? 'text-[#64748b]' : 'text-[#888]'}`}>{msg.track_embed.artist}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => onPlayTrack(msg.track_embed!)}
                          className={`p-2 rounded-lg transition-all cursor-pointer flex-shrink-0 ${
                            isLight ? 'bg-[#f1f5f9] hover:bg-[#0f172a] text-[#0f172a] hover:text-white' : 'bg-white/10 hover:bg-white text-white hover:text-black'
                          }`}
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
            <div className={`p-3 border-t flex-shrink-0 ${isLight ? 'bg-[#ffffff] border-[#e2e8f0]' : 'bg-[#07070a] border-[#151520]'}`}>
              {attachCurrentTrack && currentTrack && (
                <div className={`mb-2 p-1.5 px-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
                  isLight ? 'bg-[#f8fafc] border-[#cbd5e1] text-[#334155]' : 'bg-[#12121a] border-[#242434] text-[#aaa]'
                }`}>
                  <span className="flex items-center gap-2 truncate text-cyan-400">
                    <Music className="w-3.5 h-3.5" />
                    {getTranslation(language, 'community.attachTrack')} <b className={`truncate ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{currentTrack.title} - {currentTrack.artist}</b>
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
                {currentTrack && (
                  <button
                    type="button"
                    onClick={() => setAttachCurrentTrack(p => !p)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer flex-shrink-0 ${
                      attachCurrentTrack 
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                        : isLight 
                        ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a]' 
                        : 'bg-[#101016] border-[#222230] text-[#777] hover:text-white'
                    }`}
                    title={getTranslation(language, 'community.attachTrackTooltip')}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}

                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={getTranslation(language, 'community.sendMessageTo', { channel: selectedChannel.name })}
                  className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs border outline-none transition-colors font-sans ${
                    isLight 
                      ? 'bg-[#f8fafc] text-[#0f172a] border-[#cbd5e1] placeholder-[#94a3b8] focus:border-[#64748b]' 
                      : 'bg-[#101018] text-white border-[#222232] placeholder-[#666] focus:border-white/50'
                  }`}
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
          </>
        )}
          </>
        )}
      </div>

      {/* ──────────────── 4. ONLINE MEMBERS LIST (RIGHT RAIL) ──────────────── */}
      <div 
        className={`border-l flex flex-col overflow-y-auto no-scrollbar text-xs select-none transition-all duration-300 ease-in-out ${
          isLight ? 'bg-[#f8fafc] border-[#e2e8f0]' : 'bg-[#07070b] border-[#15151e]'
        } ${
          isMemberListVisible 
            ? 'w-52 p-3 opacity-100 flex-shrink-0' 
            : 'w-0 p-0 border-l-0 opacity-0 overflow-hidden pointer-events-none'
        }`}
      >
        <div className={`flex items-center justify-between mb-2.5 pb-1 border-b ${isLight ? 'border-[#e2e8f0]' : 'border-[#14141e]'}`}>
          <p className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isLight ? 'text-[#64748b]' : 'text-[#666]'}`}>
            {getTranslation(language, 'community.online')} — {onlineMembers.length}
          </p>
          <button
            onClick={toggleMemberList}
            title={getTranslation(language, 'community.toggleMemberList')}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isLight ? 'hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]' : 'hover:bg-[#161622] text-[#666] hover:text-white'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          {onlineMembers.map(mem => (
            <div 
              key={mem.id} 
              onContextMenu={(e) => {
                e.preventDefault();
                setMemberMenu({
                  x: Math.min(e.clientX, window.innerWidth - 220),
                  y: Math.min(e.clientY, window.innerHeight - 200),
                  member: mem,
                });
              }}
              className={`flex items-center gap-2 p-1.5 rounded-lg transition-colors cursor-pointer group ${
                isLight ? 'hover:bg-[#e2e8f0]' : 'hover:bg-[#12121c]'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div 
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-[10px] ${
                    isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#14141e] border-white/10 text-white'
                  }`}
                >
                  {mem.name.charAt(0).toUpperCase()}
                </div>
                <span 
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black" 
                  style={{ backgroundColor: accentColor }}
                />
              </div>
              <div className="truncate flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-semibold truncate ${isLight ? 'text-[#0f172a]' : 'text-zinc-300'}`}>{mem.name}</span>
                  {mem.isHost && (
                    <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1 py-0.2 rounded flex-shrink-0">
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

              {/* 3-dots Menu Button */}
              {mem.id !== 'usr_me' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMemberMenu({
                      x: Math.min(rect.left - 180, window.innerWidth - 220),
                      y: Math.min(rect.bottom + 4, window.innerHeight - 200),
                      member: mem,
                    });
                  }}
                  title={getTranslation(language, 'community.inviteToVoice')}
                  className="p-1 rounded hover:bg-white/10 text-[#666] hover:text-white opacity-0 group-hover:opacity-100 transition-opacity ml-auto cursor-pointer flex-shrink-0"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ──────────────── MEMBER CONTEXT MENU (CHUỘT PHẢI ĐỂ MỜI DJ VÀO CHAT) ──────────────── */}
      {memberMenu && (
        <div 
          className={`fixed z-50 w-56 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in duration-150 border ${
            isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#0e0e18] border-[#26263a] text-white'
          }`}
          style={{ top: memberMenu.y, left: memberMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-3 py-1.5 border-b flex items-center gap-2 ${isLight ? 'border-[#e2e8f0]' : 'border-[#1c1c28]'}`}>
            <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[10px] ${
              isLight ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#181826] border-white/20 text-white'
            }`}>
              {memberMenu.member.name.charAt(0)}
            </div>
            <div className="truncate flex-1">
              <p className={`font-bold truncate text-[11px] ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>{memberMenu.member.name}</p>
              <p className="text-[9px] font-mono" style={{ color: accentColor }}>{memberMenu.member.role}</p>
            </div>
          </div>

          <div className="p-1 space-y-0.5">
            {/* Play listening track */}
            {memberMenu.member.listening && (
              <button
                onClick={() => {
                  handlePlayMemberTrack(memberMenu.member);
                  setMemberMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg text-cyan-300 font-medium flex items-center gap-2 text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                }}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="truncate">Nghe cùng ({memberMenu.member.listening})</span>
              </button>
            )}

            {/* Profile */}
            <button
              onClick={() => {
                const u = registeredUsers.find(x => x.id === memberMenu.member.id) || {
                  id: memberMenu.member.id,
                  username: memberMenu.member.name.toLowerCase().replace(/\s+/g, ''),
                  display_name: memberMenu.member.name,
                  avatar: null,
                  role: memberMenu.member.role,
                  status: 'online' as const,
                  bio: `Thành viên tại ${selectedServer.name}`,
                  listening: memberMenu.member.listening,
                  isHost: memberMenu.member.isHost,
                  followsCurrentUser: false,
                };
                setSelectedProfileUser(u);
                setMemberMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                isLight ? 'hover:bg-[#f1f5f9] text-[#334155]' : 'hover:bg-[#161624] text-zinc-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#888]" />
              <span>Xem hồ sơ mật vụ</span>
            </button>

            {/* User / Bot Volume Slider (Discord Style: 0% - 200%) */}
            {voiceParticipants.some(p => p.id === memberMenu.member.id) && (
              <div className="px-2.5 py-2 border-y border-[#1e1e2c] my-1 bg-black/40 rounded-lg">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#aaa] mb-1.5">
                  <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
                    <Volume2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                    {memberMenu.member.isHost ? 'Âm lượng bot phát nhạc' : 'Âm lượng mic người dùng'}
                  </span>
                  <span className="font-bold text-white font-mono">{userVolumes[memberMenu.member.id] ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  value={userVolumes[memberMenu.member.id] ?? 100}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setUserVolumes(prev => {
                      const next = { ...prev, [memberMenu.member.id]: val };
                      localStorage.setItem('spytify_user_volumes', JSON.stringify(next));
                      return next;
                    });
                  }}
                  className="w-full h-1 bg-[#262638] rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor }}
                />
              </div>
            )}

            {/* Voice kick or invite */}
            {voiceParticipants.some(p => p.id === memberMenu.member.id) ? (
              <button
                onClick={() => {
                  handleRemoveMemberFromVoice(memberMenu.member.id);
                  setMemberMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 flex items-center gap-2 text-left cursor-pointer transition-colors"
              >
                <PhoneOff className="w-3.5 h-3.5 text-red-400" />
                <span>{getTranslation(language, 'community.removeFromVoice') || 'Mời rời khỏi voice'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  handleInviteMemberToVoice(memberMenu.member);
                  setMemberMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors"
                style={{
                  color: accentColor,
                  backgroundColor: `${accentColor}18`,
                }}
              >
                <PhoneCall className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span>{memberMenu.member.isHost ? getTranslation(language, 'community.callDj') : getTranslation(language, 'community.inviteToVoice')}</span>
              </button>
            )}

            <button
              onClick={() => {
                setInputText(prev => `${prev}@${memberMenu.member.name} `);
                setMemberMenu(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left cursor-pointer transition-colors ${
                isLight ? 'hover:bg-[#f1f5f9] text-[#334155] hover:text-[#0f172a]' : 'hover:bg-[#161624] text-zinc-300 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#888]" />
              <span>{getTranslation(language, 'community.mentionInChat')}</span>
            </button>

            {(selectedServer.owner_id === currentUser?.id || selectedServer.is_custom) && memberMenu.member.id !== 'usr_me' && (
              <button
                onClick={() => {
                  handleKickMember(memberMenu.member.id);
                  setMemberMenu(null);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-red-500/20 mt-1 pt-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Kick khỏi server</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── 5. MODAL TỰ TẠO TRẠM SÓNG / SERVER MỚI ──────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0c0c14] border border-[#222234] rounded-2xl p-6 shadow-2xl relative text-white">
            {/* Close */}
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-[#181824] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base"
                style={{ backgroundColor: `${newServerColor}25`, color: newServerColor, border: `1px solid ${newServerColor}40` }}
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white">Tạo Trạm Sóng Mới (Create Server)</h3>
                <p className="text-[11px] text-[#777] font-mono">Tự thiết lập không gian âm nhạc, phòng chat & kênh thoại</p>
              </div>
            </div>

            {/* Step 1: Chọn phong cách mẫu (Preset Templates) */}
            <div className="mb-4">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-2">
                1. Chọn phong cách trạm sóng mẫu:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SERVER_PRESETS.map(p => {
                  const isSel = newServerPreset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleSelectPreset(p.key)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSel 
                          ? 'bg-[#151524] shadow-md' 
                          : 'bg-[#0e0e16] hover:bg-[#13131e] border-[#1e1e2c]'
                      }`}
                      style={{
                        borderColor: isSel ? p.color : undefined,
                        boxShadow: isSel ? `0 0 12px ${p.color}30` : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xl">{p.icon}</span>
                        {isSel && (
                          <span className="p-0.5 rounded-full bg-white text-black">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white">{p.label}</p>
                      <p className="text-[10px] text-[#777] font-mono line-clamp-1 mt-0.5">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Form tùy biến thông tin */}
            <form onSubmit={handleCreateServer} className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                  2. Tên máy chủ / Trạm sóng:
                </label>
                <input
                  type="text"
                  required
                  value={newServerName}
                  onChange={e => setNewServerName(e.target.value)}
                  placeholder="Ví dụ: Neon Club 2077, Lofi Study Corner..."
                  className="w-full px-3 py-2 rounded-xl bg-[#12121c] border border-[#252538] text-white text-xs outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                  Mô tả trạm sóng:
                </label>
                <input
                  type="text"
                  value={newServerDesc}
                  onChange={e => setNewServerDesc(e.target.value)}
                  placeholder="Mô tả ngắn về thể loại âm nhạc hoặc đối tượng tham gia..."
                  className="w-full px-3 py-2 rounded-xl bg-[#12121c] border border-[#252538] text-white text-xs outline-none focus:border-white transition-colors"
                />
              </div>

              {/* Icon Emoji & Color Picker */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                    Biểu tượng Icon:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['⚡', '☕', '🍸', '🎧', '🪩', '🚀', '💎', '🐉'].map(ico => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setNewServerIcon(ico)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center cursor-pointer transition-transform ${
                          newServerIcon === ico ? 'scale-110 bg-white/20 border border-white' : 'hover:scale-105 bg-[#141420]'
                        }`}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1">
                    Màu Neon chủ đạo:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['#00E5FF', '#E040FB', '#00FF66', '#FF2A55', '#FFE600'].map(clr => (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => setNewServerColor(clr)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          newServerColor === clr ? 'scale-125 border-2 border-white' : 'hover:scale-110 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: clr, boxShadow: `0 0 8px ${clr}50` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#1e1e2c]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141420] hover:bg-[#1a1a2a] text-xs font-semibold text-[#888] hover:text-white transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: newServerColor,
                    boxShadow: `0 0 16px ${newServerColor}40`,
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tạo Trạm Sóng Ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── 6. MODAL CÀI ĐẶT ÂM LƯỢNG MIC & LOA (VOICE AUDIO SETTINGS) ──────────────── */}
      {isAudioSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg border rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto ${
            isLight ? 'bg-[#ffffff] border-[#cbd5e1] text-[#0f172a]' : 'bg-[#0c0c14] border-[#222234] text-white'
          }`}>
            {/* Close Button */}
            <button
              onClick={() => {
                stopMicTest();
                setIsAudioSettingsOpen(false);
              }}
              className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                isLight ? 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]' : 'text-[#666] hover:text-white hover:bg-[#181824]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base border"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-base font-black tracking-tight flex items-center gap-2 ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
                  <span>{getTranslation(language, 'community.audioSettingsTitle')}</span>
                  <span 
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold"
                    style={{
                      backgroundColor: `${accentColor}18`,
                      color: accentColor,
                      borderColor: `${accentColor}40`,
                    }}
                  >
                    VOICE LAB
                  </span>
                </h3>
                <p className={`text-[11px] font-mono ${isLight ? 'text-[#64748b]' : 'text-[#888899]'}`}>{getTranslation(language, 'community.audioSettingsSubtitle')}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* ──────── SECTION 1: MICROPHONE (ĐẦU VÀO) ──────── */}
              <div className={`p-4 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#13131e] border-[#222234]'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" style={{ color: accentColor }} />
                    <span className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {getTranslation(language, 'community.micVolume')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                    >
                      {micVolume}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleMicVolumeChange(100)}
                      title="100%"
                      className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 border ${
                        isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#1a1a26] hover:bg-[#242436] border-[#2a2a3e] text-[#aaa]'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>100%</span>
                    </button>
                  </div>
                </div>

                {/* Mic Volume Slider */}
                <div className="relative mb-3">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="1"
                    value={micVolume}
                    onChange={(e) => handleMicVolumeChange(parseInt(e.target.value, 10))}
                    style={{ accentColor }}
                    className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#777] mt-1.5 font-semibold">
                    <span>0%</span>
                    <span className="text-zinc-400">100%</span>
                    <span>200%</span>
                  </div>
                </div>

                {/* Live Mic Test Meter */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 font-bold">
                      <Activity className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      {getTranslation(language, 'community.testMic')}
                    </span>
                    <button
                      type="button"
                      onClick={isTestingMic ? stopMicTest : startMicTest}
                      style={!isTestingMic ? {
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}45`,
                        color: accentColor,
                      } : undefined}
                      className={`px-3 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                        isTestingMic
                          ? 'bg-red-950/60 border-red-500/50 text-red-300 hover:bg-red-900 animate-pulse'
                          : 'hover:opacity-90 shadow-sm'
                      }`}
                    >
                      {isTestingMic ? getTranslation(language, 'community.stopTestMic') : getTranslation(language, 'community.startTestMic')}
                    </button>
                  </div>

                  {/* VU Level Bar */}
                  <div className="h-3.5 bg-black/60 border border-slate-300 dark:border-[#2a2a3e] rounded-full overflow-hidden p-0.5 relative">
                    <div 
                      className={`h-full rounded-full transition-all duration-75 ${
                        testMicLevel > 80 ? 'bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500' : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      }`}
                      style={{ width: `${testMicLevel}%` }}
                    />
                    {/* Sensitivity Marker needle */}
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_white]"
                      style={{ left: `${(micSensitivity / 50) * 100}%` }}
                      title={`Sensitivity: ${micSensitivity}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono mt-1.5 text-[#777]">
                    <span>
                      {isTestingMic ? (
                        testMicLevel > micSensitivity ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            {getTranslation(language, 'community.voiceActive', { level: testMicLevel })}
                          </span>
                        ) : (
                          <span className="text-zinc-400">{getTranslation(language, 'community.voiceBelowGate', { level: testMicLevel })}</span>
                        )
                      ) : (
                        getTranslation(language, 'community.voiceTestPrompt')
                      )}
                    </span>
                    <span className="font-bold text-zinc-400">{getTranslation(language, 'community.activationThreshold', { level: micSensitivity })}</span>
                  </div>
                </div>

                {/* Voice Sensitivity Slider */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] mt-3">
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="text-[11px] font-mono text-zinc-400">{getTranslation(language, 'community.noiseGate')}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>{micSensitivity}</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={micSensitivity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setMicSensitivity(val);
                      localStorage.setItem('spytify_mic_sensitivity', String(val));
                    }}
                    style={{ accentColor }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                  />
                  <p className="text-[10px] text-[#666] font-mono mt-1">
                    {getTranslation(language, 'community.noiseGateHint')}
                  </p>
                </div>

                {/* Audio Filters (Noise Suppression & Echo Cancellation) */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] mt-3 grid grid-cols-2 gap-2 text-xs">
                  <label 
                    style={noiseSuppression ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}10` } : undefined}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isLight ? 'bg-white border-slate-200' : 'bg-[#181826] border-[#252538]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={noiseSuppression}
                      onChange={(e) => {
                        setNoiseSuppression(e.target.checked);
                        localStorage.setItem('spytify_noise_suppression', String(e.target.checked));
                      }}
                      style={{ accentColor }}
                      className="rounded"
                    />
                    <span className={`text-[11px] font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                      {getTranslation(language, 'community.noiseSuppression')}
                    </span>
                  </label>
                  <label 
                    style={echoCancellation ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}10` } : undefined}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isLight ? 'bg-white border-slate-200' : 'bg-[#181826] border-[#252538]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={echoCancellation}
                      onChange={(e) => {
                        setEchoCancellation(e.target.checked);
                        localStorage.setItem('spytify_echo_cancellation', String(e.target.checked));
                      }}
                      style={{ accentColor }}
                      className="rounded"
                    />
                    <span className={`text-[11px] font-mono font-semibold ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                      {getTranslation(language, 'community.echoCancellation')}
                    </span>
                  </label>
                </div>
              </div>

              {/* ──────── SECTION 2: SPEAKER & OUTPUT (ĐẦU RA) ──────── */}
              <div className={`p-4 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#13131e] border-[#222234]'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" style={{ color: accentColor }} />
                    <span className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {getTranslation(language, 'community.speakerVolume')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        borderColor: `${accentColor}40`,
                        color: accentColor,
                      }}
                    >
                      {speakerVolume}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSpeakerVolumeChange(100)}
                      title="100%"
                      className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 border ${
                        isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#1a1a26] hover:bg-[#242436] border-[#2a2a3e] text-[#aaa]'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>100%</span>
                    </button>
                  </div>
                </div>

                {/* Speaker Volume Slider */}
                <div className="relative mb-3">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="1"
                    value={speakerVolume}
                    onChange={(e) => handleSpeakerVolumeChange(parseInt(e.target.value, 10))}
                    style={{ accentColor }}
                    className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-[#1f1f2e]"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#777] mt-1.5 font-semibold">
                    <span>0%</span>
                    <span className="text-zinc-400">100%</span>
                    <span>200%</span>
                  </div>
                </div>

                {/* Speaker Test Sound Button */}
                <div className="pt-3 border-t border-slate-200 dark:border-[#1e1e2c] flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#777]">Âm lượng tai nghe / loa</span>
                  <button
                    type="button"
                    onClick={() => playSpeakerTestSound()}
                    style={{
                      backgroundColor: `${accentColor}18`,
                      borderColor: `${accentColor}40`,
                      color: accentColor,
                    }}
                    className="px-3.5 py-1.5 rounded-xl border font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                  >
                    <Volume1 className="w-4 h-4" />
                    <span>{getTranslation(language, 'community.testSpeaker')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-5 border-t border-slate-200 dark:border-[#1e1e2c] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleMicVolumeChange(100);
                  handleSpeakerVolumeChange(100);
                  setMicSensitivity(14);
                  localStorage.setItem('spytify_mic_sensitivity', '14');
                }}
                className="text-xs font-mono text-[#777] hover:text-white transition-colors cursor-pointer"
              >
                {getTranslation(language, 'community.resetDefaults')}
              </button>

              <button
                type="button"
                onClick={() => {
                  stopMicTest();
                  setIsAudioSettingsOpen(false);
                }}
                style={{
                  backgroundColor: accentColor,
                  color: getContrastTextColor(accentColor),
                  boxShadow: `0 0 16px ${accentColor}40`,
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer hover:scale-[1.02]"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 7. MODAL CÀI ĐẶT SERVER (SERVER SETTINGS & MANAGEMENT) ──────────────── */}
      {isServerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl border rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0c0c14] border-[#222234] text-white'
          }`}>
            {/* Header */}
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-[#1c1c28]'}`}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{ backgroundColor: `${editServerColor}20`, color: editServerColor, border: `1px solid ${editServerColor}40` }}
                >
                  {editServerIcon || selectedServer.icon}
                </div>
                <div>
                  <h3 className={`text-base font-black tracking-tight flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <span>Cài Đặt Máy Chủ: {selectedServer.name}</span>
                    <span 
                      className="text-[9px] font-mono px-2 py-0.5 rounded-full border"
                      style={{ color: editServerColor, borderColor: `${editServerColor}40`, backgroundColor: `${editServerColor}15` }}
                    >
                      {selectedServer.owner_id === currentUser?.id || selectedServer.is_custom ? 'BẠN LÀ CHỦ SERVER' : 'QUẢN LÝ'}
                    </span>
                  </h3>
                  <p className="text-xs text-[#888] font-mono">Tùy biến theme neon, đổi tên, giới hạn thành viên & phân quyền</p>
                </div>
              </div>

              <button
                onClick={() => setIsServerSettingsOpen(false)}
                className="p-1.5 rounded-full text-[#666] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-Tabs: Overview, Members, Invites, Danger */}
            <div className={`flex items-center gap-2 px-5 py-2.5 border-b text-xs font-mono font-bold uppercase tracking-wider ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#09090f] border-[#181824]'}`}>
              {(['overview', 'members', 'invites', 'danger'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setServerSettingsTab(tab)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    serverSettingsTab === tab
                      ? isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-[#181826] text-white border border-white/20'
                      : 'text-[#777] hover:text-white'
                  }`}
                >
                  {tab === 'overview' && 'Tổng quan'}
                  {tab === 'members' && 'Thành viên'}
                  {tab === 'invites' && 'Mời bạn bè'}
                  {tab === 'danger' && 'Vùng nguy hiểm'}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {serverSettingsTab === 'overview' && (
                <form onSubmit={handleSaveServerSettings} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Tên máy chủ (Server Name):
                    </label>
                    <input
                      type="text"
                      value={editServerName}
                      onChange={e => setEditServerName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-white/50'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Mô tả máy chủ (Description):
                    </label>
                    <input
                      type="text"
                      value={editServerDesc}
                      onChange={e => setEditServerDesc(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-sans ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white focus:border-white/50'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                        Biểu tượng (Icon):
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['⚡', '🍸', '☕', '🎧', '🚀', '💎', '🛸', '🎮', '🔥', '🌸'].map(ico => (
                          <button
                            key={ico}
                            type="button"
                            onClick={() => setEditServerIcon(ico)}
                            className={`w-8 h-8 rounded-lg text-sm border flex items-center justify-center cursor-pointer transition-transform ${
                              editServerIcon === ico 
                                ? 'border-cyan-400 bg-cyan-950/40 scale-110 shadow-sm' 
                                : 'border-[#222230] hover:bg-white/5'
                            }`}
                          >
                            {ico}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                        Giới hạn số lượng thành viên:
                      </label>
                      <select
                        value={editServerMaxMembers}
                        onChange={e => setEditServerMaxMembers(Number(e.target.value))}
                        className={`w-full px-3 py-2 rounded-xl text-xs border outline-none font-sans ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#12121a] border-[#222232] text-white'
                        }`}
                      >
                        <option value={10}>10 Mật Vụ (Phòng kín)</option>
                        <option value={25}>25 Mật Vụ</option>
                        <option value={50}>50 Mật Vụ (Tiêu chuẩn)</option>
                        <option value={100}>100 Mật Vụ (Club lớn)</option>
                        <option value={500}>500 Mật Vụ (Không giới hạn)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[#888] mb-1.5">
                      Màu Theme Neon chủ đạo (Server Accent Color):
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {['#00E5FF', '#FF2A55', '#00FF66', '#E040FB', '#FFB300', '#9C27B0', '#FFFFFF'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditServerColor(c)}
                          className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer flex items-center justify-center ${
                            editServerColor === c ? 'scale-110 shadow-lg' : 'hover:scale-105 border-transparent'
                          }`}
                          style={{ backgroundColor: c, borderColor: editServerColor === c ? '#ffffff' : 'transparent' }}
                        >
                          {editServerColor === c && <Check className="w-4 h-4 text-black font-black" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#1e1e2c] flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all"
                      style={{ backgroundColor: editServerColor }}
                    >
                      <Check className="w-4 h-4" />
                      <span>Lưu Thay Đổi</span>
                    </button>
                  </div>
                </form>
              )}

              {serverSettingsTab === 'members' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#888] font-mono">
                    <span>DANH SÁCH THÀNH VIÊN ({onlineMembers.length} / {editServerMaxMembers})</span>
                    <span>Quyền hạn: {selectedServer.owner_id === currentUser?.id || selectedServer.is_custom ? 'Chủ Server' : 'Thành viên'}</span>
                  </div>

                  <div className="space-y-2">
                    {onlineMembers.map(mem => (
                      <div
                        key={mem.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#101018] border-[#1e1e2c]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-xs text-white">
                            {mem.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{mem.name}</span>
                              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded">
                                {mem.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#777] font-mono">{mem.listening ? `🎵 ${mem.listening}` : 'Sẵn sàng'}</p>
                          </div>
                        </div>

                        {mem.id !== 'usr_me' && (
                          <button
                            onClick={() => handleKickMember(mem.id)}
                            className="px-3 py-1 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Kick khỏi server</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {serverSettingsTab === 'invites' && (
                <div className="space-y-4 max-w-lg">
                  <div>
                    <h4 className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>MỜI BẠN BÈ VÀO MÁY CHỦ</h4>
                    <p className="text-xs text-[#888] font-mono">
                      Chia sẻ liên kết bên dưới để bạn bè tham gia phòng chat và nghe nhạc cùng bạn.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`spytify://station/join/${selectedServer.id}`}
                      className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono border outline-none ${
                        isLight ? 'bg-slate-100 text-slate-900 border-slate-300' : 'bg-[#101018] text-cyan-300 border-[#242436]'
                      }`}
                    />
                    <button
                      onClick={() => handleCopyInvite(selectedServer.id)}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                    >
                      {inviteCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{inviteCopied ? 'Đã sao chép!' : 'Sao chép link'}</span>
                    </button>
                  </div>
                </div>
              )}

              {serverSettingsTab === 'danger' && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                    <ShieldAlert className="w-4 h-4" />
                    <span>XÓA MÁY CHỦ VĨNH VIỄN</span>
                  </div>
                  <p className="text-xs text-[#aaa]">
                    Hành động này sẽ xóa vĩnh viễn trạm sóng âm nhạc này và toàn bộ lịch sử tin nhắn. Không thể hoàn tác sau khi xác nhận.
                  </p>
                  <button
                    onClick={() => {
                      if (window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn server "${selectedServer.name}" không?`)) {
                        handleDeleteServer(selectedServer.id);
                      }
                    }}
                    disabled={!selectedServer.id.startsWith('srv_custom_') && !selectedServer.is_custom}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{selectedServer.id.startsWith('srv_custom_') || selectedServer.is_custom ? 'Xác Nhận Xóa Server' : 'Server Mặc Định (Không thể xóa)'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── 8. MODAL XEM HỒ SƠ MẬT VỤ (PROFILE MODAL) ──────────────── */}
      {selectedProfileUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md border rounded-2xl shadow-2xl relative overflow-hidden ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0e0e16] border-[#222234] text-white'
          }`}>
            {/* Banner with Accent Glow */}
            <div 
              className="h-28 w-full relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${accentColor}40, #000000 90%)`,
                borderBottom: `1px solid ${accentColor}30`,
              }}
            >
              <button
                onClick={() => setSelectedProfileUser(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar & Floating Actions */}
            <div className="px-6 relative pb-6">
              <div className="flex items-end justify-between -mt-12 mb-4">
                <div className="relative">
                  <div 
                    className="w-20 h-20 rounded-2xl bg-[#14141e] border-4 flex items-center justify-center font-black text-2xl text-white shadow-2xl"
                    style={{ borderColor: isLight ? '#ffffff' : '#0e0e16' }}
                  >
                    {selectedProfileUser.display_name.charAt(0)}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-black ${
                    selectedProfileUser.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                </div>

                {selectedProfileUser.id !== 'usr_me' && (
                  <button
                    onClick={() => handleToggleFollow(selectedProfileUser.id)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 shadow-md ${
                      followingUserIds.has(selectedProfileUser.id)
                        ? 'bg-zinc-800 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 border border-zinc-700'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    {followingUserIds.has(selectedProfileUser.id) ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isMutualFriend(selectedProfileUser) ? 'Bạn bè mật vụ' : 'Đang theo dõi'}</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow kết bạn</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Name & Handle */}
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{selectedProfileUser.display_name}</span>
                  <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    {selectedProfileUser.role}
                  </span>
                </h3>
                <p className="text-xs text-cyan-400 font-mono mt-0.5">@{selectedProfileUser.username}</p>
              </div>

              {/* Mutual Relationship Badge */}
              <div className="mt-3 p-2.5 rounded-xl bg-[#141420] border border-[#222234] text-xs font-mono flex items-center justify-between">
                <span className="text-[#888]">Mối quan hệ:</span>
                {isMutualFriend(selectedProfileUser) ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    BẠN BÈ MẬT VỤ (Follow Lẫn Nhau)
                  </span>
                ) : followingUserIds.has(selectedProfileUser.id) ? (
                  <span className="text-cyan-400">Bạn đang theo dõi người này</span>
                ) : selectedProfileUser.followsCurrentUser ? (
                  <span className="text-amber-400">Người này đang theo dõi bạn!</span>
                ) : (
                  <span className="text-[#666]">Chưa theo dõi</span>
                )}
              </div>

              {/* Bio */}
              <div className="mt-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#777] block mb-1">
                  TIỂU SỬ MẬT VỤ
                </span>
                <p className="text-xs text-[#aaa] leading-relaxed font-sans">{selectedProfileUser.bio || 'Chưa cập nhật tiểu sử.'}</p>
              </div>

              {/* Listening Activity Card */}
              {selectedProfileUser.listening && (
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-cyan-950/30 to-black border border-cyan-500/30 flex items-center justify-between gap-3 shadow-md">
                  <div className="truncate flex-1">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1 mb-0.5">
                      <Activity className="w-3 h-3 animate-pulse" />
                      ĐANG PHÁT TRÊN SPYTIFY
                    </span>
                    <p className="text-xs font-bold text-white truncate">{selectedProfileUser.listening}</p>
                  </div>
                  <button
                    onClick={() => handlePlayMemberTrack(selectedProfileUser)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105 active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Nghe cùng</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
