import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      if (document.hidden) {
        // Halt GPU redraw when app is minimized or hidden in background
        animationId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 42;
      const barWidth = 3;
      const gap = (canvas.width - barCount * barWidth) / (barCount - 1);

      for (let i = 0; i < barCount; i++) {
        let height = 3;
        if (isPlaying) {
          // Dynamic procedural animated waveform
          const sin1 = Math.sin(phase + i * 0.28);
          const sin2 = Math.cos(phase * 1.4 + i * 0.18);
          const factor = Math.abs(sin1 * sin2);
          height = Math.max(4, factor * (canvas.height - 4));
        }

        const x = i * (barWidth + gap);
        const y = (canvas.height - height) / 2;

        // Spy Waveform: Stealth Crimson Red -> Pure White
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.4, '#ff2a55');
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
    <div className="w-full bg-[#0a0a0d] border border-[#161620] rounded-xl px-4 py-2 flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Activity className={`w-3.5 h-3.5 ${isPlaying ? 'text-[#ff2a55] animate-pulse' : 'text-[#444]'}`} />
        <span className="text-[11px] text-[#888] flex items-center gap-2">
          <span className="text-white font-medium">{isPlaying ? 'Đang phát' : 'Chờ phát'}</span>
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
