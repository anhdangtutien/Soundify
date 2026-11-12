import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface AudioVisualizerProps {
  isPlaying: boolean;
  language?: LanguageCode;
  accentColor?: string;
  source?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YT Stream',
  soundcloud: 'SoundCloud',
  audius: 'Audius 320K',
  local: 'Local File',
};

const NUM_BARS = 32;
const BAR_WIDTH = 3;
const BAR_SPACING = 4;
const FRAME_INTERVAL = 1000 / 30; // 30fps là đủ mượt cho hiệu ứng trang trí, giảm một nửa tải so với 60fps

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  language = 'vi',
  accentColor = '#ff2a55',
  source,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Gradient chỉ tạo 1 lần theo màu chủ đạo (thay vì tạo mới cho từng cột mỗi khung hình)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(1, `${accentColor}33`);

    const draw = (playing: boolean) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = gradient;
      const phase = phaseRef.current;
      for (let i = 0; i < NUM_BARS; i++) {
        const x = i * (BAR_WIDTH + BAR_SPACING) + 20;
        let height = 2;
        if (playing) {
          const normalized = (Math.sin(phase + i * 0.25) + Math.cos(phase * 0.8 + i * 0.15) + 2) / 4;
          height = Math.max(3, normalized * (canvas.height - 4));
        }
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - height, BAR_WIDTH, height, 1.5);
        ctx.fill();
      }
    };

    // Khi tạm dừng: vẽ đúng 1 khung tĩnh rồi dừng hẳn, không tốn CPU/GPU
    if (!isPlaying) {
      draw(false);
      return;
    }

    let animationId = 0;
    let lastTime = 0;

    const loop = (time: number) => {
      animationId = requestAnimationFrame(loop);
      // Dừng vẽ khi app bị ẩn / thu nhỏ xuống khay hệ thống
      if (document.hidden || document.documentElement.classList.contains('app-minimized')) return;
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;
      phaseRef.current += 0.14;
      draw(true);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, accentColor]);

  const sourceLabel = source ? SOURCE_LABELS[source] || source.toUpperCase() : '—';

  return (
    <div className="w-full bg-[#0a0a0d] border border-[#161620] rounded-xl px-4 py-2 flex items-center justify-between mb-4 select-none">
      <div className="flex items-center gap-2.5">
        <Activity
          className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`}
          style={{ color: isPlaying ? accentColor : '#444' }}
        />
        <span className="text-[11px] text-[#888] flex items-center gap-2">
          <span className="text-white font-medium">
            {isPlaying ? getTranslation(language, 'visualizer.playing') : getTranslation(language, 'visualizer.idle')}
          </span>
          <span className="text-[10px] text-white/70 font-mono">{sourceLabel}</span>
        </span>
      </div>
      <canvas ref={canvasRef} width={240} height={20} className="rounded opacity-90" />
    </div>
  );
};
