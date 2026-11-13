import React, { useEffect, useRef, useState } from 'react';
import spytifyLogo from '../assets/spytify-logo.png';

interface SplashScreenProps {
  onFinish: () => void;
  themeMode?: 'dark' | 'light';
  accentColor?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 255,
      parseInt(clean[1] + clean[1], 16) || 42,
      parseInt(clean[2] + clean[2], 16) || 85,
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.substring(0, 2), 16) || 255,
      parseInt(clean.substring(2, 4), 16) || 42,
      parseInt(clean.substring(4, 6), 16) || 85,
    ];
  }
  return [255, 42, 85];
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  themeMode,
  accentColor,
}) => {
  const effectiveTheme =
    themeMode || ((localStorage.getItem('spytify_theme_mode') as 'dark' | 'light') || 'dark');
  const effectiveAccent =
    accentColor || localStorage.getItem('spytify_accent_color') || '#ff2a55';
  const isLight = effectiveTheme === 'light';

  const [fadeout, setFadeout] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Colorize the Spytify silhouette logo dynamically to match the user's personalized accentColor
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = spytifyLogo;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const size = 240;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const [rTarget, gTarget, bTarget] = hexToRgb(effectiveAccent);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) continue;

        // spytify-logo.png has a dark silhouette on a white background:
        // Convert brightness into alpha mask and tint with the user's accentColor
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (lum > 240) {
          data[i + 3] = 0; // Make white background transparent
        } else {
          const strength = Math.min(1, Math.max(0, (245 - lum) / 180));
          data[i] = rTarget;
          data[i + 1] = gTarget;
          data[i + 2] = bTarget;
          data[i + 3] = Math.round(strength * 255);
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };
  }, [effectiveAccent]);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setFadeout(true);
    }, 400);

    const t2 = setTimeout(() => {
      onFinish();
    }, 650);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onFinish]);

  return (
    <div
      style={{
        backgroundColor: isLight ? '#ffffff' : '#09090d',
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none transition-all duration-300 ease-out ${
        fadeout ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <style>{`
        @keyframes spytifyDiscordPulse {
          0%, 100% { transform: scale(1) translateY(0px); }
          50% { transform: scale(1.08) translateY(-4px); }
        }
      `}</style>

      {/* Minimalist Discord-style centered breathing logo */}
      <div
        style={{
          animation: 'spytifyDiscordPulse 1.2s ease-in-out infinite',
          filter: `drop-shadow(0 8px 24px ${effectiveAccent}40)`,
        }}
        className="relative flex flex-col items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          className="w-24 h-24 object-contain"
        />
      </div>

      {/* Simple clean brand name below */}
      <h1
        style={{
          color: isLight ? '#0f172a' : '#ffffff',
        }}
        className="mt-3 text-lg font-extrabold tracking-widest uppercase"
      >
        Spytify
      </h1>
    </div>
  );
};
