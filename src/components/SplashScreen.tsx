import React, { useEffect, useState } from 'react';
import spytifyLogo from '../assets/spytify-logo.png';
import { ShieldAlert, Radio } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [phase, setPhase] = useState<'loading' | 'granted' | 'fadeout'>('loading');
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('INITIALIZING SECURE AUDIO PIPELINE...');

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(55);
      setStatusText('DECRYPTING MULTI-SOURCE STREAMS (YT • SC • AUDIUS)...');
    }, 400);

    const t2 = setTimeout(() => {
      setProgress(90);
      setStatusText('CALIBRATING LOSSLESS DSP & ON-DEVICE AI...');
    }, 850);

    const t3 = setTimeout(() => {
      setProgress(100);
      setPhase('granted');
      setStatusText('ACCESS GRANTED • WELCOME AGENT');
    }, 1250);

    const t4 = setTimeout(() => {
      setPhase('fadeout');
    }, 1600);

    const t5 = setTimeout(() => {
      onFinish();
    }, 1950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center select-none transition-all duration-350 ease-out ${
        phase === 'fadeout' ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Subtle Radar Ambient Glow */}
      <div className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-[#ff2a55]/15 via-transparent to-transparent blur-3xl pointer-events-none animate-pulse" />

      {/* Center Radar Scanner & Logo */}
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer Rotating Radar Ring */}
        <div className="absolute w-36 h-36 rounded-full border border-[#ff2a55]/25 border-t-[#ff2a55] animate-spin" style={{ animationDuration: '2.5s' }} />
        <div className="absolute w-44 h-44 rounded-full border border-dashed border-[#ff2a55]/15 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />

        {/* Pulsing Beacon Ring */}
        <div className="absolute w-28 h-28 rounded-full bg-[#ff2a55]/10 animate-ping opacity-50" />

        {/* Center Logo Box */}
        <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[#0c0c10] border-2 border-[#ff2a55] shadow-[0_0_30px_rgba(255,42,85,0.4)] flex items-center justify-center z-10">
          <img src={spytifyLogo} alt="Spytify" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Brand & Subtitle */}
      <div className="text-center space-y-1 z-10">
        <h1 className="text-2xl font-black tracking-widest text-white uppercase flex items-center justify-center gap-2">
          <span>Spytify</span>
          <span className="w-2 h-2 rounded-full bg-[#ff2a55] animate-ping" />
        </h1>
        <p className="text-[11px] font-mono tracking-[0.3em] text-[#ff2a55] font-bold uppercase">
          SPY MUSIC
        </p>
      </div>

      {/* Decryption Progress Bar & Terminal Status */}
      <div className="mt-8 w-64 space-y-2 z-10">
        <div className="h-[3px] w-full bg-[#161620] rounded-full overflow-hidden p-0">
          <div
            className="h-full bg-gradient-to-r from-[#ff2a55] via-white to-[#ff2a55] rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_#ff2a55]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-[#777]">
          <span className={`truncate transition-colors ${phase === 'granted' ? 'text-[#ff2a55] font-bold' : ''}`}>
            {statusText}
          </span>
          <span className="font-bold text-white ml-2">{progress}%</span>
        </div>
      </div>

      {/* Bottom Confidential Badge */}
      <div className="absolute bottom-6 flex items-center gap-1.5 text-[9px] font-mono text-[#555] uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff2a55]" />
        <span>CLASSIFIED COVERT AUDIO PROTOCOL v2.0</span>
      </div>
    </div>
  );
};
