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

        // Amazon Music Electric Cyan -> Pure White gradient (TIDAL Hi-Res style)
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, '#00e5ff');
        gradient.addColorStop(1, '#0099b8');

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
    <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-2.5 flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <Activity className={`w-3.5 h-3.5 ${isPlaying ? 'text-[#00e5ff] animate-pulse' : 'text-[#444]'}`} />
        <span className="text-[11px] font-semibold tracking-wider uppercase text-white/90 flex items-center gap-2">
          {isPlaying ? 'Ultra HD Playback' : 'Sound Engine Standby'}
          <span className="text-[9px] px-1.5 py-0.2 text-[#00e5ff] bg-[#00e5ff]/10 border border-[#00e5ff]/30 rounded font-mono">
            24-Bit / 96kHz
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
