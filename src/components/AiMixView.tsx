import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Cpu, Sparkles, Play, Music, RefreshCw, Loader2, CheckCircle2, Sliders, Zap
} from 'lucide-react';
import { Track, User, RecommendationResult, TrainingReport } from '../types';

interface AiMixViewProps {
  currentUser: User | null;
  allTracks: Track[];
  onPlayTrack: (track: Track) => void;
  onOpenAuth: () => void;
  smartDjEnabled: boolean;
  onToggleSmartDj: () => void;
}

export const AiMixView: React.FC<AiMixViewProps> = ({
  currentUser,
  allTracks,
  onPlayTrack,
  onOpenAuth,
  smartDjEnabled,
  onToggleSmartDj,
}) => {
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [report, setReport] = useState<TrainingReport | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const fetchRecommendations = async () => {
    if (!currentUser || allTracks.length === 0) return;
    setLoadingRecs(true);
    try {
      const recs = await invoke<RecommendationResult[]>('ai_recommend_tracks', {
        userId: currentUser.id,
        candidates: allTracks,
      });
      setRecommendations(recs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleTrainAi = async () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    setTraining(true);
    setTrainingProgress(10);

    const t1 = setTimeout(() => setTrainingProgress(35), 300);
    const t2 = setTimeout(() => setTrainingProgress(70), 700);

    try {
      const rep = await invoke<TrainingReport>('ai_train_model', { userId: currentUser.id });
      setTrainingProgress(100);
      setReport(rep);
      await fetchRecommendations();
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setTimeout(() => setTraining(false), 500);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRecommendations();
    }
  }, [currentUser, allTracks.length]);

  return (
    <div className="flex-1 p-8 overflow-y-auto max-w-5xl mx-auto select-none">
      {/* Header Banner — Spy AI Studio */}
      <div className="mb-6 p-5 rounded-2xl bg-[#0a0a0d] border border-[#161620] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold text-[#ff2a55] uppercase px-2 py-0.5 rounded bg-[#181014] border border-[#ff2a55]/30 font-mono flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#ff2a55]" />
              AI Music Engine
            </span>
            <span className="text-[10px] text-[#777] font-mono">On-device • Covert Analytics</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Gợi ý thông minh &amp; Smart DJ</h2>
          <p className="text-xs text-[#8e8e9f] mt-1 max-w-lg">
            Hệ thống AI tự học gu âm nhạc từ tần suất nghe, bài hát yêu thích và thời lượng để cá nhân hóa danh sách đề xuất. Dữ liệu xử lý 100% trên máy nội bộ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTrainAi}
            disabled={training}
            className="px-4 py-2 bg-[#ff2a55] hover:bg-white hover:text-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(255,42,85,0.35)] cursor-pointer disabled:opacity-50"
          >
            {training ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang phân tích ({trainingProgress}%)...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Huấn luyện lại AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Smart DJ Toggle Card */}
      <div className="mb-6 p-4 rounded-xl bg-[#0d0d12] border border-[#1a1a24] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#14141c] flex items-center justify-center text-white border border-[#222]">
            <Sliders className="w-4 h-4 text-[#ff2a55]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Chế độ Smart DJ tự động</h3>
            <p className="text-[11px] text-[#777]">Tự động phát bài hát phù hợp nhất khi kết thúc danh sách chờ hiện tại</p>
          </div>
        </div>
        <button
          onClick={onToggleSmartDj}
          className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
            smartDjEnabled ? 'bg-[#ff2a55]' : 'bg-[#22222a]'
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
              smartDjEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Training Report */}
      {report && (
        <div className="mb-6 p-4 rounded-xl bg-[#0d0d12] border border-[#22222c] space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <CheckCircle2 className="w-4 h-4 text-[#ff2a55]" />
            <span>Đã hoàn tất phân tích gu âm nhạc ({report.status})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">Dữ liệu phân tích</span>
              <p className="text-sm font-bold text-white mt-0.5">{report.tracks_analyzed} bài hát</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">Độ chính xác</span>
              <p className="text-sm font-bold text-[#ff2a55] mt-0.5">{(report.accuracy * 100).toFixed(1)}%</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">Vòng lặp (Epochs)</span>
              <p className="text-sm font-bold text-white mt-0.5">{report.epochs} vòng</p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#101016] border border-[#1c1c24]">
              <span className="text-[10px] text-[#777] font-mono">Thể loại hàng đầu</span>
              <p className="text-sm font-bold text-white mt-0.5 truncate">{report.top_genres?.join(', ') || 'Đa dạng'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations List */}
      <div>
        <div className="flex items-center justify-between mb-3 border-b border-[#161620] pb-2">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#ff2a55]" />
            Đề xuất dành riêng cho bạn ({recommendations.length})
          </h3>
          <button
            onClick={fetchRecommendations}
            disabled={loadingRecs}
            className="text-[11px] text-[#777] hover:text-white flex items-center gap-1 cursor-pointer font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${loadingRecs ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {recommendations.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <p className="text-xs">Chưa có bài hát phù hợp trong thư viện để đề xuất.</p>
            <p className="text-[11px] text-[#555] mt-1">Hãy nghe thêm nhạc để AI ghi nhận gu âm nhạc của bạn.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                onClick={() => onPlayTrack(rec.track)}
                className="p-3 rounded-xl bg-[#09090c] hover:bg-[#121218] border border-[#161620] hover:border-[#ff2a55]/40 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#161620] flex-shrink-0 relative">
                    {rec.track.cover_art ? (
                      <img src={rec.track.cover_art} alt={rec.track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white" />
                    </div>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-[#ff2a55] transition-colors">{rec.track.title}</p>
                    <p className="text-[11px] text-[#8e8e9f] truncate">{rec.track.artist}</p>
                    {rec.reason && (
                      <p className="text-[10px] text-[#666] truncate mt-0.5">{rec.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161620] text-[#ff2a55] border border-[#ff2a55]/30">
                    {Math.round(rec.match_score * 100)}% Match
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};