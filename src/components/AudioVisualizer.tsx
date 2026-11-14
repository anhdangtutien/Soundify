import React, { useEffect, useRef } from 'react';
import { Activity, Radio } from 'lucide-react';
import { LanguageCode, getTranslation } from '../locales/i18n';

interface AudioVisualizerProps {
  isPlaying: boolean;
  language?: LanguageCode;
  accentColor?: string;
  source?: string;
  audioElement?: HTMLAudioElement | null;
}

const SOURCE_LABELS: Record<string, string> = {
  youtube: 'YT Stream',
  soundcloud: 'SoundCloud',
  audius: 'Audius 320K',
  local: 'Local File',
};

const NUM_BARS = 36;
const BAR_WIDTH = 3.5;
const BAR_SPACING = 3;

// Global singleton Web Audio Analyser to safely attach without multiple source errors
let sharedAudioCtx: AudioContext | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let connectedElement: HTMLAudioElement | null = null;

function setupAudioAnalyser(audioEl?: HTMLAudioElement | null): AnalyserNode | null {
  if (!audioEl) return sharedAnalyser;
  try {
    if (!sharedAudioCtx) {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    if (!sharedAnalyser) {
      sharedAnalyser = sharedAudioCtx.createAnalyser();
      sharedAnalyser.fftSize = 128;
      sharedAnalyser.smoothingTimeConstant = 0.82;
    }
    if (connectedElement !== audioEl) {
      try {
        const source = sharedAudioCtx.createMediaElementSource(audioEl);
        source.connect(sharedAnalyser);
        sharedAnalyser.connect(sharedAudioCtx.destination);
        connectedElement = audioEl;
      } catch {}
    }
    return sharedAnalyser;
  } catch {
    return null;
  }
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  language = 'vi',
  accentColor = '#ff2a55',
  source,
  audioElement,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const peaksRef = useRef<number[]>(new Array(NUM_BARS).fill(0));
  const freqDataRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = setupAudioAnalyser(audioElement);
    if (analyser && !freqDataRef.current) {
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.2, accentColor);
    gradient.addColorStop(1, `${accentColor}20`);

    const draw = (playing: boolean) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const phase = phaseRef.current;

      let hasRealFreq = false;
      if (playing && analyser && freqDataRef.current) {
        analyser.getByteFrequencyData(freqDataRef.current as any);
        let sum = 0;
        for (let i = 0; i < 16; i++) sum += freqDataRef.current[i];
        if (sum > 5) hasRealFreq = true;
      }

      for (let i = 0; i < NUM_BARS; i++) {
        const x = i * (BAR_WIDTH + BAR_SPACING) + 8;
        let height = 2;

        if (playing) {
          if (hasRealFreq && freqDataRef.current) {
            // Map 36 bars to logarithmic frequency bands: low (bass) to high (treble)
            const binIdx = Math.min(
              freqDataRef.current.length - 1,
              Math.floor(Math.pow(i / NUM_BARS, 1.4) * (freqDataRef.current.length - 1))
            );
            const raw = freqDataRef.current[binIdx] / 255;
            // Boost treble slightly for visual balance
            const eqMultiplier = 0.8 + (i / NUM_BARS) * 0.7;
            height = Math.max(3, raw * eqMultiplier * (canvas.height - 4));
          } else {
            // Hi-Fi rhythmic multi-octave harmonic simulation
            const bass = Math.sin(phase * 1.8 + (i < 8 ? i * 0.4 : 0)) * 0.5 + 0.5;
            const mid = Math.cos(phase * 1.2 + i * 0.3) * 0.3 + 0.5;
            const high = Math.sin(phase * 2.4 + i * 0.6) * 0.2 + 0.5;
            const envelope = 1 - Math.abs(i - 12) / 24;
            const normalized = Math.min(1, Math.max(0, (bass * 0.5 + mid * 0.3 + high * 0.2) * (0.6 + envelope * 0.5)));
            height = Math.max(3, normalized * (canvas.height - 5));
          }
        }

        // Calculate and decay falling peak caps
        const currentPeak = peaksRef.current[i] || 0;
        let nextPeak = Math.max(height, currentPeak - 0.7);
        peaksRef.current[i] = nextPeak;

        // Draw frequency spectrum bar
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - height, BAR_WIDTH, height, 1.5);
        ctx.fill();

        // Draw floating peak hold dot
        if (playing && nextPeak > 4) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, Math.max(0, canvas.height - nextPeak - 1.5), BAR_WIDTH, 1.5);
        }
      }
    };

    if (!isPlaying) {
      peaksRef.current.fill(2);
      draw(false);
      return;
    }

    let animationId = 0;
    let lastTime = 0;
    const FRAME_INTERVAL = 1000 / 45; // 45fps smooth studio graphic equalizer

    const loop = (time: number) => {
      animationId = requestAnimationFrame(loop);
      if (document.hidden || document.documentElement.classList.contains('app-minimized')) return;
      if (time - lastTime < FRAME_INTERVAL) return;
      lastTime = time;
      phaseRef.current += 0.16;
      draw(true);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, accentColor, audioElement]);

  const sourceLabel = source ? SOURCE_LABELS[source] || source.toUpperCase() : '—';

  return (
    <div className="w-full bg-[#0a0a0d] border border-[#161620] rounded-xl px-4 py-2.5 flex items-center justify-between mb-4 select-none shadow-sm">
      <div className="flex items-center gap-3">
        <Activity
          className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`}
          style={{ color: isPlaying ? accentColor : '#555' }}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-white font-bold tracking-tight">
            {isPlaying ? getTranslation(language, 'visualizer.playing') : getTranslation(language, 'visualizer.idle')}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#14141e] text-zinc-400 border border-white/10">
            {sourceLabel}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.2 rounded">
            <Radio className="w-2.5 h-2.5 animate-pulse" />
            HI-FI FFT
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-3 text-[8px] font-mono font-bold text-[#555] uppercase pr-2">
          <span>BASS</span>
          <span>MID</span>
          <span>TREBLE</span>
        </div>
        <canvas ref={canvasRef} width={250} height={24} className="rounded opacity-95" />
      </div>
    </div>
  );
};
