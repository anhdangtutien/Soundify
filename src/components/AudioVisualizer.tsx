import React, { useEffect, useRef } from 'react';
import { Activity, Radio } from 'lucide-react';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface AudioVisualizerProps {
  isPlaying: boolean;
  language?: LanguageCode;
  accentColor?: string;
  source?: string;
  audioElement?: HTMLAudioElement | null;
  currentTime?: number;
  themeMode?: 'dark' | 'light';
}

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YT Stream',
  soundcloud: 'SoundCloud',
  audius: 'Audius 320K',
  local: 'Local File',
};

// Global singleton Web Audio Analyser
let sharedAudioCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let connectedElement: HTMLAudioElement | null = null;

function setupAudioAnalyser(_audioEl?: HTMLAudioElement | null): AnalyserNode | null {
  return null; // Keep audio element on direct native pipeline to prevent CORS muting
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  language = 'vi',
  accentColor = '#00E5FF',
  source,
  audioElement,
  currentTime = 0,
  themeMode = 'dark',
}) => {
  const isLight = themeMode === 'light';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  
  // Smooth energy & amplitude physics for decay and idle breathing
  const energyRef = useRef(0.1);
  const bassRef = useRef(0.1);
  const trebleRef = useRef(0.1);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = setupAudioAnalyser(audioElement);
    if (analyser && !freqDataRef.current) {
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    let animationId = 0;
    let lastTime = performance.now();
    const FRAME_INTERVAL = 1000 / 60; // 60fps smooth physics

    const renderLoop = (now: number) => {
      animationId = requestAnimationFrame(renderLoop);
      if (document.hidden || document.documentElement.classList.contains('app-minimized')) return;
      if (now - lastTime < FRAME_INTERVAL) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // ─── Audio Data or Synthesis Sampling ───
      let targetEnergy = 0.08; // Idle breathing baseline
      let targetBass = 0.05;
      let targetTreble = 0.05;

      if (isPlaying) {
        let hasRealFreq = false;
        if (analyser && freqDataRef.current) {
          analyser.getByteFrequencyData(freqDataRef.current as any);
          let sum = 0;
          let bSum = 0;
          let tSum = 0;
          const len = Math.min(64, freqDataRef.current.length);
          for (let i = 0; i < len; i++) {
            const val = freqDataRef.current[i];
            sum += val;
            if (i < 8) bSum += val;
            if (i > 24) tSum += val;
          }
          if (sum > 20) {
            hasRealFreq = true;
            targetEnergy = Math.min(1.0, (sum / len) / 180);
            targetBass = Math.min(1.0, (bSum / 8) / 190);
            targetTreble = Math.min(1.0, (tSum / (len - 24)) / 160);
          }
        }

        if (!hasRealFreq) {
          // Acoustic rhythm synthesis (124 BPM)
          const timeSecs = currentTime > 0 ? currentTime : now / 1000;
          const beatPhase = (timeSecs * 2.06) % 1.0;
          const kick = Math.pow(Math.max(0, 1 - beatPhase * 3.5), 2.2);
          const snarePhase = (timeSecs * 2.06 + 0.5) % 1.0;
          const snare = Math.pow(Math.max(0, 1 - snarePhase * 4.0), 2.0);
          const flutter = Math.sin(timeSecs * 14) * 0.2 + 0.2;

          targetBass = 0.25 + kick * 0.65;
          targetTreble = 0.2 + snare * 0.5 + flutter * 0.3;
          targetEnergy = Math.min(1.0, targetBass * 0.6 + targetTreble * 0.4);
        }
      }

      // ─── Smooth Exponential Decay / Ballistics ───
      // When stopping, energy gently decays into the relaxing idle wave (never cuts abruptly)
      const attackSpeed = 0.35;
      const decaySpeed = isPlaying ? 0.08 : 0.035; // gentle, graceful falloff when stopped

      energyRef.current += (targetEnergy - energyRef.current) * (targetEnergy > energyRef.current ? attackSpeed : decaySpeed);
      bassRef.current += (targetBass - bassRef.current) * (targetBass > bassRef.current ? attackSpeed : decaySpeed);
      trebleRef.current += (targetTreble - trebleRef.current) * (targetTreble > trebleRef.current ? attackSpeed : decaySpeed);

      const speedMult = isPlaying ? (1.8 + energyRef.current * 2.5) : 0.85;
      phaseRef.current += dt * speedMult;
      const phase = phaseRef.current;
      const amp = energyRef.current * (height * 0.42);

      // ─── Multi-Layer Fluid Waveform Rendering ───
      const points = 70;
      const step = width / (points - 1);

      // Layer 1: Ambient Under-Glow Translucent Area Fill
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, `${accentColor}30`);
      bgGrad.addColorStop(0.5, `${accentColor}12`);
      bgGrad.addColorStop(1, `${accentColor}00`);

      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let i = 0; i < points; i++) {
        const x = i * step;
        const normX = i / (points - 1);
        // Window function so ends smoothly taper to zero at edges
        const edgeWindow = Math.sin(normX * Math.PI);

        const w1 = Math.sin(normX * 9.0 - phase * 3.2);
        const w2 = Math.cos(normX * 17.0 + phase * 2.1) * (0.35 + trebleRef.current * 0.45);
        const w3 = Math.sin(normX * 4.0 - phase * 1.5) * (0.5 + bassRef.current * 0.6);

        const yOffset = (w1 * 0.5 + w2 * 0.3 + w3 * 0.4) * amp * edgeWindow;
        const y = midY + yOffset;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = bgGrad;
      ctx.fill();

      // Layer 2: Secondary Harmonic Wave (Ghost wave with 35% opacity)
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = `${accentColor}55`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < points; i++) {
        const x = i * step;
        const normX = i / (points - 1);
        const edgeWindow = Math.sin(normX * Math.PI);
        const waveGhost = Math.sin(normX * 13.0 + phase * 2.6) * Math.cos(normX * 5.0 - phase);
        const y = midY + waveGhost * (amp * 0.7) * edgeWindow;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Layer 3: Primary Neon Crest Wave with Glow
      ctx.save();
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = isPlaying ? 9 : 4;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const x = i * step;
        const normX = i / (points - 1);
        const edgeWindow = Math.sin(normX * Math.PI);

        const w1 = Math.sin(normX * 9.0 - phase * 3.2);
        const w2 = Math.cos(normX * 17.0 + phase * 2.1) * (0.35 + trebleRef.current * 0.45);
        const w3 = Math.sin(normX * 4.0 - phase * 1.5) * (0.5 + bassRef.current * 0.6);

        const yOffset = (w1 * 0.5 + w2 * 0.3 + w3 * 0.4) * amp * edgeWindow;
        const y = midY + yOffset;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Layer 4: Bright Peak Center Accent
      if (isPlaying && energyRef.current > 0.4) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        for (let i = Math.floor(points * 0.3); i <= Math.floor(points * 0.7); i++) {
          const x = i * step;
          const normX = i / (points - 1);
          const edgeWindow = Math.sin(normX * Math.PI);
          const w1 = Math.sin(normX * 9.0 - phase * 3.2);
          const w2 = Math.cos(normX * 17.0 + phase * 2.1) * (0.35 + trebleRef.current * 0.45);
          const y = midY + (w1 * 0.5 + w2 * 0.3) * amp * edgeWindow;
          if (i === Math.floor(points * 0.3)) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    };

    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, accentColor, audioElement, currentTime]);

  const sourceLabel = source ? SOURCE_LABELS[source] || source.toUpperCase() : '—';

  return (
    <div className={`w-full rounded-xl px-4 py-2 flex items-center justify-between mb-3.5 select-none shadow-sm backdrop-blur transition-colors ${
      isLight 
        ? 'bg-[#ffffff]/90 border border-[#e2e8f0] shadow-sm' 
        : 'bg-[#09090d] border border-[#161622]'
    }`}>
      <div className="flex items-center gap-3">
        <div 
          className="w-7 h-7 rounded-lg flex items-center justify-center border transition-all"
          style={{
            backgroundColor: `${accentColor}18`,
            borderColor: `${accentColor}35`,
            color: accentColor,
            boxShadow: isPlaying ? `0 0 10px ${accentColor}30` : undefined,
          }}
        >
          <Activity className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold tracking-tight ${isLight ? 'text-[#0f172a]' : 'text-white'}`}>
            {isPlaying ? getTranslation(language, 'visualizer.playing') : getTranslation(language, 'visualizer.idle')}
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
            isLight 
              ? 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]' 
              : 'bg-[#13131c] text-zinc-400 border-white/10'
          }`}>
            {sourceLabel}
          </span>
          <span 
            className="hidden md:inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors"
            style={{
              color: accentColor,
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}35`,
            }}
          >
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            FLUID WAVEFORM 60FPS
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className={`hidden sm:flex items-center gap-4 text-[9px] font-mono font-bold tracking-wider uppercase pr-1 ${
          isLight ? 'text-[#94a3b8]' : 'text-[#666]'
        }`}>
          <span className="hover:text-emerald-400 transition-colors">BASS</span>
          <span className="hover:text-cyan-400 transition-colors">MID</span>
          <span className="hover:text-amber-400 transition-colors">TREBLE</span>
        </div>
        <canvas ref={canvasRef} width={252} height={26} className="rounded opacity-95" />
      </div>
    </div>
  );
};
