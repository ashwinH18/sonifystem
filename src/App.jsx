import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Keyboard, 
  Upload, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  SunMoon,
  Gauge
} from 'lucide-react';

const DEFAULT_PRESETS = {
  parabola: {
    name: "Quadratic (y = x²)",
    description: "Parabolic curve with a clear global minimum at x = 0.",
    fn: (x) => Math.pow(x, 2),
    domain: [-2, 2],
    range: [0, 4],
    criticalPoints: [{ x: 0, y: 0, label: "Global Minimum (0, 0)", type: "extrema" }]
  },
  cubic: {
    name: "Cubic (y = x³ - 3x)",
    description: "Features a local maximum, local minimum, and inflection point.",
    fn: (x) => Math.pow(x, 3) - 3 * x,
    domain: [-2.2, 2.2],
    range: [-3, 3],
    criticalPoints: [
      { x: -1.732, y: 0, label: "Root (x = -√3)", type: "root" },
      { x: -1, y: 2, label: "Local Maximum (-1, 2)", type: "extrema" },
      { x: 0, y: 0, label: "Root & Inflection Point (0, 0)", type: "root" },
      { x: 1, y: -2, label: "Local Minimum (1, -2)", type: "extrema" },
      { x: 1.732, y: 0, label: "Root (x = √3)", type: "root" }
    ]
  },
  sine: {
    name: "Harmonic Wave (y = sin(x))",
    description: "Periodic oscillation demonstrating rhythmic peaks and troughs.",
    fn: (x) => Math.sin(x),
    domain: [0, Math.PI * 2],
    range: [-1, 1],
    criticalPoints: [
      { x: 0, y: 0, label: "Root (0, 0)", type: "root" },
      { x: Math.PI / 2, y: 1, label: "Peak (π/2, 1)", type: "extrema" },
      { x: Math.PI, y: 0, label: "Root (π, 0)", type: "root" },
      { x: (3 * Math.PI) / 2, y: -1, label: "Trough (3π/2, -1)", type: "extrema" },
      { x: 2 * Math.PI, y: 0, label: "Root (2π, 0)", type: "root" }
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
      { x: 0.2, y: 0.15, label: "P-Wave (Atrial Depolarization)", type: "extrema" },
      { x: 0.35, y: -0.2, label: "Q-Wave", type: "extrema" },
      { x: 0.4, y: 1.2, label: "R-Peak (Ventricular Depolarization)", type: "extrema" },
      { x: 0.45, y: -0.35, label: "S-Wave", type: "extrema" },
      { x: 0.7, y: 0.25, label: "T-Wave (Repolarization)", type: "extrema" }
    ]
  }
};

function parseCustomDataset(rawText, datasetName = "Custom Dataset") {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error("Dataset input is empty.");

  let parsedPairs = [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      const dataArr = Array.isArray(json) ? json : (json.data || json.points || []);
      if (!Array.isArray(dataArr) || dataArr.length < 2) {
        throw new Error("JSON must contain an array with at least 2 coordinate points.");
      }

      parsedPairs = dataArr.map((item, idx) => {
        if (Array.isArray(item) && item.length >= 2) {
          const x = Number(item[0]);
          const y = Number(item[1]);
          if (isNaN(x) || isNaN(y)) throw new Error(`Invalid numeric coordinates at index ${idx}`);
          return { x, y };
        } else if (typeof item === 'object' && item !== null) {
          const x = Number(item.x ?? item.X ?? item.time ?? item[0]);
          const y = Number(item.y ?? item.Y ?? item.value ?? item[1]);
          if (isNaN(x) || isNaN(y)) throw new Error(`Missing numeric x/y at item ${idx}`);
          return { x, y };
        }
        throw new Error(`Unrecognized point structure at index ${idx}`);
      });
    } catch (err) {
      throw new Error(`JSON parse failure: ${err.message}`);
    }
  } else {
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV requires at least 2 rows of coordinates.");

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,\t;]+/).map(p => p.trim());
      if (parts.length < 2) continue;
      const x = Number(parts[0]);
      const y = Number(parts[1]);

      if (i === 0 && (isNaN(x) || isNaN(y))) continue;

      if (isNaN(x) || isNaN(y)) {
        throw new Error(`Invalid numeric values at CSV row ${i + 1}: "${lines[i]}"`);
      }
      parsedPairs.push({ x, y });
    }
  }

  if (parsedPairs.length < 2) {
    throw new Error("Could not extract at least 2 valid numeric (x, y) coordinates.");
  }

  parsedPairs.sort((a, b) => a.x - b.x);

  const minX = parsedPairs[0].x;
  const maxX = parsedPairs[parsedPairs.length - 1].x;
  if (minX === maxX) throw new Error("All points possess identical X values. Domain span must be > 0.");

  let minY = Infinity;
  let maxY = -Infinity;
  parsedPairs.forEach(p => {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const fn = (queryX) => {
    if (queryX <= minX) return parsedPairs[0].y;
    if (queryX >= maxX) return parsedPairs[parsedPairs.length - 1].y;

    let low = 0;
    let high = parsedPairs.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (parsedPairs[mid].x <= queryX) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const p0 = parsedPairs[Math.max(0, high)];
    const p1 = parsedPairs[Math.min(parsedPairs.length - 1, low)];
    if (p0.x === p1.x) return p0.y;

    const t = (queryX - p0.x) / (p1.x - p0.x);
    return p0.y + t * (p1.y - p0.y);
  };

  const criticalPoints = [];
  for (let i = 1; i < parsedPairs.length - 1; i++) {
    const prev = parsedPairs[i - 1].y;
    const curr = parsedPairs[i].y;
    const next = parsedPairs[i + 1].y;

    if (curr > prev && curr > next) {
      criticalPoints.push({ x: parsedPairs[i].x, y: curr, label: `Local Peak (${parsedPairs[i].x.toFixed(2)}, ${curr.toFixed(2)})`, type: 'extrema' });
    } else if (curr < prev && curr < next) {
      criticalPoints.push({ x: parsedPairs[i].x, y: curr, label: `Local Trough (${parsedPairs[i].x.toFixed(2)}, ${curr.toFixed(2)})`, type: 'extrema' });
    }
  }

  for (let i = 0; i < parsedPairs.length - 1; i++) {
    const y1 = parsedPairs[i].y;
    const y2 = parsedPairs[i + 1].y;
    if ((y1 <= 0 && y2 > 0) || (y1 >= 0 && y2 < 0)) {
      const rootX = parsedPairs[i].x + (-y1 / (y2 - y1 || 1)) * (parsedPairs[i + 1].x - parsedPairs[i].x);
      criticalPoints.push({ x: rootX, y: 0, label: `Root Crossing (y=0)`, type: 'root' });
    }
  }

  return {
    name: datasetName,
    description: `User Dataset: ${parsedPairs.length} samples on [${minX.toFixed(2)}, ${maxX.toFixed(2)}].`,
    fn,
    domain: [minX, maxX],
    range: [minY, maxY],
    criticalPoints: criticalPoints.slice(0, 8)
  };
}

export default function App() {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [activePresetKey, setActivePresetKey] = useState('cubic');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(4);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Select a preset, use Space to play, or Arrow keys to scrub.");
  
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [timbreModulationEnabled, setTimbreModulationEnabled] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customDataName, setCustomDataName] = useState("Economic Trend (CPI)");
  const [customDataInput, setCustomDataInput] = useState(
`year, value
2018, 2.4
2019, 1.8
2020, 1.2
2021, 4.7
2022, 8.0
2023, 4.1
2024, 2.9`
  );
  const [parseError, setParseError] = useState("");

  const currentPreset = presets[activePresetKey] || presets.cubic;

  const audioCtxRef = useRef(null);
  const sineOscRef = useRef(null);
  const sawOscRef = useRef(null);
  const sineGainRef = useRef(null);
  const sawGainRef = useRef(null);
  const masterGainRef = useRef(null);
  const pannerRef = useRef(null);
  
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastCriticalAnnounced = useRef(null);

  const theme = useMemo(() => {
    if (isHighContrast) {
      return {
        bg: '#000000',
        cardBg: '#000000',
        surfaceBg: '#080808',
        border: '#ffd600',
        borderWidth: '2px',
        textPrimary: '#ffd600',
        textSecondary: '#ffffff',
        textMuted: '#cccccc',
        accent: '#ffd600',
        accentContrastText: '#000000',
        curveStroke: '#ffd600',
        gridLines: '#262626',
        axisZero: '#ffffff',
        cursorLine: '#ffffff',
        cursorDot: '#00ffff',
        landmarkRoot: '#38bdf8',
        landmarkExtrema: '#ff2a2a',
        buttonSecondaryBg: '#000000',
        buttonSecondaryText: '#ffffff',
        consoleBg: '#000000',
        consoleText: '#ffd600',
        cardShadow: 'none',
        glowAccent: 'none'
      };
    }
    return {
      bg: '#080c14',
      cardBg: 'rgba(15, 23, 42, 0.72)',
      surfaceBg: 'rgba(11, 17, 32, 0.85)',
      border: 'rgba(255, 255, 255, 0.08)',
      borderHover: 'rgba(56, 189, 248, 0.4)',
      borderWidth: '1px',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      accent: '#38bdf8',
      accentContrastText: '#04101d',
      curveStroke: '#38bdf8',
      gridLines: 'rgba(255, 255, 255, 0.04)',
      axisZero: 'rgba(148, 163, 184, 0.25)',
      cursorLine: '#f8fafc',
      cursorDot: '#38bdf8',
      landmarkRoot: '#00f0ff',
      landmarkExtrema: '#f43f5e',
      buttonSecondaryBg: 'rgba(30, 41, 59, 0.75)',
      buttonSecondaryText: '#f1f5f9',
      consoleBg: 'rgba(6, 10, 19, 0.92)',
      consoleText: '#38bdf8',
      cardShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      glowAccent: '0 0 20px rgba(56, 189, 248, 0.35)'
    };
  }, [isHighContrast]);

  const getSlopeAt = useCallback((x, preset) => {
    const [minX, maxX] = preset.domain;
    const h = (maxX - minX) * 0.002;
    const yForward = preset.fn(x + h);
    const yBackward = preset.fn(x - h);
    return (yForward - yBackward) / (2 * h);
  }, []);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();

      const sineOsc = ctx.createOscillator();
      const sawOsc = ctx.createOscillator();
      const sineGain = ctx.createGain();
      const sawGain = ctx.createGain();
      const masterGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      sineOsc.type = 'sine';
      sawOsc.type = 'sawtooth';

      sineGain.gain.setValueAtTime(1.0, ctx.currentTime);
      sawGain.gain.setValueAtTime(0.0, ctx.currentTime);
      masterGain.gain.setValueAtTime(0.0, ctx.currentTime);

      sineOsc.connect(sineGain);
      sawOsc.connect(sawGain);

      sineGain.connect(masterGain);
      sawGain.connect(masterGain);

      if (panner) {
        masterGain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        masterGain.connect(ctx.destination);
      }

      sineOsc.start();
      sawOsc.start();

      audioCtxRef.current = ctx;
      sineOscRef.current = sineOsc;
      sawOscRef.current = sawOsc;
      sineGainRef.current = sineGain;
      sawGainRef.current = sawGain;
      masterGainRef.current = masterGain;
      pannerRef.current = panner;
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

  // FR-03: Resonant glass chime for roots (y = 0)
  const playRootChime = useCallback(() => {
    if (!audioCtxRef.current || !soundEnabled) return;
    try {
      const ctx = audioCtxRef.current;
      const fundamental = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gainFund = ctx.createGain();
      const gainOver = ctx.createGain();

      fundamental.type = 'sine';
      fundamental.frequency.setValueAtTime(880, ctx.currentTime); // A5 Bell

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(1320, ctx.currentTime); // Perfect fifth shimmer

      // Envelope: Fast attack, elongated shimmer decay
      gainFund.gain.setValueAtTime(0.001, ctx.currentTime);
      gainFund.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.015);
      gainFund.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

      gainOver.gain.setValueAtTime(0.001, ctx.currentTime);
      gainOver.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.012);
      gainOver.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);

      fundamental.connect(gainFund);
      overtone.connect(gainOver);
      gainFund.connect(ctx.destination);
      gainOver.connect(ctx.destination);

      fundamental.start(ctx.currentTime);
      overtone.start(ctx.currentTime);
      fundamental.stop(ctx.currentTime + 0.36);
      overtone.stop(ctx.currentTime + 0.36);
    } catch {}
  }, [soundEnabled]);

  // FR-03: Acoustic percussion woodblock tap for extrema (peaks/valleys)
  const playWoodblockTap = useCallback(() => {
    if (!audioCtxRef.current || !soundEnabled) return;
    try {
      const ctx = audioCtxRef.current;
      const oscPrimary = ctx.createOscillator();
      const oscSecondary = ctx.createOscillator();
      const blockGain = ctx.createGain();

      oscPrimary.type = 'sine';
      oscSecondary.type = 'sine';

      // Pitch sweep simulation of hollow wooden resonant chamber
      oscPrimary.frequency.setValueAtTime(820, ctx.currentTime);
      oscPrimary.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.045);

      oscSecondary.frequency.setValueAtTime(1150, ctx.currentTime);
      oscSecondary.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.035);

      // Snappy woodblock envelope: ultra-fast transient attack, sharp wooden drop
      blockGain.gain.setValueAtTime(0.001, ctx.currentTime);
      blockGain.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 0.002);
      blockGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

      oscPrimary.connect(blockGain);
      oscSecondary.connect(blockGain);
      blockGain.connect(ctx.destination);

      oscPrimary.start(ctx.currentTime);
      oscSecondary.start(ctx.currentTime);
      oscPrimary.stop(ctx.currentTime + 0.065);
      oscSecondary.stop(ctx.currentTime + 0.065);
    } catch {}
  }, [soundEnabled]);

  const dispatchEarcon = useCallback((type) => {
    if (type === 'root') {
      playRootChime();
    } else {
      playWoodblockTap();
    }
  }, [playRootChime, playWoodblockTap]);

  // Tactile scrubbing probe with slope-derived timbre
  const playScrubProbe = useCallback((freq, pan, slope) => {
    if (!soundEnabled) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      const sineOsc = ctx.createOscillator();
      const sawOsc = ctx.createOscillator();
      const sineGain = ctx.createGain();
      const sawGain = ctx.createGain();
      const probeMaster = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      sineOsc.type = 'sine';
      sawOsc.type = 'sawtooth';
      sineOsc.frequency.setValueAtTime(freq, ctx.currentTime);
      sawOsc.frequency.setValueAtTime(freq, ctx.currentTime);

      const absSlope = Math.abs(slope);
      const sawMix = timbreModulationEnabled ? Math.min(0.7, absSlope * 0.15) : 0;
      const sineMix = 1 - sawMix;

      sineGain.gain.setValueAtTime(sineMix, ctx.currentTime);
      sawGain.gain.setValueAtTime(sawMix, ctx.currentTime);

      probeMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      probeMaster.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.015);
      probeMaster.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

      sineOsc.connect(sineGain);
      sawOsc.connect(sawGain);
      sineGain.connect(probeMaster);
      sawGain.connect(probeMaster);

      if (panner) {
        panner.pan.setValueAtTime(pan, ctx.currentTime);
        probeMaster.connect(panner);
        panner.connect(ctx.destination);
      } else {
        probeMaster.connect(ctx.destination);
      }

      sineOsc.start(ctx.currentTime);
      sawOsc.start(ctx.currentTime);
      sineOsc.stop(ctx.currentTime + 0.15);
      sawOsc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, [initAudio, soundEnabled, timbreModulationEnabled]);

  const checkCriticalPoints = useCallback((progress, preset) => {
    const [minX, maxX] = preset.domain;
    let hit = null;

    preset.criticalPoints.forEach((pt) => {
      const ptProgress = (pt.x - minX) / (maxX - minX);
      if (Math.abs(progress - ptProgress) < 0.015) {
        if (lastCriticalAnnounced.current !== pt.label) {
          dispatchEarcon(pt.type);
          lastCriticalAnnounced.current = pt.label;
        }
        hit = pt;
      }
    });

    if (!hit) {
      lastCriticalAnnounced.current = null;
    }
    return hit ? hit.label : null;
  }, [dispatchEarcon]);

  const handlePlayToggle = useCallback(() => {
    initAudio();
    if (isPlaying) {
      setIsPlaying(false);
      if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
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
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
    }
    setStatusMessage(`Reset to start of ${currentPreset.name}.`);
  }, [currentPreset.name]);

  const handleScrubStep = useCallback((delta) => {
    setIsPlaying(false);
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.02);
    }

    setPlayhead((prev) => {
      const nextProgress = Math.max(0, Math.min(1, prev + delta));
      const [minX, maxX] = currentPreset.domain;
      const scrubX = minX + nextProgress * (maxX - minX);
      const scrubY = currentPreset.fn(scrubX);
      const slope = getSlopeAt(scrubX, currentPreset);

      const freq = getFreqFromY(scrubY, currentPreset.range);
      const pan = nextProgress * 2 - 1;

      playScrubProbe(freq, pan, slope);
      const landmarkHit = checkCriticalPoints(nextProgress, currentPreset);

      const slopeText = slope > 1.5 ? "Climbing Sharp" : slope < -1.5 ? "Plunging Steep" : Math.abs(slope) < 0.2 ? "Flat" : slope > 0 ? "Rising" : "Falling";
      setStatusMessage(`X: ${scrubX.toFixed(2)}, Y: ${scrubY.toFixed(2)}, Slope: ${slopeText}${landmarkHit ? ` — ${landmarkHit}` : ''}`);
      return nextProgress;
    });
  }, [currentPreset, getFreqFromY, getSlopeAt, playScrubProbe, checkCriticalPoints]);

  const toggleHighContrast = useCallback(() => {
    setIsHighContrast((prev) => {
      const next = !prev;
      setStatusMessage(`Contrast mode: ${next ? "WCAG AAA Yellow and Black" : "Standard Slate Dark"}.`);
      return next;
    });
  }, []);

  const handleDatasetSubmit = (e) => {
    e.preventDefault();
    setParseError("");

    try {
      const parsedModel = parseCustomDataset(customDataInput, customDataName.trim() || "Custom Ingestion");
      const customKey = `custom_${Date.now()}`;

      setPresets((prev) => ({
        ...prev,
        [customKey]: parsedModel
      }));

      handleReset();
      setActivePresetKey(customKey);
      setIsModalOpen(false);
      setStatusMessage(`Imported and active: "${parsedModel.name}".`);
    } catch (err) {
      setParseError(err.message);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isModalOpen) {
        if (e.code === 'Escape') setIsModalOpen(false);
        return;
      }

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
        case 'KeyH':
          e.preventDefault();
          toggleHighContrast();
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
  }, [handlePlayToggle, handleReset, handleScrubStep, toggleHighContrast, isModalOpen]);

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
        if (masterGainRef.current && audioCtxRef.current) {
          masterGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
        }
        setStatusMessage(`Sweep complete for ${currentPreset.name}.`);
        return;
      }

      setPlayhead(progress);

      const [minX, maxX] = currentPreset.domain;
      const currentX = minX + progress * (maxX - minX);
      const currentY = currentPreset.fn(currentX);
      const slope = getSlopeAt(currentX, currentPreset);

      if (audioCtxRef.current && soundEnabled && sineOscRef.current && sawOscRef.current && masterGainRef.current) {
        const ctx = audioCtxRef.current;
        const targetFreq = getFreqFromY(currentY, currentPreset.range);
        const panValue = progress * 2 - 1;

        sineOscRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.02);
        sawOscRef.current.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.02);

        if (pannerRef.current) {
          pannerRef.current.pan.setTargetAtTime(panValue, ctx.currentTime, 0.02);
        }

        const absSlope = Math.abs(slope);
        const sawMix = timbreModulationEnabled ? Math.min(0.7, absSlope * 0.15) : 0;
        const sineMix = 1 - sawMix;

        sineGainRef.current.gain.setTargetAtTime(sineMix, ctx.currentTime, 0.03);
        sawGainRef.current.gain.setTargetAtTime(sawMix, ctx.currentTime, 0.03);
        masterGainRef.current.gain.setTargetAtTime(0.18, ctx.currentTime, 0.02);

        const landmarkHit = checkCriticalPoints(progress, currentPreset);
        if (landmarkHit) {
          setStatusMessage(`Mark: ${landmarkHit}`);
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, currentPreset, soundEnabled, getFreqFromY, getSlopeAt, timbreModulationEnabled, checkCriticalPoints]);

  const { points, minY, maxY } = useMemo(() => {
    const numSamples = 200;
    const [minX, maxX] = currentPreset.domain;
    const [rangeMin, rangeMax] = currentPreset.range;
    const pts = [];

    for (let i = 0; i <= numSamples; i++) {
      const norm = i / numSamples;
      const x = minX + norm * (maxX - minX);
      const y = currentPreset.fn(x);
      pts.push({ norm, x, y });
    }

    return { points: pts, minY: rangeMin, maxY: rangeMax };
  }, [currentPreset]);

  const [minX, maxX] = currentPreset.domain;
  const currentActualX = minX + playhead * (maxX - minX);
  const currentActualY = currentPreset.fn(currentActualX);
  const currentSlope = getSlopeAt(currentActualX, currentPreset);
  const currentPan = playhead * 2 - 1;
  const currentFreq = getFreqFromY(currentActualY, currentPreset.range);

  const svgWidth = 800;
  const svgHeight = 260;
  const paddingX = 40;
  const paddingY = 24;
  const usableWidth = svgWidth - paddingX * 2;
  const usableHeight = svgHeight - paddingY * 2;

  const getYPos = (y) => {
    const norm = (y - minY) / (maxY - minY || 1);
    return (svgHeight - paddingY) - norm * usableHeight;
  };

  const getXPos = (progress) => paddingX + progress * usableWidth;

  const areaPath = useMemo(() => {
    if (!points || points.length === 0) return '';
    const lineD = points.reduce((acc, pt, idx) => {
      const px = getXPos(pt.norm);
      const py = getYPos(pt.y);
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
    }, '');
    const baseY = svgHeight - paddingY;
    return `${lineD} L ${getXPos(1)} ${baseY} L ${getXPos(0)} ${baseY} Z`;
  }, [points, usableWidth, usableHeight, minY, maxY]);

  return (
    <div 
      className={`sonify-app-root ${isHighContrast ? 'high-contrast-mode' : ''}`}
      style={{ 
        minHeight: '100vh', 
        backgroundColor: theme.bg, 
        color: theme.textPrimary, 
        padding: '2.5rem 1.5rem', 
        fontFamily: 'var(--font-sans, system-ui, sans-serif)', 
        transition: 'background-color 0.25s ease' 
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ 
          marginBottom: '2rem', 
          borderBottom: `${theme.borderWidth} solid ${theme.border}`, 
          paddingBottom: '1.75rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1.25rem' 
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.4rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: isHighContrast ? 'transparent' : 'rgba(56, 189, 248, 0.12)',
                border: isHighContrast ? `2px solid ${theme.accent}` : '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: isHighContrast ? 'none' : '0 0 15px rgba(56, 189, 248, 0.2)'
              }}>
                <Volume2 color={theme.accent} size={24} />
              </div>
              <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0, color: theme.textPrimary, letterSpacing: '-0.03em' }}>
                SonifySTEM
              </h1>
            </div>
            <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.92rem', fontWeight: 500 }}>
              Deterministic Spatial Audio & Earcon Visualizer for STEM Accessibility
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="action-button"
              onClick={() => {
                setTimbreModulationEnabled(!timbreModulationEnabled);
                setStatusMessage(`Slope Timbre: ${!timbreModulationEnabled ? 'Enabled' : 'Disabled'}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: timbreModulationEnabled ? (isHighContrast ? '#111100' : 'rgba(56, 189, 248, 0.15)') : theme.surfaceBg,
                border: `${theme.borderWidth} solid ${timbreModulationEnabled ? theme.accent : theme.border}`,
                color: timbreModulationEnabled ? theme.accent : theme.textSecondary,
                padding: '0.55rem 0.95rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: timbreModulationEnabled && !isHighContrast ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none'
              }}
              aria-pressed={timbreModulationEnabled}
              aria-label="Toggle slope timbre modulation based on derivative"
            >
              <Gauge size={16} />
              <span>{timbreModulationEnabled ? 'Slope Timbre: ON' : 'Slope Timbre: OFF'}</span>
            </button>

            <button
              className="action-button"
              onClick={toggleHighContrast}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isHighContrast ? theme.accent : theme.surfaceBg,
                border: `${theme.borderWidth} solid ${isHighContrast ? theme.accent : theme.border}`,
                color: isHighContrast ? theme.accentContrastText : theme.textPrimary,
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
              aria-pressed={isHighContrast}
              aria-label="Toggle WCAG AAA Yellow and Black High-Contrast Mode"
            >
              <SunMoon size={18} />
              <span>{isHighContrast ? 'AAA ON' : 'High Contrast'}</span>
            </button>

            <button
              className="action-button"
              onClick={() => {
                setParseError("");
                setIsModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isHighContrast ? theme.accent : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                background: isHighContrast ? theme.accent : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                border: `${theme.borderWidth} solid ${isHighContrast ? theme.accent : 'rgba(56, 189, 248, 0.4)'}`,
                color: theme.accentContrastText,
                padding: '0.55rem 1.1rem',
                borderRadius: '0.5rem',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: isHighContrast ? 'none' : '0 0 15px rgba(56, 189, 248, 0.3)'
              }}
              aria-haspopup="dialog"
            >
              <Upload size={18} />
              <span>Import Data</span>
            </button>

            <button
              className="action-button"
              onClick={() => {
                initAudio();
                setSoundEnabled(!soundEnabled);
                if (soundEnabled && masterGainRef.current && audioCtxRef.current) {
                  masterGainRef.current.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: soundEnabled ? (isHighContrast ? '#000000' : theme.surfaceBg) : '#e11d48',
                border: `${theme.borderWidth} solid ${soundEnabled ? theme.border : '#e11d48'}`,
                color: soundEnabled ? theme.textPrimary : '#ffffff',
                padding: '0.55rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: !soundEnabled ? '0 0 12px rgba(225, 29, 72, 0.4)' : 'none'
              }}
              aria-label={soundEnabled ? "Mute audio" : "Unmute audio"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span>{soundEnabled ? 'Audio On' : 'Muted'}</span>
            </button>
          </div>
        </header>

        {/* Preset Selector */}
        <section style={{ marginBottom: '1.75rem' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.78rem', 
            fontWeight: 800, 
            color: theme.textSecondary, 
            marginBottom: '0.75rem', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em' 
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: theme.accent }} />
            Select Mathematical Model / Dataset
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
            {Object.entries(presets).map(([key, data]) => {
              const isSelected = activePresetKey === key;
              return (
                <button
                  key={key}
                  className="preset-button glass-panel"
                  onClick={() => {
                    handleReset();
                    setActivePresetKey(key);
                    setStatusMessage(`Loaded: ${data.name}`);
                  }}
                  style={{
                    padding: '0.85rem 1.15rem',
                    borderRadius: '0.75rem',
                    border: isSelected 
                      ? (isHighContrast ? '2px solid #ffd600' : '2px solid #38bdf8') 
                      : `${theme.borderWidth} solid ${theme.border}`,
                    backgroundColor: isSelected 
                      ? (isHighContrast ? '#111100' : 'rgba(56, 189, 248, 0.12)') 
                      : (isHighContrast ? '#000000' : theme.cardBg),
                    color: isSelected ? theme.accent : theme.textPrimary,
                    textAlign: 'left',
                    cursor: 'pointer',
                    position: 'relative',
                    boxShadow: isSelected && !isHighContrast ? '0 0 18px rgba(56, 189, 248, 0.22), inset 0 0 10px rgba(56, 189, 248, 0.08)' : 'none'
                  }}
                >
                  <div style={{ fontWeight: isSelected ? 800 : 600, fontSize: '0.95rem' }}>{data.name}</div>
                  {key.startsWith('custom_') && (
                    <span style={{ 
                      fontSize: '0.62rem', 
                      backgroundColor: theme.accent, 
                      color: theme.accentContrastText, 
                      fontWeight: 800, 
                      letterSpacing: '0.05em',
                      padding: '2px 7px', 
                      borderRadius: '9999px', 
                      position: 'absolute', 
                      top: '10px', 
                      right: '10px' 
                    }}>
                      CUSTOM
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Main Display, Graph & Controls */}
        <main 
          className="glass-panel"
          style={{ 
            backgroundColor: theme.cardBg, 
            borderRadius: '1rem', 
            padding: '1.75rem', 
            border: `${theme.borderWidth} solid ${theme.border}`, 
            boxShadow: theme.cardShadow,
            marginBottom: '1.75rem' 
          }}
        >
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                {currentPreset.name}
              </h2>
              <p style={{ fontSize: '0.88rem', color: theme.textSecondary, margin: 0, fontWeight: 500 }}>
                {currentPreset.description}
              </p>
            </div>
            <div style={{ 
              textAlign: 'right', 
              fontFamily: 'var(--font-mono, monospace)',
              backgroundColor: isHighContrast ? '#000000' : theme.surfaceBg,
              border: `${theme.borderWidth} solid ${theme.border}`,
              padding: '0.45rem 0.95rem',
              borderRadius: '0.5rem',
              boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.4)'
            }}>
              <span style={{ color: theme.accent, fontSize: '1.15rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                X: {currentActualX.toFixed(2)} | Y: {currentActualY.toFixed(2)}
              </span>
            </div>
          </div>

          {/* SVG Visualizer Canvas */}
          <div style={{ 
            backgroundColor: theme.surfaceBg, 
            borderRadius: '0.75rem', 
            border: `${theme.borderWidth} solid ${theme.border}`, 
            padding: '0.75rem', 
            marginBottom: '1.5rem',
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5)'
          }}>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <linearGradient id="sonifyCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
                <linearGradient id="sonifyAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isHighContrast ? "transparent" : "rgba(56, 189, 248, 0.22)"} />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
                <filter id="sonifyCurveGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* Grid Lines */}
              <line x1={paddingX} y1={paddingY} x2={paddingX} y2={svgHeight - paddingY} stroke={theme.gridLines} strokeWidth="1.5" />
              <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke={theme.gridLines} strokeWidth="1.5" />

              {minY < 0 && maxY > 0 && (
                <line
                  x1={paddingX}
                  y1={getYPos(0)}
                  x2={svgWidth - paddingX}
                  y2={getYPos(0)}
                  stroke={theme.axisZero}
                  strokeDasharray="6 4"
                  strokeWidth="1.5"
                />
              )}

              {/* Radiant Area Path Under Curve */}
              {!isHighContrast && areaPath && (
                <path
                  d={areaPath}
                  fill="url(#sonifyAreaGrad)"
                />
              )}

              {/* Sonified Function Curve */}
              <path
                d={points.reduce((acc, pt, idx) => {
                  const px = getXPos(pt.norm);
                  const py = getYPos(pt.y);
                  return `${acc} ${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
                }, '')}
                fill="none"
                stroke={isHighContrast ? theme.curveStroke : "url(#sonifyCurveGrad)"}
                strokeWidth={isHighContrast ? "4.5" : "3.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={isHighContrast ? undefined : "url(#sonifyCurveGlow)"}
              />

              {/* FR-03 Critical Landmark Nodes (Cyan for Roots, Pink/Red for Extrema) */}
              {currentPreset.criticalPoints.map((pt, i) => {
                const ptNorm = (pt.x - minX) / (maxX - minX);
                const px = getXPos(ptNorm);
                const py = getYPos(pt.y);
                const isRoot = pt.type === 'root';
                return (
                  <g key={i}>
                    {!isHighContrast && (
                      <circle
                        cx={px}
                        cy={py}
                        r="9"
                        fill={isRoot ? "rgba(0, 240, 255, 0.2)" : "rgba(244, 63, 94, 0.2)"}
                      />
                    )}
                    <circle
                      cx={px}
                      cy={py}
                      r={isHighContrast ? "7" : "5.5"}
                      fill={isRoot ? theme.landmarkRoot : theme.landmarkExtrema}
                      stroke="#000000"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

              {/* Playhead Cursor Line */}
              <line
                x1={getXPos(playhead)}
                y1={paddingY}
                x2={getXPos(playhead)}
                y2={svgHeight - paddingY}
                stroke={theme.cursorLine}
                strokeWidth="2"
                strokeDasharray="5 3"
              />

              {/* Playhead Cursor Dot with Glow */}
              {!isHighContrast && (
                <circle
                  cx={getXPos(playhead)}
                  cy={getYPos(currentActualY)}
                  r="13"
                  fill="rgba(56, 189, 248, 0.25)"
                  className="cursor-node"
                />
              )}
              <circle
                cx={getXPos(playhead)}
                cy={getYPos(currentActualY)}
                r={isHighContrast ? "9" : "6.5"}
                fill={theme.cursorDot}
                stroke="#080c14"
                strokeWidth="2.5"
              />
            </svg>
          </div>

          {/* Telemetry Grid with Earcon Landmark Guide */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <div className="telemetry-card" style={{ backgroundColor: theme.surfaceBg, padding: '0.85rem 1rem', borderRadius: '0.5rem', border: `${theme.borderWidth} solid ${theme.border}`, borderTop: isHighContrast ? undefined : '2px solid rgba(56, 189, 248, 0.5)' }}>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>X Coord</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.25rem', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>{currentActualX.toFixed(2)}</div>
            </div>
            <div className="telemetry-card" style={{ backgroundColor: theme.surfaceBg, padding: '0.85rem 1rem', borderRadius: '0.5rem', border: `${theme.borderWidth} solid ${theme.border}`, borderTop: isHighContrast ? undefined : '2px solid rgba(56, 189, 248, 0.5)' }}>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>Y Value</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.25rem', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>{currentActualY.toFixed(2)}</div>
            </div>
            <div className="telemetry-card" style={{ backgroundColor: theme.surfaceBg, padding: '0.85rem 1rem', borderRadius: '0.5rem', border: `${theme.borderWidth} solid ${theme.border}`, borderTop: isHighContrast ? undefined : '2px solid rgba(244, 63, 94, 0.5)' }}>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>Slope (dy/dx)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: Math.abs(currentSlope) > 1.5 ? '#f43f5e' : theme.accent, marginTop: '0.25rem', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>
                {currentSlope.toFixed(2)}
              </div>
            </div>
            <div className="telemetry-card" style={{ backgroundColor: theme.surfaceBg, padding: '0.85rem 1rem', borderRadius: '0.5rem', border: `${theme.borderWidth} solid ${theme.border}`, borderTop: isHighContrast ? undefined : '2px solid rgba(129, 140, 248, 0.5)' }}>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>Pitch (Hz)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.25rem', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(currentFreq)} Hz</div>
            </div>
            <div className="telemetry-card" style={{ backgroundColor: theme.surfaceBg, padding: '0.85rem 1rem', borderRadius: '0.5rem', border: `${theme.borderWidth} solid ${theme.border}`, borderTop: isHighContrast ? undefined : '2px solid rgba(16, 185, 129, 0.5)' }}>
              <div style={{ fontSize: '0.72rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>Spatial Pan</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.25rem', fontFamily: 'var(--font-mono, monospace)', fontVariantNumeric: 'tabular-nums' }}>
                {currentPan <= -0.1 ? `${Math.round(Math.abs(currentPan) * 100)}% L` : currentPan >= 0.1 ? `${Math.round(currentPan * 100)}% R` : 'Center'}
              </div>
            </div>
          </div>

          {/* Accessible Scrubber Slider */}
          <div style={{ marginBottom: '1.75rem' }}>
            <input
              id="scrub-slider"
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={playhead}
              aria-label="Curve scrub position slider"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.round(playhead * 100)}
              aria-valuetext={`X: ${currentActualX.toFixed(2)}, Y: ${currentActualY.toFixed(2)}, Slope: ${currentSlope.toFixed(2)}`}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setIsPlaying(false);
                setPlayhead(val);
                const scrubX = minX + val * (maxX - minX);
                const scrubY = currentPreset.fn(scrubX);
                const slope = getSlopeAt(scrubX, currentPreset);
                playScrubProbe(getFreqFromY(scrubY, currentPreset.range), val * 2 - 1, slope);
                checkCriticalPoints(val, currentPreset);
                setStatusMessage(`X: ${scrubX.toFixed(2)}, Y: ${scrubY.toFixed(2)}, Slope: ${slope.toFixed(2)}`);
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginTop: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                Left Ear (-1.0)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#818cf8' }} />
                Center (0.0)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c084fc' }} />
                Right Ear (+1.0)
              </span>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <button
              className="action-button"
              onClick={handlePlayToggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                backgroundColor: isPlaying ? '#e11d48' : (isHighContrast ? theme.accent : undefined),
                background: isPlaying ? 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' : (isHighContrast ? theme.accent : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'),
                color: isPlaying ? '#ffffff' : theme.accentContrastText,
                padding: '0.7rem 1.45rem',
                borderRadius: '0.5rem',
                border: `${theme.borderWidth} solid ${isPlaying ? '#e11d48' : theme.border}`,
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: isHighContrast ? 'none' : isPlaying ? '0 0 20px rgba(225, 29, 72, 0.4)' : '0 0 20px rgba(56, 189, 248, 0.4)'
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'Pause' : 'Sonify Curve'}
            </button>

            <button
              className="action-button"
              onClick={handleReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: theme.buttonSecondaryBg,
                color: theme.buttonSecondaryText,
                padding: '0.7rem 1.15rem',
                borderRadius: '0.5rem',
                border: `${theme.borderWidth} solid ${theme.border}`,
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} />
              Reset
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: 'auto' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.textSecondary }}>Duration:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                style={{
                  backgroundColor: isHighContrast ? '#000000' : theme.surfaceBg,
                  color: theme.textPrimary,
                  border: `${theme.borderWidth} solid ${theme.border}`,
                  borderRadius: '0.375rem',
                  padding: '0.45rem 0.75rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
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
            backgroundColor: theme.consoleBg, 
            border: `${theme.borderWidth} solid ${theme.border}`, 
            borderRadius: '0.65rem', 
            padding: '1.1rem 1.25rem', 
            fontSize: '0.92rem', 
            color: theme.consoleText,
            marginBottom: '1.75rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono, monospace)',
            display: 'flex',
            alignItems: 'center',
            boxShadow: 'inset 0 1px 4px rgba(0, 0, 0, 0.5)'
          }}
        >
          <span className="status-beacon" style={{ marginRight: '0.85rem' }} />
          <div>
            <span style={{ color: theme.textSecondary, marginRight: '0.5rem' }}>[Console]</span>
            <strong>{statusMessage}</strong>
          </div>
        </section>

        {/* Acoustic Landmarks Legend & Hotkey Guide */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* FR-03 Earcon Sound Guide */}
          <section className="glass-panel" style={{ backgroundColor: theme.cardBg, borderRadius: '0.65rem', padding: '1.15rem 1.35rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Volume2 size={18} color={theme.accent} />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: theme.textPrimary }}>Acoustic Earcon Legend</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem', color: theme.textSecondary }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: theme.landmarkRoot, boxShadow: isHighContrast ? 'none' : '0 0 8px #00f0ff' }}></span>
                <span><strong>Root (y = 0):</strong> Shimmering metallic bell chime (880 Hz)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: theme.landmarkExtrema, boxShadow: isHighContrast ? 'none' : '0 0 8px #f43f5e' }}></span>
                <span><strong>Extrema (Peaks & Valleys):</strong> Percussive woodblock knock</span>
              </div>
            </div>
          </section>

          {/* Hotkey Guide */}
          <section className="glass-panel" style={{ backgroundColor: theme.cardBg, borderRadius: '0.65rem', padding: '1.15rem 1.35rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Keyboard size={18} color={theme.accent} />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: theme.textPrimary }}>Shortcuts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', fontSize: '0.82rem', color: theme.textSecondary }}>
              <div><kbd className="tech-kbd">Space</kbd> Play / Pause</div>
              <div><kbd className="tech-kbd">←</kbd>/<kbd className="tech-kbd">→</kbd> Scrub 1%</div>
              <div><kbd className="tech-kbd">Shift</kbd>+<kbd className="tech-kbd">←</kbd>/<kbd className="tech-kbd">→</kbd> 5%</div>
              <div><kbd className="tech-kbd">H</kbd> High Contrast</div>
              <div><kbd className="tech-kbd">R</kbd> Reset to 0</div>
            </div>
          </section>
        </div>

      </div>

      {/* FR-07 Modal Dialog */}
      {isModalOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-title"
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div 
            className="modal-content glass-panel"
            style={{
              backgroundColor: theme.cardBg,
              border: `2px solid ${theme.border}`,
              borderRadius: '0.85rem',
              width: '100%',
              maxWidth: '540px',
              padding: '1.75rem',
              boxShadow: '0 25px 45px -10px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText color={theme.accent} size={22} />
                <h3 id="modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: theme.textPrimary, letterSpacing: '-0.02em' }}>
                  Import Dataset (CSV / JSON)
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDatasetSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.4rem' }}>
                  Dataset Name
                </label>
                <input
                  type="text"
                  value={customDataName}
                  onChange={(e) => setCustomDataName(e.target.value)}
                  placeholder="e.g. Inflation Rate 2018-2024"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: theme.surfaceBg,
                    border: `${theme.borderWidth} solid ${theme.border}`,
                    borderRadius: '0.45rem',
                    color: theme.textPrimary,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    outline: 'none',
                    fontFamily: 'var(--font-sans, sans-serif)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: theme.textSecondary }}>
                    Raw Data (2-Column CSV or JSON Array)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomDataInput(
`[
  {"x": 0, "y": 0},
  {"x": 1, "y": 3},
  {"x": 2, "y": -1},
  {"x": 3, "y": 4},
  {"x": 4, "y": 1}
]`
                      );
                    }}
                    style={{ background: 'none', border: 'none', color: theme.accent, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Paste JSON Example
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={customDataInput}
                  onChange={(e) => setCustomDataInput(e.target.value)}
                  placeholder="x, y&#10;0, 1.2&#10;1, 2.5&#10;2, 3.8"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: theme.surfaceBg,
                    border: `${theme.borderWidth} solid ${theme.border}`,
                    borderRadius: '0.45rem',
                    color: theme.textPrimary,
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>

              {parseError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#450a0a', border: '1px solid #ff2a2a', borderRadius: '0.45rem', padding: '0.7rem', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  <AlertCircle size={16} color="#ff2a2a" />
                  <span>{parseError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="action-button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.65rem 1.1rem',
                    backgroundColor: theme.buttonSecondaryBg,
                    color: theme.buttonSecondaryText,
                    border: `${theme.borderWidth} solid ${theme.border}`,
                    borderRadius: '0.45rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.65rem 1.35rem',
                    backgroundColor: isHighContrast ? theme.accent : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                    background: isHighContrast ? theme.accent : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                    color: theme.accentContrastText,
                    border: 'none',
                    borderRadius: '0.45rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: isHighContrast ? 'none' : '0 0 15px rgba(56, 189, 248, 0.4)'
                  }}
                >
                  <CheckCircle2 size={16} />
                  Load & Sonify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}