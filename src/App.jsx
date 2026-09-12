import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Keyboard } from 'lucide-react';

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
      { x: -1.732, y: 0, label: "Root (x = -√3)" },
      { x: -1, y: 2, label: "Local Maximum (-1, 2)" },
      { x: 0, y: 0, label: "Inflection Point & Root (0, 0)" },
      { x: 1, y: -2, label: "Local Minimum (1, -2)" },
      { x: 1.732, y: 0, label: "Root (x = √3)" }
    ]
  },
  sine: {
    name: "Harmonic Wave (y = sin(x))",
    description: "Periodic oscillation demonstrating rhythmic peaks and troughs.",
    fn: (x) => Math.sin(x),
    domain: [0, Math.PI * 2],
    range: [-1, 1],
    criticalPoints: [
      { x: 0, y: 0, label: "Root (0, 0)" },
      { x: Math.PI / 2, y: 1, label: "Peak (π/2, 1)" },
      { x: Math.PI, y: 0, label: "Root (π, 0)" },
      { x: (3 * Math.PI) / 2, y: -1, label: "Trough (3π/2, -1)" },
      { x: 2 * Math.PI, y: 0, label: "Root (2π, 0)" }
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
      { x: 0.2, y: 0.15, label: "P-Wave (Atrial Depolarization)" },
      { x: 0.35, y: -0.2, label: "Q-Wave" },
      { x: 0.4, y: 1.2, label: "R-Peak (Ventricular Depolarization)" },
      { x: 0.45, y: -0.35, label: "S-Wave" },
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
  const [statusMessage, setStatusMessage] = useState("Select a preset, use Space to play, or Arrow keys to scrub.");

  const currentPreset = PRESETS[activePresetKey];

  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const pannerRef = useRef(null);
  const gainRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastCriticalAnnounced = useRef(null);

  const initAudio = useCallback(() => {
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
  }, []);

  const getFreqFromY = useCallback((y, range) => {
    const [minY, maxY] = range;
    const normY = Math.max(0, Math.min(1, (y - minY) / (maxY - minY)));
    return 180 + normY * 700;
  }, []);

  const playEarcon = useCallback((freq = 1050, duration = 0.15) => {
    if (!audioCtxRef.current || !soundEnabled) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio node cleanup safeguard
    }
  }, [soundEnabled]);

  // Tactile audio feedback for step scrubbing
  const playScrubProbe = useCallback((freq, pan) => {
    if (!soundEnabled) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

      if (panner) {
        panner.pan.setValueAtTime(pan, ctx.currentTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.13);
    } catch {
      // Audio node cleanup safeguard
    }
  }, [initAudio, soundEnabled]);

  const checkCriticalPoints = useCallback((progress, preset) => {
    const [minX, maxX] = preset.domain;
    let landmarkLabel = null;

    preset.criticalPoints.forEach((pt) => {
      const ptProgress = (pt.x - minX) / (maxX - minX);
      if (Math.abs(progress - ptProgress) < 0.015) {
        if (lastCriticalAnnounced.current !== pt.label) {
          playEarcon(1050, 0.15);
          lastCriticalAnnounced.current = pt.label;
        }
        landmarkLabel = pt.label;
      }
    });

    if (!landmarkLabel) {
      lastCriticalAnnounced.current = null;
    }
    return landmarkLabel;
  }, [playEarcon]);

  const handlePlayToggle = useCallback(() => {
    initAudio();
    if (isPlaying) {
      setIsPlaying(false);
      if (gainRef.current && audioCtxRef.current) {
        gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
      }
    } else {
      setIsPlaying(true);
      startTimeRef.current = performance.now() - (playhead * playbackSpeed * 1000);
    }
  }, [initAudio, isPlaying, playhead, playbackSpeed]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setPlayhead(0);
    lastCriticalAnnounced.current = null;
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
    }
    setStatusMessage(`Reset to start of ${currentPreset.name}.`);
  }, [currentPreset.name]);

  // Incremental scrubbing engine
  const handleScrubStep = useCallback((delta) => {
    setIsPlaying(false);
    if (gainRef.current && audioCtxRef.current) {
      gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.02);
    }

    setPlayhead((prev) => {
      const nextProgress = Math.max(0, Math.min(1, prev + delta));
      const [minX, maxX] = currentPreset.domain;
      const scrubX = minX + nextProgress * (maxX - minX);
      const scrubY = currentPreset.fn(scrubX);

      const freq = getFreqFromY(scrubY, currentPreset.range);
      const pan = nextProgress * 2 - 1;

      playScrubProbe(freq, pan);
      const hit = checkCriticalPoints(nextProgress, currentPreset);

      setStatusMessage(`X: ${scrubX.toFixed(2)}, Y: ${scrubY.toFixed(2)}${hit ? ` — ${hit}` : ''}`);
      return nextProgress;
    });
  }, [currentPreset, getFreqFromY, playScrubProbe, checkCriticalPoints]);

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayToggle();
          break;
        case 'KeyR':
          e.preventDefault();
          handleReset();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleScrubStep(e.shiftKey ? -0.05 : -0.01);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleScrubStep(e.shiftKey ? 0.05 : 0.01);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayToggle, handleReset, handleScrubStep]);

  // Continuous sweep playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const animate = (timestamp) => {
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      let progress = elapsed / playbackSpeed;

      if (progress >= 1) {
        setIsPlaying(false);
        setPlayhead(1);
        if (gainRef.current && audioCtxRef.current) {
          gainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
        }
        setStatusMessage(`Sweep complete for ${currentPreset.name}.`);
        return;
      }

      setPlayhead(progress);

      const [minX, maxX] = currentPreset.domain;
      const currentX = minX + progress * (maxX - minX);
      const currentY = currentPreset.fn(currentX);

      if (audioCtxRef.current && soundEnabled && oscRef.current && gainRef.current) {
        const ctx = audioCtxRef.current;
        const targetFreq = getFreqFromY(currentY, currentPreset.range);
        const panValue = progress * 2 - 1;

        oscRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.02);

        if (pannerRef.current) {
          pannerRef.current.pan.setTargetAtTime(panValue, ctx.currentTime, 0.02);
        }

        gainRef.current.gain.setTargetAtTime(0.18, ctx.currentTime, 0.02);

        const hit = checkCriticalPoints(progress, currentPreset);
        if (hit) {
          setStatusMessage(`Mark: ${hit}`);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, currentPreset, soundEnabled, getFreqFromY, checkCriticalPoints]);

  const [minX, maxX] = currentPreset.domain;
  const currentActualX = minX + playhead * (maxX - minX);
  const currentActualY = currentPreset.fn(currentActualX);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '2rem 1.5rem', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Volume2 color="#38bdf8" size={32} />
              <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }}>SonifySTEM</h1>
            </div>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.95rem' }}>
              Spatial Web Audio Sonification for Screen Readers & STEM Accessibility
            </p>
          </div>
          <button
            onClick={() => {
              initAudio();
              setSoundEnabled(!soundEnabled);
              if (soundEnabled && gainRef.current && audioCtxRef.current) {
                gainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: soundEnabled ? '#1e293b' : '#ef4444',
              border: '1px solid #334155',
              color: '#f8fafc',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
            aria-label={soundEnabled ? "Mute audio" : "Unmute audio"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>{soundEnabled ? 'Audio On' : 'Muted'}</span>
          </button>
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{currentPreset.name}</h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>{currentPreset.description}</p>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
              <span style={{ color: '#38bdf8', fontSize: '1.15rem', fontWeight: 'bold' }}>
                X: {currentActualX.toFixed(2)} | Y: {currentActualY.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Scrub Track & Accessible Slider */}
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              id="scrub-slider"
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={playhead}
              aria-label="Curve scrub position"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(playhead * 100)}
              aria-valuetext={`X: ${currentActualX.toFixed(2)}, Y: ${currentActualY.toFixed(2)}`}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setIsPlaying(false);
                setPlayhead(val);
                const scrubX = minX + val * (maxX - minX);
                const scrubY = currentPreset.fn(scrubX);
                playScrubProbe(getFreqFromY(scrubY, currentPreset.range), val * 2 - 1);
                checkCriticalPoints(val, currentPreset);
                setStatusMessage(`X: ${scrubX.toFixed(2)}, Y: ${scrubY.toFixed(2)}`);
              }}
              style={{
                width: '100%',
                accentColor: '#38bdf8',
                cursor: 'pointer',
                height: '8px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              <span>Left Ear (-1.0)</span>
              <span>Center (0.0)</span>
              <span>Right Ear (+1.0)</span>
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
        <section 
          aria-live="assertive" 
          aria-atomic="true"
          style={{ 
            backgroundColor: '#090d16', 
            border: '1px solid #1e293b', 
            borderRadius: '0.5rem', 
            padding: '1rem', 
            fontSize: '0.9rem', 
            color: '#38bdf8',
            marginBottom: '1.5rem'
          }}
        >
          <strong>Assistive Console:</strong> {statusMessage}
        </section>

        {/* Hotkey Guide */}
        <section style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', padding: '1rem 1.25rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Keyboard size={18} color="#38bdf8" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Keyboard Navigation Shortcuts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <div><kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>Space</kbd> Play / Pause sweep</div>
            <div><kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>←</kbd> / <kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>→</kbd> Step 1% with audio probe</div>
            <div><kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>Shift</kbd> + <kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>←</kbd> / <kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>→</kbd> Jump 5%</div>
            <div><kbd style={{ backgroundColor: '#0f172a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569', color: '#f8fafc' }}>R</kbd> Reset cursor to 0</div>
          </div>
        </section>

      </div>
    </div>
  );
}