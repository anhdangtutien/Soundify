import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Flame, Play, Disc, Sparkles, TrendingUp, Music, 
  Crown, Loader2, RefreshCw, Compass
} from 'lucide-react';
import { SearchResult, Track } from '../types';
import { YoutubeIcon, SoundCloudIcon, AudiusIcon } from './Icons';
import { getContrastTextColor, optimizeThumbnailUrl, handleImageError } from '../utils/trackUtils';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface HomeTrendingViewProps {
  onPlaySearchResult: (result: SearchResult) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  favorites: Set<string>;
  onToggleFavorite: (trackId: string) => void;
  accentColor?: string;
  language?: LanguageCode;
}

interface CategoryFilter {
  id: string;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryFilter[] = [
  { id: 'all', label: 'Tổng Hợp Top Hits', icon: '🔥' },
  { id: 'cortisol', label: 'Low Cortisol & Chill', icon: '🌅' },
  { id: 'working', label: 'Deep Focus & Work', icon: '💻' },
  { id: 'lockin', label: 'Lock In & Grind', icon: '🎯' },
  { id: 'gym', label: 'Gym & Beast Workout', icon: '🏋️' },
  { id: 'nightdrive', label: 'Late Night Drive', icon: '🌃' },
  { id: 'usuk', label: 'Billboard US/UK Hot 100', icon: '🌍' },
  { id: 'kpop_jpop', label: 'J-Pop & K-Pop Thịnh Hành', icon: '🎌' },
  { id: 'vpop', label: 'V-Pop Đỉnh Chóp', icon: '🇻🇳' },
  { id: 'lofi', label: 'Lo-Fi Chillout', icon: '☕' },
  { id: 'audius', label: 'Audius 320K Charts', icon: '⚡' },
];

// Curated Top Hits categorized: Real songs only, strictly no chart review / ranking countdown videos
const CURATED_BY_CATEGORY: Record<string, SearchResult[]> = {
  usuk: [
    {
      title: 'Die With A Smile',
      artist: 'Lady Gaga & Bruno Mars',
      album: 'Billboard Hot 100 #1',
      duration_secs: 251,
      source: 'youtube',
      url_or_id: 'kPa7bsKwL-c',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'APT. (feat. Bruno Mars)',
      artist: 'ROSÉ & Bruno Mars',
      album: 'Global Viral Sensation',
      duration_secs: 173,
      source: 'youtube',
      url_or_id: 'ekr2nIex040',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: "Short n' Sweet (Global Top 10)",
      duration_secs: 175,
      source: 'youtube',
      url_or_id: 'eVli-tstM5E',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Birds of a Feather',
      artist: 'Billie Eilish',
      album: 'Hit Me Hard and Soft',
      duration_secs: 196,
      source: 'youtube',
      url_or_id: 'V9PVRfjEBTI',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Taste',
      artist: 'Sabrina Carpenter',
      album: "Short n' Sweet",
      duration_secs: 157,
      source: 'youtube',
      url_or_id: '-5GI38vWew8',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Cruel Summer',
      artist: 'Taylor Swift',
      album: 'Lover (The Eras Tour Live)',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'ic8j13piAhQ',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Good Luck, Babe!',
      artist: 'Chappell Roan',
      album: 'Pop Sensation 2024',
      duration_secs: 218,
      source: 'youtube',
      url_or_id: '1RKqOmSkGgM',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Beautiful Things',
      artist: 'Benson Boone',
      album: 'Fireworks & Rollerblades',
      duration_secs: 180,
      source: 'youtube',
      url_or_id: 'Oa_RSwwpPaA',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Lose Control',
      artist: 'Teddy Swims',
      album: "I've Tried Everything But Therapy",
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'GZ3zL7kT6_c',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Too Sweet',
      artist: 'Hozier',
      album: 'Unheard',
      duration_secs: 251,
      source: 'youtube',
      url_or_id: 'IN-PeAZDi7g',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
  ],
  jpop: [
    {
      title: 'Bling-Bang-Bang-Born',
      artist: 'Creepy Nuts',
      album: 'J-Pop Global Phenomenon',
      duration_secs: 172,
      source: 'youtube',
      url_or_id: 'lRDaREIDxEg',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      album: 'Oshi no Ko / J-Pop All-Kill',
      duration_secs: 213,
      source: 'youtube',
      url_or_id: 'ZRtdQ81jPUQ',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Night Dancer',
      artist: 'imase',
      album: 'Viral J-Pop Anthem',
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'QbHBfxAOucI',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Specialz',
      artist: 'King Gnu',
      album: 'Jujutsu Kaisen OP',
      duration_secs: 238,
      source: 'youtube',
      url_or_id: 'fhzKLBZJC3w',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Shinunoga E-Wa',
      artist: 'Fujii Kaze',
      album: 'HELP EVER HURT NEVER',
      duration_secs: 185,
      source: 'youtube',
      url_or_id: 'dFfvMsZ_aJ0',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'KICK BACK',
      artist: 'Kenshi Yonezu',
      album: 'Chainsaw Man OP',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'M2cckDmNLMI',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Show (唱)',
      artist: 'Ado',
      album: 'Universal Studios Japan Anthem',
      duration_secs: 192,
      source: 'youtube',
      url_or_id: 'pgXpM4l_MwI',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
  ],
  kpop: [
    {
      title: 'APT. (feat. Bruno Mars)',
      artist: 'ROSÉ & Bruno Mars',
      album: 'rosie - Global Smash',
      duration_secs: 173,
      source: 'youtube',
      url_or_id: 'ekr2nIex040',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Supernova',
      artist: 'aespa',
      album: 'Armageddon - K-Pop Smash',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'G8YNFjruzPk',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Magnetic',
      artist: 'ILLIT',
      album: 'SUPER REAL ME',
      duration_secs: 160,
      source: 'youtube',
      url_or_id: 'Vk5-c_v4gMU',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Standing Next to You',
      artist: 'Jung Kook',
      album: 'GOLDEN (Global Sensation)',
      duration_secs: 206,
      source: 'youtube',
      url_or_id: 'sn0viUbmUVU',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Whiplash',
      artist: 'aespa',
      album: 'The 5th Mini Album',
      duration_secs: 184,
      source: 'youtube',
      url_or_id: 'jWQx2f-CErU',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Mantra',
      artist: 'JENNIE',
      album: 'Solo Comeback 2024',
      duration_secs: 136,
      source: 'youtube',
      url_or_id: 'bB3-CUMERIU',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Ditto',
      artist: 'NewJeans',
      album: 'OMG Single Album',
      duration_secs: 186,
      source: 'youtube',
      url_or_id: 'pSUydWEqKwE',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
  ],
  anime: [
    {
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      album: 'Oshi no Ko OP',
      duration_secs: 213,
      source: 'youtube',
      url_or_id: 'ZRtdQ81jPUQ',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'KICK BACK',
      artist: 'Kenshi Yonezu',
      album: 'Chainsaw Man OP',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'M2cckDmNLMI',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Specialz',
      artist: 'King Gnu',
      album: 'Jujutsu Kaisen OP',
      duration_secs: 238,
      source: 'youtube',
      url_or_id: 'fhzKLBZJC3w',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
  ],
  edm: [
    {
      title: 'Faded',
      artist: 'Alan Walker',
      album: 'Different World',
      duration_secs: 212,
      source: 'youtube',
      url_or_id: '60ItHLz5WEA',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Animals',
      artist: 'Martin Garrix',
      album: 'Gold Skies EP',
      duration_secs: 184,
      source: 'youtube',
      url_or_id: 'gCYcTmT9wx4',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Wake Me Up',
      artist: 'Avicii',
      album: 'True',
      duration_secs: 247,
      source: 'youtube',
      url_or_id: 'IcrbM1l_BoI',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
  ],
  hiphop: [
    {
      title: 'Not Like Us',
      artist: 'Kendrick Lamar',
      album: 'Billboard Hot 100 #1',
      duration_secs: 274,
      source: 'youtube',
      url_or_id: 'H58vbez_m4E',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'FE!N',
      artist: 'Travis Scott ft. Playboi Carti',
      album: 'UTOPIA',
      duration_secs: 191,
      source: 'youtube',
      url_or_id: 'B9synWjqBn8',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
  ],
  rock: [
    {
      title: 'The Emptiness Machine',
      artist: 'Linkin Park',
      album: 'From Zero (Comeback 2024)',
      duration_secs: 190,
      source: 'youtube',
      url_or_id: 'SRXH9AbT280',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Believer',
      artist: 'Imagine Dragons',
      album: 'Evolve',
      duration_secs: 204,
      source: 'youtube',
      url_or_id: '7wtfhZwyrcc',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
  ],
  acoustic: [
    {
      title: 'Beautiful Things',
      artist: 'Benson Boone',
      album: 'Fireworks & Rollerblades',
      duration_secs: 180,
      source: 'youtube',
      url_or_id: 'Oa_RSwwpPaA',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Lose Control',
      artist: 'Teddy Swims',
      album: "I've Tried Everything But Therapy",
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'GZ3zL7kT6_c',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
  ],
  kpop_jpop: [
    {
      title: 'Bling-Bang-Bang-Born',
      artist: 'Creepy Nuts',
      album: 'J-Pop Global Phenomenon',
      duration_secs: 172,
      source: 'youtube',
      url_or_id: 'lRDaREIDxEg',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Supernova',
      artist: 'aespa',
      album: 'Armageddon - K-Pop Smash',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'G8YNFjruzPk',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
  ],
  vpop: [
    {
      title: 'Đừng Làm Trái Tim Anh Đau',
      artist: 'Sơn Tùng M-TP',
      album: 'V-Pop Quán Quân 2024 - 2025',
      duration_secs: 326,
      source: 'youtube',
      url_or_id: 'abPmZCZZrFA',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Từng Quen',
      artist: 'Wren Evans',
      album: 'Loi Choi - The New V-Pop Wave',
      duration_secs: 174,
      source: 'youtube',
      url_or_id: 'zepHPnUDROE',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Nơi Này Có Anh',
      artist: 'Sơn Tùng M-TP',
      album: 'Hit Quốc Dân V-Pop',
      duration_secs: 279,
      source: 'youtube',
      url_or_id: 'FN7ALfpGxiI',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Thủy Triều',
      artist: 'Quang Hùng MasterD',
      album: 'Giai Điệu Bắt Tai',
      duration_secs: 202,
      source: 'youtube',
      url_or_id: '7ig2lXjozdw',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Không Thể Say',
      artist: 'HIEUTHUHAI',
      album: 'Ai Cũng Phải Bắt Đầu Từ Đâu Đó',
      duration_secs: 215,
      source: 'youtube',
      url_or_id: 'i0nd3NPJ4MI',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Gặp Lại Năm Ta 60',
      artist: 'Orange',
      album: "Cam'On - Vietnamese Soul",
      duration_secs: 236,
      source: 'youtube',
      url_or_id: 'ZXNrz72k1ew',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Cắt Đôi Nỗi Sầu',
      artist: 'Tăng Duy Tân',
      album: 'V-Pop Viral Sensation',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'GpmOn4RyzZI',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Bật Tình Yêu Lên',
      artist: 'Tăng Duy Tân & Hòa Minzy',
      album: 'Song Ca Nổi Bật',
      duration_secs: 204,
      source: 'youtube',
      url_or_id: 'KUx2Pod0KJ4',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Ngày Đầu Tiên',
      artist: 'Đức Phúc',
      album: 'Tình Ca Lãng Mạn',
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'rIXhXaQ8tiM',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Nấu Ăn Cho Em',
      artist: 'Đen Vâu (feat. PiaLinh)',
      album: 'Đen Vâu Hit Collection',
      duration_secs: 260,
      source: 'youtube',
      url_or_id: 'ukHK1GVyr0I',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
  ],
  lofi: [
    {
      title: 'lofi hip hop radio 📚 beats to relax/study to [LIVE 24/7]',
      artist: 'Lofi Girl',
      album: 'Lofi Girl 24/7 Live Radio',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: 'jfKfPfyJRdk',
      thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    },
    {
      title: 'synthwave radio 🌌 beats to chill/game to [LIVE 24/7]',
      artist: 'Lofi Girl',
      album: 'Lofi Girl Synthwave Live',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: '4xDzrJKXOOY',
      thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    },
    {
      title: 'lofi hip hop radio 💤 beats to sleep/chill to [LIVE 24/7]',
      artist: 'Lofi Girl',
      album: 'Lofi Sleep Live Stream',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: 'rUxyKA_-grg',
      thumbnail: 'https://i.ytimg.com/vi/rUxyKA_-grg/hqdefault.jpg',
    },
    {
      title: 'Chillhop Radio - jazzy & lofi hip hop beats 🐾 [LIVE 24/7]',
      artist: 'Chillhop Music',
      album: 'Chillhop 24/7 Live Radio',
      duration_secs: 0,
      source: 'youtube',
      url_or_id: '5yx6BWlEVcY',
      thumbnail: 'https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg',
    },
    {
      title: 'Snowman (Lofi Version)',
      artist: 'Lofi Fruits Music',
      album: 'Chillhop Beats',
      duration_secs: 154,
      source: 'youtube',
      url_or_id: 'b1kbLwvqugk',
      thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'coffee breath (Lofi)',
      artist: 'Kudasai',
      album: 'Falling Beats',
      duration_secs: 142,
      source: 'youtube',
      url_or_id: 'Ggddxkj8tU0',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Affection',
      artist: 'Jinsang',
      album: 'Life Collection',
      duration_secs: 150,
      source: 'youtube',
      url_or_id: 'XWLQKNvCepM',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Controlla',
      artist: 'Idealism',
      album: 'Rainy Days',
      duration_secs: 168,
      source: 'youtube',
      url_or_id: 'LkhPi6J5Xg0',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Biscuit (Lofi Chill)',
      artist: 'Lukrembo',
      album: 'Daily Lofi Vibes',
      duration_secs: 112,
      source: 'youtube',
      url_or_id: 'EtZ2m2Zm3vY',
      thumbnail: 'https://i.ytimg.com/vi/EtZ2m2Zm3vY/hqdefault.jpg',
    },
    {
      title: '5:32pm (Lofi Beat)',
      artist: 'The Deli',
      album: 'Vibes 2',
      duration_secs: 132,
      source: 'youtube',
      url_or_id: '6ustyT4Kx-g',
      thumbnail: 'https://i.ytimg.com/vi/6ustyT4Kx-g/hqdefault.jpg',
    },
  ],
  all: [
    {
      title: 'Die With A Smile',
      artist: 'Lady Gaga & Bruno Mars',
      album: 'Billboard Hot 100 #1',
      duration_secs: 251,
      source: 'youtube',
      url_or_id: 'kPa7bsKwL-c',
      thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'APT. (feat. Bruno Mars)',
      artist: 'ROSÉ & Bruno Mars',
      album: 'Global Viral Sensation',
      duration_secs: 173,
      source: 'youtube',
      url_or_id: 'ekr2nIex040',
      thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Đừng Làm Trái Tim Anh Đau',
      artist: 'Sơn Tùng M-TP',
      album: 'V-Pop Quán Quân 2024 - 2025',
      duration_secs: 326,
      source: 'youtube',
      url_or_id: 'abPmZCZZrFA',
      thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
      album: "Short n' Sweet (Global Top 10)",
      duration_secs: 175,
      source: 'youtube',
      url_or_id: 'eVli-tstM5E',
      thumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Bling-Bang-Bang-Born',
      artist: 'Creepy Nuts',
      album: 'J-Pop Global Phenomenon',
      duration_secs: 172,
      source: 'youtube',
      url_or_id: 'lRDaREIDxEg',
      thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      album: 'Oshi no Ko / J-Pop All-Kill',
      duration_secs: 213,
      source: 'youtube',
      url_or_id: 'ZRtdQ81jPUQ',
      thumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Từng Quen',
      artist: 'Wren Evans',
      album: 'Loi Choi - The New V-Pop Wave',
      duration_secs: 174,
      source: 'youtube',
      url_or_id: 'zepHPnUDROE',
      thumbnail: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Supernova',
      artist: 'aespa',
      album: 'Armageddon - K-Pop Smash',
      duration_secs: 178,
      source: 'youtube',
      url_or_id: 'G8YNFjruzPk',
      thumbnail: 'https://images.unsplash.com/photo-1526478806334-5fd488fcaabc?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Magnetic',
      artist: 'ILLIT',
      album: 'SUPER REAL ME',
      duration_secs: 160,
      source: 'youtube',
      url_or_id: 'Vk5-c_v4gMU',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Birds of a Feather',
      artist: 'Billie Eilish',
      album: 'Hit Me Hard and Soft',
      duration_secs: 196,
      source: 'youtube',
      url_or_id: 'V9PVRfjEBTI',
      thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
    },
  ],
  cortisol: [
    {
      title: 'A Low Cortisol Playlist (Sunset Waves)',
      artist: 'Etherealway & Lofi Chill',
      album: 'De-Stress & Peace',
      duration_secs: 3840,
      source: 'youtube',
      url_or_id: 'kPa7bsKwL-c',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Snowman (Acoustic Slowed)',
      artist: 'Sia & Ethereal Beats',
      album: 'Low Cortisol Morning',
      duration_secs: 215,
      source: 'youtube',
      url_or_id: 'gset79KMmt0',
      thumbnail: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Dandelions (Slowed + Reverb)',
      artist: 'Ruth B.',
      album: 'Cortisol Relief',
      duration_secs: 245,
      source: 'youtube',
      url_or_id: 'W8a4sUabCUo',
      thumbnail: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Golden Hour (Peaceful Piano)',
      artist: 'JVKE',
      album: 'Calm Sanctuary',
      duration_secs: 210,
      source: 'youtube',
      url_or_id: 'PEM0Vs8jf1w',
      thumbnail: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=500&auto=format&fit=crop&q=60',
    },
  ],
  working: [
    {
      title: 'Deep Focus Work & Coding Session',
      artist: 'Synthwave & Lofi Beats',
      album: 'Productive Flow',
      duration_secs: 1800,
      source: 'youtube',
      url_or_id: '5qap5aO4i9A',
      thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Resonance',
      artist: 'HOME',
      album: 'Chillwave Work Beats',
      duration_secs: 212,
      source: 'youtube',
      url_or_id: '8GW6sLrK40k',
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Coffee & Code (Alpha Waves)',
      artist: 'Ambient Work Music',
      album: 'Zero Distraction',
      duration_secs: 2400,
      source: 'youtube',
      url_or_id: 'jfKfPfyJRdk',
      thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&auto=format&fit=crop&q=60',
    },
  ],
  lockin: [
    {
      title: 'LOCK IN (Aggressive Phonk & Focus)',
      artist: 'Kordhell & Hensonn',
      album: 'High Intensity Study',
      duration_secs: 195,
      source: 'youtube',
      url_or_id: 'w-sQRS-Mun8',
      thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Sahara',
      artist: 'Hensonn',
      album: 'Lock In Beast Mode',
      duration_secs: 171,
      source: 'youtube',
      url_or_id: '43R_kKqXvK4',
      thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Midnight City (Dark Ambient Mix)',
      artist: 'M83 & Retro Beats',
      album: 'Tunnel Vision Study',
      duration_secs: 245,
      source: 'youtube',
      url_or_id: 'dX3k_QDnzHE',
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=60',
    },
  ],
  gym: [
    {
      title: 'Murder In My Mind (Beast Mode)',
      artist: 'Kordhell',
      album: 'Gym Workout Bangers',
      duration_secs: 145,
      source: 'youtube',
      url_or_id: 'w-sQRS-Mun8',
      thumbnail: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Montagem Mysterious Game',
      artist: 'LXNGVX',
      album: 'Brazilian Phonk Gym',
      duration_secs: 128,
      source: 'youtube',
      url_or_id: '7V_a_kE4N8w',
      thumbnail: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'Till I Collapse (Remix)',
      artist: 'Eminem & Neffex',
      album: 'PR Workout Motivation',
      duration_secs: 298,
      source: 'youtube',
      url_or_id: 'Obim8BYGnOE',
      thumbnail: 'https://images.unsplash.com/photo-1534367507873-d2d7e24c797f?w=500&auto=format&fit=crop&q=60',
    },
  ],
  nightdrive: [
    {
      title: 'Nightcall (Drive OST)',
      artist: 'Kavinsky',
      album: 'Late Night City Cruising',
      duration_secs: 259,
      source: 'youtube',
      url_or_id: 'MV_3Dpw-BRY',
      thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=60',
    },
    {
      title: 'After Dark',
      artist: 'Mr.Kitty',
      album: 'Time (Midnight Drive)',
      duration_secs: 259,
      source: 'youtube',
      url_or_id: 'waAlgFq9Xq8',
      thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=500&auto=format&fit=crop&q=60',
    },
  ],
};

export const HomeTrendingView: React.FC<HomeTrendingViewProps> = ({
  onPlaySearchResult,
  currentTrack,
  isPlaying,
  favorites,
  onToggleFavorite,
  accentColor = '#ff2a55',
  language = 'vi',
}) => {
  const [trendingTracks, setTrendingTracks] = useState<SearchResult[]>(CURATED_BY_CATEGORY.usuk);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('usuk');

  const fetchTrending = async (category: string) => {
    const curated = CURATED_BY_CATEGORY[category] || CURATED_BY_CATEGORY.usuk;
    // Set curated real songs immediately to guarantee authentic music tracks
    setTrendingTracks(curated);
    setLoading(true);

    try {
      const results = await invoke<SearchResult[]>('get_trending_hits', { category });
      if (results && results.length > 0) {
        // Pool curated tracks and live results, then strictly deduplicate by ID and normalized title
        const pool = category === 'lofi' ? [...curated, ...results] : [...results, ...curated];
        const unique: SearchResult[] = [];
        for (const item of pool) {
          const itemTitleNorm = item.title.trim().toLowerCase();
          const exists = unique.some(
            u => u.url_or_id === item.url_or_id ||
                 u.title.trim().toLowerCase() === itemTitleNorm ||
                 (u.title.trim().toLowerCase().startsWith(itemTitleNorm.slice(0, 18)) &&
                  u.artist.trim().toLowerCase() === item.artist.trim().toLowerCase())
          );
          if (!exists) {
            unique.push(item);
          }
        }
        setTrendingTracks(unique);
      }
    } catch (err) {
      console.error('Failed to fetch trending hits:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrending(activeCategory);
  }, [activeCategory]);

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0 || secs > 86400) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'youtube':
        return (
          <span 
            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] border flex items-center gap-1 font-mono"
            style={{ color: accentColor, borderColor: `${accentColor}50` }}
          >
            <YoutubeIcon className="w-2.5 h-2.5" />YT HI-FI
          </span>
        );
      case 'soundcloud':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-orange-400 border border-orange-500/30 flex items-center gap-1 font-mono">
            <SoundCloudIcon className="w-2.5 h-2.5" />SC
          </span>
        );
      case 'audius':
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-white border border-white/20 flex items-center gap-1 font-mono">
            <AudiusIcon className="w-2.5 h-2.5" style={{ color: accentColor }} />AUDIUS
          </span>
        );
      default:
        return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#16161c] text-white border border-white/20 font-mono">
            LOSSLESS
          </span>
        );
    }
  };

  const featured = trendingTracks[0] || CURATED_BY_CATEGORY.usuk[0];
  const top10 = trendingTracks.slice(0, 10);
  const remaining = trendingTracks.slice(10);

  const categories: CategoryFilter[] = [
    { id: 'usuk', label: 'Billboard US/UK Hot 100', icon: '🌍' },
    { id: 'jpop', label: getTranslation(language, 'trending.tagJpop'), icon: '🌸' },
    { id: 'kpop', label: getTranslation(language, 'trending.tagKpop'), icon: '⚡' },
    { id: 'vpop', label: getTranslation(language, 'trending.tagVpop'), icon: '🇻🇳' },
    { id: 'anime', label: getTranslation(language, 'trending.tagAnime'), icon: '🎌' },
    { id: 'audius', label: 'Audius 320K Charts', icon: '⚡' },
    { id: 'all', label: getTranslation(language, 'trending.tagAll'), icon: '🔥' },
    { id: 'edm', label: getTranslation(language, 'trending.tagEdm'), icon: '🎛️' },
    { id: 'hiphop', label: getTranslation(language, 'trending.tagHiphop'), icon: '🎤' },
    { id: 'lofi', label: 'Lo-Fi Chillout', icon: '☕' },
    { id: 'rock', label: getTranslation(language, 'trending.tagRock'), icon: '🎸' },
    { id: 'acoustic', label: getTranslation(language, 'trending.tagAcoustic'), icon: '🪕' },
  ];

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-7 max-w-7xl mx-auto select-none">
      {/* ─── HERO SPOTLIGHT (BILLBOARD HOT #1 / FEATURED TRACK) ──────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-black border border-[#1c1c24] p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="z-10 max-w-xl space-y-3">
          <div className="flex items-center gap-2">
            <span 
              className="px-2.5 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1.5"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
                borderColor: `${accentColor}50`,
              }}
            >
              <Crown className="w-3 h-3" style={{ color: accentColor }} />
              {getTranslation(language, 'trending.globalRank')}
            </span>
            <span className="text-xs text-[#8e8e9f] font-mono">Top Trending Stream</span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {featured.title}
          </h1>

          <p className="text-sm font-medium text-[#a0a0b2]">
            {featured.artist} • <span className="text-white font-mono">{featured.album || 'Billboard Spotlight'}</span>
          </p>

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => onPlaySearchResult(featured)}
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
                boxShadow: `0 0 16px ${accentColor}40`
              }}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>{getTranslation(language, 'trending.playNow')}</span>
            </button>
            {(!featured.duration_secs || featured.duration_secs <= 0) ? (
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                LIVE 24/7
              </span>
            ) : (
              <span className="text-xs font-mono text-[#777]">{formatTime(featured.duration_secs)}</span>
            )}
          </div>
        </div>

        {/* Featured Cover Art */}
        <div
          onClick={() => onPlaySearchResult(featured)}
          className="relative w-44 h-44 lg:w-52 lg:h-52 rounded-2xl overflow-hidden border border-[#2a2a35] flex-shrink-0 cursor-pointer shadow-xl group"
        >
          {featured.thumbnail ? (
            <img
              src={optimizeThumbnailUrl(featured.thumbnail, featured.url_or_id)}
              alt={featured.title}
              referrerPolicy="no-referrer"
              onError={(e) => handleImageError(e, featured.url_or_id)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-[#121218] flex items-center justify-center text-white">
              <Disc className="w-12 h-12" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            {getSourceBadge(featured.source)}
          </div>
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
              style={{
                backgroundColor: accentColor,
                color: getContrastTextColor(accentColor),
                boxShadow: `0 0 16px ${accentColor}60`,
              }}
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── CATEGORY FILTER PILLS ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-white text-black font-bold shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                    : 'bg-[#0e0e12] text-[#888899] hover:text-white hover:bg-[#16161e] border border-[#1c1c24]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => fetchTrending(activeCategory)}
          disabled={loading}
          className="p-2 rounded-lg bg-[#0e0e12] hover:bg-[#16161e] text-[#888] hover:text-white border border-[#1e1e26] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: loading ? accentColor : undefined }} />
          <span className="hidden sm:inline">{getTranslation(language, 'aimix.refresh')}</span>
        </button>
      </div>

      {/* ─── TOP 10 LEADERBOARD CHART ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#161620] pb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
            {getTranslation(language, 'trending.title')}
          </h2>
          <span className="text-xs text-[#777] font-mono">{getTranslation(language, 'trending.top10')}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {top10.map((item, idx) => {
            const rank = idx + 1;
            const isRank1 = rank === 1;
            const isRank2 = rank === 2;
            const isRank3 = rank === 3;
            const isCurrent = currentTrack && (
              item.url_or_id === currentTrack.id ||
              item.url_or_id === currentTrack.path_or_url ||
              item.title.trim().toLowerCase() === currentTrack.title.trim().toLowerCase()
            );

            return (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item)}
                style={{
                  borderColor: isCurrent ? accentColor : undefined,
                  backgroundColor: isCurrent ? `${accentColor}18` : undefined,
                  boxShadow: isCurrent ? `0 0 14px ${accentColor}30` : undefined,
                }}
                className={`p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-sm ${
                  isCurrent ? '' : 'border-[#161620] hover:border-[#2a2a38]'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {/* Rank Badge */}
                  <div
                    style={isRank1 ? {
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                      boxShadow: `0 0 10px ${accentColor}50`,
                    } : undefined}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs font-mono flex-shrink-0 ${
                      isRank1
                        ? ''
                        : isRank2
                        ? 'bg-white text-black'
                        : isRank3
                        ? 'bg-[#252530] text-white'
                        : 'bg-[#14141a] text-[#777]'
                    }`}
                  >
                    {rank}
                  </div>

                  {/* Thumbnail with hover play */}
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#14141c] border border-[#222]">
                    {item.thumbnail ? (
                      <img
                        src={optimizeThumbnailUrl(item.thumbnail, item.url_or_id)}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, item.url_or_id)}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white" />
                    </div>
                  </div>

                  {/* Song Info */}
                  <div className="overflow-hidden">
                    <p 
                      className="text-xs font-bold text-white truncate transition-colors" 
                      style={{ color: isCurrent ? accentColor : undefined }}
                      title={item.title}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#8e8e9f] truncate font-mono mt-0.5">
                      {item.artist}
                    </p>
                  </div>
                </div>

                {/* Right metadata */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(!item.duration_secs || item.duration_secs <= 0) ? (
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      LIVE
                    </span>
                  ) : (
                    <>
                      {getSourceBadge(item.source)}
                      <span className="text-[11px] font-mono text-[#666]">{formatTime(item.duration_secs)}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── TRENDING MOODS & GENRES ──────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
          {getTranslation(language, 'trending.collections')}
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { title: 'Billboard US/UK', desc: 'Lady Gaga, Bruno Mars, Sabrina', query: 'usuk' },
            { title: 'J-Pop & Anime Viral', desc: 'YOASOBI, Creepy Nuts, Fujii Kaze', query: 'jpop' },
            { title: 'K-Pop All-Kill', desc: 'ROSÉ, aespa, ILLIT, Jung Kook', query: 'kpop' },
            { title: getTranslation(language, 'trending.colVpopTitle'), desc: 'Sơn Tùng, Wren Evans, HIEUTHUHAI', query: 'vpop' },
            { title: 'Audius 320K Hi-Fi', desc: getTranslation(language, 'trending.colAudiusDesc'), query: 'audius' },
            { title: 'Covert Ops Beats', desc: getTranslation(language, 'trending.colLofiDesc'), query: 'lofi' },
          ].map((col, idx) => (
            <button
              key={idx}
              onClick={() => setActiveCategory(col.query)}
              className="p-3.5 rounded-xl bg-[#0c0c10] hover:bg-[#14141a] border border-[#1a1a24] hover:border-[#2a2a38] transition-all text-left flex flex-col justify-between h-28 group cursor-pointer shadow-sm"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-mono font-bold uppercase" style={{ color: accentColor }}>
                  {getTranslation(language, 'trending.topicBadge', { index: idx + 1 })}
                </span>
                <Play className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-white transition-colors leading-tight">{col.title}</p>
                <p className="text-[10px] text-[#777] line-clamp-1 mt-0.5">{col.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── MORE TRENDING DISCOVERIES ────────────────────────────────────── */}
      {remaining.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-[#161620] pb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-white" />
              {getTranslation(language, 'trending.discoverMore')}
            </h2>
            <span className="text-xs text-[#777] font-mono">{getTranslation(language, 'album.trackCount', { count: remaining.length })}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {remaining.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onPlaySearchResult(item)}
                className="p-2.5 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#2a2a38] transition-all flex flex-col group cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-[#14141c]">
                  {item.thumbnail ? (
                    <img
                      src={optimizeThumbnailUrl(item.thumbnail, item.url_or_id)}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, item.url_or_id)}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <Music className="w-6 h-6" />
                    </div>
                  )}

                  <div 
                    className="absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                    style={{
                      backgroundColor: accentColor,
                      color: getContrastTextColor(accentColor),
                    }}
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>

                  <div className="absolute top-1.5 left-1.5">
                    {getSourceBadge(item.source)}
                  </div>
                </div>

                <p className="text-xs font-bold text-white truncate group-hover:text-[#ff2a55] transition-colors" title={item.title}>
                  {item.title}
                </p>
                <p className="text-[11px] text-[#777] truncate font-mono mt-0.5">
                  {item.artist}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
