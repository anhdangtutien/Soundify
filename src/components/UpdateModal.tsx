import React from 'react';
import { X, Sparkles, Download, ExternalLink, Calendar, CheckCircle2 } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UpdateInfo, dismissUpdate } from '../services/updater';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
  accentColor?: string;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  accentColor = '#FF2A55',
}) => {
  if (!isOpen || !updateInfo) return null;

  const handleDismiss = () => {
    if (updateInfo) {
      dismissUpdate(updateInfo);
    }
    onClose();
  };

  const handleDownload = async () => {
    if (updateInfo) {
      dismissUpdate(updateInfo);
    }
    try {
      await openUrl(updateInfo.downloadUrl);
    } catch {
      window.open(updateInfo.downloadUrl, '_blank');
    }
  };

  const handleOpenReleasePage = async () => {
    try {
      await openUrl(updateInfo.releaseUrl);
    } catch {
      window.open(updateInfo.releaseUrl, '_blank');
    }
  };

  const formattedDate = updateInfo.publishedAt
    ? new Date(updateInfo.publishedAt).toLocaleString('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0a0f] border border-[#222230] rounded-2xl p-6 shadow-2xl relative text-white">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-[#181822] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{
              backgroundColor: `${accentColor}25`,
              color: accentColor,
              border: `1px solid ${accentColor}40`,
            }}
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  borderColor: `${accentColor}40`,
                }}
              >
                Bản mới
              </span>
              <span className="text-xs font-mono text-[#888]">{updateInfo.version}</span>
            </div>
            <h3 className="text-base font-black tracking-tight mt-1 text-white">
              {updateInfo.name || 'Đã có bản cập nhật Spytify mới'}
            </h3>
            {formattedDate && (
              <p className="text-[11px] text-[#777] font-mono flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 text-[#555]" />
                <span>Phát hành: {formattedDate}</span>
              </p>
            )}
          </div>
        </div>

        {/* Release Notes / Description */}
        <div className="my-3 p-3.5 rounded-xl bg-[#0e0e16] border border-[#1c1c28] max-h-48 overflow-y-auto font-sans text-xs text-[#ccc] leading-relaxed custom-scrollbar">
          <p className="font-bold text-[11px] text-[#999] uppercase font-mono mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Nội dung bản cập nhật / Vá lỗi:
          </p>
          <div className="whitespace-pre-wrap text-[#bbb] text-[11px]">
            {updateInfo.notes
              ? updateInfo.notes
              : 'Bản cập nhật tối ưu hóa hiệu năng, cải tiến giao diện và sửa các lỗi phát sinh gần đây.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          <button
            onClick={handleDownload}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: accentColor,
              color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
            }}
          >
            <Download className="w-4 h-4" />
            <span>Tải bản mới ngay (.exe)</span>
          </button>

          <button
            onClick={handleOpenReleasePage}
            className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-[#14141e] hover:bg-[#1e1e2c] border border-[#262638] text-xs font-semibold text-[#aaa] hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            title="Xem chi tiết trên GitHub Releases"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </button>
        </div>

        <div className="text-center mt-3">
          <button
            onClick={handleDismiss}
            className="text-[11px] text-[#777] hover:text-[#bbb] hover:underline cursor-pointer font-mono"
          >
            Để sau (Nhắc tôi ở bản build kế tiếp)
          </button>
        </div>
      </div>
    </div>
  );
};
