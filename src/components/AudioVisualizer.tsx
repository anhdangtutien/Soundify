import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface AudioVisualizerProps {
  isPlaying: boolean;
  language?: LanguageCode;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, language = 'vi' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const numBars = 32;
    const barWidth = 3;
    const barSpacing = 4;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + barSpacing) + 20;

        let height: number;
        if (isPlaying) {
          const sine = Math.sin(phase + i * 0.25);
          const cosine = Math.cos(phase * 0.8 + i * 0.15);
          const normalized = (sine + cosine + 2) / 4;
          height = Math.max(3, normalized * (canvas.height - 4));
        } else {
          height = 2;
        }

        const y = canvas.height - height;

        const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
        gradient.addColorStop(0, '#ff2a55');
        gradient.addColorStop(1, '#66001a');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, 1.5);
        ctx.fill();
      }

      if (isPlaying) {
        phase += 0.07;
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying]);

  return (
    <div className="w-full bg-[#0a0a0d] border border-[#161620] rounded-xl px-4 py-2 flex items-center justify-between mb-4 select-none">
      <div className="flex items-center gap-2.5">
        <Activity className={`w-3.5 h-3.5 ${isPlaying ? 'text-[#ff2a55] animate-pulse' : 'text-[#444]'}`} />
        <span className="text-[11px] text-[#888] flex items-center gap-2">
          <span className="text-white font-medium">
            {isPlaying ? getTranslation(language, 'visualizer.playing') : getTranslation(language, 'visualizer.idle')}
          </span>
          <span className="text-[10px] text-white/70 font-mono">Lossless Audio</span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={240}
        height={20}
        className="rounded opacity-90"
      />
    </div>
  );
};
