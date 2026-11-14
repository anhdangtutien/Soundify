import React, { useState, useEffect } from 'react';
import { X, Sparkles, Download, ExternalLink, Calendar, CheckCircle2, Loader2, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { UpdateInfo, dismissUpdate } from '../services/updater';

interface UpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
  accentColor?: string;
}

interface ProgressData {
  percentage: number;
  downloaded_mb: string;
  total_mb: string;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  accentColor = '#FF2A55',
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<ProgressData>({
    percentage: 0,
    downloaded_mb: '0',
    total_mb: '0',
  });
  const [statusText, setStatusText] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsDownloading(false);
      setProgress({ percentage: 0, downloaded_mb: '0', total_mb: '0' });
      setStatusText('');
      setErrorText(null);
      return;
    }

    let unlisten: (() => void) | null = null;
    listen<ProgressData>('update-download-progress', (event) => {
      setProgress(event.payload);
      if (event.payload.percentage >= 100) {
        setStatusText('Tải xong! Đang khởi chạy trình cài đặt...');
      } else {
        setStatusText(`Đang tải dữ liệu: ${event.payload.downloaded_mb} MB / ${event.payload.total_mb} MB (${event.payload.percentage}%)`);
      }
    }).then(fn => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [isOpen]);

  if (!isOpen || !updateInfo) return null;

  const handleDismiss = () => {
    if (isDownloading) return; // Prevent dismissing while active download is in progress
    if (updateInfo) {
      dismissUpdate(updateInfo);
    }
    onClose();
  };

  const handleAutoUpdate = async () => {
    if (isDownloading) return;
    setErrorText(null);
    setIsDownloading(true);
    setStatusText('Đang kết nối tới máy chủ GitHub...');

    try {
      await invoke('download_and_install_update', {
        downloadUrl: updateInfo.downloadUrl,
      });
    } catch (err: any) {
      console.error('Failed to auto update:', err);
      setIsDownloading(false);
      setErrorText(typeof err === 'string' ? err : 'Không thể tự động cập nhật. Bạn có thể chọn tải thủ công.');
    }
  };

  const handleManualDownload = async () => {
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
        {!isDownloading && (
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-[#181822] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

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
        <div className="my-3 p-3.5 rounded-xl bg-[#0e0e16] border border-[#1c1c28] max-h-40 overflow-y-auto font-sans text-xs text-[#ccc] leading-relaxed custom-scrollbar">
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

        {/* Download Progress Bar (When Auto Updating) */}
        {isDownloading && (
          <div className="my-4 p-4 rounded-xl bg-[#101018] border border-[#252538] space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white font-semibold flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                {statusText || 'Đang tải bản cập nhật...'}
              </span>
              <span className="font-bold text-white text-sm">{progress.percentage}%</span>
            </div>

            <div className="w-full bg-[#181824] rounded-full h-2.5 overflow-hidden border border-[#2c2c40]">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${progress.percentage}%`,
                  backgroundColor: accentColor,
                  boxShadow: `0 0 10px ${accentColor}`,
                }}
              />
            </div>

            <p className="text-[10px] text-[#777] font-mono">
              {progress.total_mb !== '0'
                ? `Đã tải ${progress.downloaded_mb} MB / ${progress.total_mb} MB`
                : 'Đang chuẩn bị gói cập nhật...'}
            </p>
          </div>
        )}

        {/* Error Notice */}
        {errorText && (
          <div className="my-2 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          {!isDownloading ? (
            <>
              {/* PRIMARY: IN-APP ONE-CLICK AUTO UPDATE */}
              <button
                onClick={handleAutoUpdate}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-transform hover:scale-[1.01]"
                style={{
                  backgroundColor: accentColor,
                  color: accentColor === '#FFFFFF' ? '#000000' : '#FFFFFF',
                  boxShadow: `0 0 16px ${accentColor}40`,
                }}
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Cập nhật tự động ngay trên App</span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                {/* SECONDARY: MANUAL BROWSER DOWNLOAD */}
                <button
                  onClick={handleManualDownload}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#12121c] hover:bg-[#1a1a28] border border-[#262638] text-xs font-semibold text-[#aaa] hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Tải file .exe qua trình duyệt web"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải thủ công (.exe)</span>
                </button>

                <button
                  onClick={handleOpenReleasePage}
                  className="py-2 px-3 rounded-xl bg-[#12121c] hover:bg-[#1a1a28] border border-[#262638] text-xs font-semibold text-[#aaa] hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Xem thông tin chi tiết trên GitHub Releases"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-2 text-xs text-[#888] font-mono animate-pulse">
              Vui lòng không tắt ứng dụng trong lúc đang cập nhật...
            </div>
          )}
        </div>

        {!isDownloading && (
          <div className="text-center mt-3">
            <button
              onClick={handleDismiss}
              className="text-[11px] text-[#777] hover:text-[#bbb] hover:underline cursor-pointer font-mono"
            >
              Để sau (Nhắc tôi ở bản build kế tiếp)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
