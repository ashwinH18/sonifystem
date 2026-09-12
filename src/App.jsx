import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Info, Eye, Layers } from 'lucide-react';

const PRESETS = {
  parabola: {
    name: "Quadratic (y = x²)",
    description: "Parabolic curve with a clear global minimum at x = 0.",
    fn: (x) => Math.pow(x, 2),
    domain: [-2, 2],
    range: [0, 4],
    criticalPoints: [{ x: 0, y: 0, label: "Global Minimum (0, 0)" }]
  },
  cubic: {
    name: "Cubic (y = x³ - 3x)",
    description: "Features a local maximum, local minimum, and inflection point.",
    fn: (x) => Math.pow(x, 3) - 3 * x,
    domain: [-2.2, 2.2],
    range: [-3, 3],
    criticalPoints: [
      { x: -1, y: 2, label: "Local Maximum (-1, 2)" },
      { x: 0, y: 0, label: "Inflection Point (0, 0)" },
      { x: 1, y: -2, label: "Local Minimum (1, -2)" }
    ]
  },
  sine: {
    name: "Harmonic Wave (y = sin(x))",
    description: "Periodic oscillation demonstrating rhythmic peaks and troughs.",
    fn: (x) => Math.sin(x),
    domain: [0, Math.PI * 2],
    range: [-1, 1],
    criticalPoints: [
      { x: Math.PI / 2, y: 1, label: "Peak (π/2, 1)" },
      { x: (3 * Math.PI) / 2, y: -1, label: "Trough (3π/2, -1)" }
    ]
  },
  ecg: {
    name: "Biomedical ECG Pulse",
    description: "Simulated heartbeat cycle featuring P-wave, sharp QRS spike, and T-wave.",
    fn: (x) => {
      const p = 0.15 * Math.exp(-Math.pow((x - 0.2) / 0.05, 2));
      const q = -0.2 * Math.exp(-Math.pow((x - 0.35) / 0.02, 2));
      const r = 1.2 * Math.exp(-Math.pow((x - 0.4) / 0.03, 2));
      const s = -0.35 * Math.exp(-Math.pow((x - 0.45) / 0.02, 2));
      const t = 0.25 * Math.exp(-Math.pow((x - 0.7) / 0.08, 2));
      return p + q + r + s + t;
    },
    domain: [0, 1],
    range: [-0.4, 1.3],
    criticalPoints: [
      { x: 0.4, y: 1.2, label: "R-Peak (Ventricular Depolarization)" },
      { x: 0.7, y: 0.25, label: "T-Wave (Repolarization)" }
    ]
  }
};

export default function App() {
  const [activePresetKey, setActivePresetKey] = useState('parabola');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(4);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Select a preset or press play to explore.");

  const currentPreset = PRESETS[activePresetKey];

  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const pannerRef = useRef(null);
  const gainRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastCriticalAnnounced = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();

      const osc = ctx.createOscillator();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const gain = ctx.createGain();

      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);

      if (panner) {
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start();

      audioCtxRef.current = ctx;
      oscRef.current = osc;
      pannerRef.current = panner;
      gainRef.current = gain;
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playEarcon = (freq = 880, duration = 0.12) => {
    if (!audioCtxRef.current || !soundEnabled) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio node cleanup safeguard
    }
  };

  const getFreqFromY = (y, range) => {
    const [minY, maxY] = range;
    const normY = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
    return 180 + normY * 700;
  };

  const handlePlayToggle = () => {
    initAudio();
    if (isPlaying) {
      setIsPlaying(false);
      if (gainRef.current) {
        gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
      }
    } else {
      setIsPlaying(true);
      startTimeRef.current = performance.now() - (playhead * playbackSpeed * 1000);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setPlayhead(0);
    lastCriticalAnnounced.current = null;
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const animate = (timestamp) => {
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      let progress = elapsed / playbackSpeed;

      if (progress >= 1) {
        progress = 1;
        setIsPlaying(false);
        setPlayhead(1);
        if (gainRef.current && audioCtxRef.current) {
          gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
        }
        return;
      }

      setPlayhead(progress);

      const [minX, maxX] = currentPreset.domain;
      const currentX = minX + progress * (maxX - minX);
      const currentY = currentPreset.fn(currentX);

      if (audioCtxRef.current && soundEnabled) {
        const ctx = audioCtxRef.current;
        const targetFreq = getFreqFromY(currentY, currentPreset.range);
        const panValue = (progress * 2) - 1;

        oscRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.02);

        if (pannerRef.current) {
          pannerRef.current.pan.setTargetAtTime(panValue, ctx.currentTime, 0.02);
        }

        gainRef.current.gain.setTargetAtTime(0.18, ctx.currentTime, 0.02);

        currentPreset.criticalPoints.forEach((pt) => {
          const ptProgress = (pt.x - minX) / (maxX - minX);
          if (Math.abs(progress - ptProgress) < 0.015 && lastCriticalAnnounced.current !== pt.label) {
            playEarcon(1050, 0.15);
            setStatusMessage(`Mark: ${pt.label}`);
            lastCriticalAnnounced.current = pt.label;
          }
        });
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, currentPreset, soundEnabled]);

  const [minX, maxX] = currentPreset.domain;
  const currentActualX = minX + playhead * (maxX - minX);
  const currentActualY = currentPreset.fn(currentActualX);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '2rem 1.5rem', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Volume2 color="#38bdf8" size={32} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }}>SonifySTEM</h1>
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
            Spatial Web Audio Sonification for Screen Readers & STEM Accessibility
          </p>
        </header>

        {/* Preset Selector */}
        <section style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Select Mathematical Model / Dataset
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(PRESETS).map(([key, data]) => (
              <button
                key={key}
                onClick={() => {
                  handleReset();
                  setActivePresetKey(key);
                  setStatusMessage(`Loaded: ${data.name}`);
                }}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: activePresetKey === key ? '2px solid #38bdf8' : '1px solid #334155',
                  backgroundColor: activePresetKey === key ? '#1e293b' : '#0f172a',
                  color: '#f8fafc',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontWeight: 600 }}>{data.name}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Main Display & Controls */}
        <main style={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #334155', marginBottom: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{currentPreset.name}</h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>{currentPreset.description}</p>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
              <span style={{ color: '#38bdf8', fontSize: '1.1rem', fontWeight: 'bold' }}>
                X: {currentActualX.toFixed(2)} | Y: {currentActualY.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Scrub Track */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ height: '8px', width: '100%', backgroundColor: '#334155', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  position: 'absolute',
                  height: '100%',
                  width: `${playhead * 100}%`,
                  backgroundColor: '#38bdf8',
                  transition: isPlaying ? 'none' : 'width 0.1s'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              <span>Left Ear (Start)</span>
              <span>Center</span>
              <span>Right Ear (End)</span>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={handlePlayToggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isPlaying ? '#e11d48' : '#0284c7',
                color: 'white',
                padding: '0.6rem 1.25rem',
                borderRadius: '0.375rem',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'Pause' : 'Sonify Curve'}
            </button>

            <button
              onClick={handleReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#334155',
                color: 'white',
                padding: '0.6rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} />
              Reset
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
              <label style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>Duration:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                style={{ backgroundColor: '#0f172a', color: 'white', border: '1px solid #475569', borderRadius: '0.25rem', padding: '0.3rem 0.6rem' }}
              >
                <option value={2}>2s (Fast)</option>
                <option value={4}>4s (Standard)</option>
                <option value={8}>8s (Detailed)</option>
              </select>
            </div>
          </div>
        </main>

        {/* Live Audio / ARIA Feedback Console */}
        <div 
          aria-live="polite" 
          style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '0.5rem', padding: '1rem', fontSize: '0.9rem', color: '#38bdf8' }}
        >
          <strong>Assistive Console:</strong> {statusMessage}
        </div>

      </div>
    </div>
  );
}