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

        // Invincible Hero Waveform: Golden Yellow -> Electric Cyan -> Pure White
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.35, '#ffe600');
        gradient.addColorStop(0.75, '#00e5ff');
        gradient.addColorStop(1, '#0088a8');

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
    <div className="w-full bg-[#0a0a0c] border border-[#1a1a20] rounded-xl px-4 py-2.5 flex items-center justify-between mb-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Activity className={`w-3.5 h-3.5 ${isPlaying ? 'text-[#ffe600] animate-pulse drop-shadow-[0_0_6px_#ffe600]' : 'text-[#444]'}`} />
        <span className="text-[11px] font-semibold tracking-wider uppercase text-white/90 flex items-center gap-2">
          {isPlaying ? 'Spytify Ultra HD' : 'Invincible Audio Standby'}
          <span className="text-[9px] px-1.5 py-0.5 text-[#ffe600] bg-[#1a1910] border border-[#ffe600]/30 rounded font-mono font-bold shadow-[0_0_6px_rgba(255,230,0,0.15)]">
            24-Bit / 192kHz
          </span>
          <span className="text-[9px] px-1.5 py-0.5 text-[#00e5ff] bg-[#0d161a] border border-[#00e5ff]/30 rounded font-mono font-semibold">
            HERO EQ
          </span>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={300}
        height={24}
        className="rounded opacity-95"
      />
    </div>
  );
};
