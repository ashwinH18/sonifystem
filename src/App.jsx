import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
      criticalPoints.push({ x: parsedPairs[i].x, y: curr, label: `Local Peak (${parsedPairs[i].x.toFixed(2)}, ${curr.toFixed(2)})` });
    } else if (curr < prev && curr < next) {
      criticalPoints.push({ x: parsedPairs[i].x, y: curr, label: `Local Trough (${parsedPairs[i].x.toFixed(2)}, ${curr.toFixed(2)})` });
    }
  }

  for (let i = 0; i < parsedPairs.length - 1; i++) {
    const y1 = parsedPairs[i].y;
    const y2 = parsedPairs[i + 1].y;
    if ((y1 <= 0 && y2 > 0) || (y1 >= 0 && y2 < 0)) {
      const rootX = parsedPairs[i].x + (-y1 / (y2 - y1 || 1)) * (parsedPairs[i + 1].x - parsedPairs[i].x);
      criticalPoints.push({ x: rootX, y: 0, label: `Root Crossing (y=0)` });
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
  
  // FR-06: High-Contrast AAA Mode
  const [isHighContrast, setIsHighContrast] = useState(false);

  // FR-08: Slope Timbre Modulation Toggle
  const [timbreModulationEnabled, setTimbreModulationEnabled] = useState(true);

  // FR-07: Ingestion Modal
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

  // Web Audio Graph References (FR-08: Dual Osc for Sine & Saw cross-fade)
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

  // Theme palettes
  const theme = useMemo(() => {
    if (isHighContrast) {
      return {
        bg: '#000000',
        cardBg: '#000000',
        surfaceBg: '#050505',
        border: '#ffd600',
        borderWidth: '2px',
        textPrimary: '#ffd600',
        textSecondary: '#ffffff',
        accent: '#ffd600',
        accentContrastText: '#000000',
        curveStroke: '#ffd600',
        gridLines: '#333333',
        axisZero: '#ffffff',
        cursorLine: '#ffffff',
        cursorDot: '#00ffff',
        landmarkDot: '#ff2a2a',
        buttonSecondaryBg: '#000000',
        buttonSecondaryText: '#ffffff',
        consoleBg: '#000000',
        consoleText: '#ffd600'
      };
    }
    return {
      bg: '#0f172a',
      cardBg: '#1e293b',
      surfaceBg: '#0f172a',
      border: '#334155',
      borderWidth: '1px',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      accent: '#38bdf8',
      accentContrastText: '#0f172a',
      curveStroke: '#38bdf8',
      gridLines: '#1e293b',
      axisZero: '#475569',
      cursorLine: '#ffffff',
      cursorDot: '#facc15',
      landmarkDot: '#f43f5e',
      buttonSecondaryBg: '#334155',
      buttonSecondaryText: '#ffffff',
      consoleBg: '#090d16',
      consoleText: '#38bdf8'
    };
  }, [isHighContrast]);

  // Compute numerical derivative dy/dx using symmetric difference
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
    } catch {}
  }, [soundEnabled]);

  // Scrub probe with slope-derived harmonic timbre
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

      // FR-08 Slope weight (sawtooth intensity scales with |dy/dx|)
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
      const hit = checkCriticalPoints(nextProgress, currentPreset);

      const slopeText = slope > 1.5 ? "Climbing Sharp" : slope < -1.5 ? "Plunging Steep" : Math.abs(slope) < 0.2 ? "Flat" : slope > 0 ? "Rising" : "Falling";
      setStatusMessage(`X: ${scrubX.toFixed(2)}, Y: ${scrubY.toFixed(2)}, Slope: ${slopeText}${hit ? ` — ${hit}` : ''}`);
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

  // Continuous animation loop with FR-08 dynamic timbre crossfade
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

        // FR-08 Crossfade based on slope steepness
        const absSlope = Math.abs(slope);
        const sawMix = timbreModulationEnabled ? Math.min(0.7, absSlope * 0.15) : 0;
        const sineMix = 1 - sawMix;

        sineGainRef.current.gain.setTargetAtTime(sineMix, ctx.currentTime, 0.03);
        sawGainRef.current.gain.setTargetAtTime(sawMix, ctx.currentTime, 0.03);
        masterGainRef.current.gain.setTargetAtTime(0.18, ctx.currentTime, 0.02);

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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.textPrimary, padding: '2rem 1.5rem', fontFamily: 'sans-serif', transition: 'background-color 0.15s ease' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ marginBottom: '2rem', borderBottom: `${theme.borderWidth} solid ${theme.border}`, paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Volume2 color={theme.accent} size={32} />
              <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: theme.textPrimary }}>SonifySTEM</h1>
            </div>
            <p style={{ color: theme.textSecondary, margin: 0, fontSize: '0.95rem' }}>
              Deterministic Spatial Audio & Timbre Visualizer for STEM Accessibility
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* FR-08 Timbre Modulation Toggle */}
            <button
              onClick={() => {
                setTimbreModulationEnabled(!timbreModulationEnabled);
                setStatusMessage(`Slope Timbre Modulation: ${!timbreModulationEnabled ? 'Enabled' : 'Disabled'}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: timbreModulationEnabled ? (isHighContrast ? '#111100' : '#1e293b') : theme.surfaceBg,
                border: `${theme.borderWidth} solid ${timbreModulationEnabled ? theme.accent : theme.border}`,
                color: timbreModulationEnabled ? theme.accent : theme.textSecondary,
                padding: '0.5rem 0.85rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              aria-pressed={timbreModulationEnabled}
              aria-label="Toggle slope timbre modulation based on derivative"
            >
              <Gauge size={16} />
              <span>{timbreModulationEnabled ? 'Slope Timbre: ON' : 'Slope Timbre: OFF'}</span>
            </button>

            {/* FR-06 High Contrast Toggle */}
            <button
              onClick={toggleHighContrast}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isHighContrast ? theme.accent : theme.surfaceBg,
                border: `${theme.borderWidth} solid ${theme.border}`,
                color: isHighContrast ? theme.accentContrastText : theme.textPrimary,
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              aria-pressed={isHighContrast}
              aria-label="Toggle WCAG AAA Yellow and Black High-Contrast Mode"
            >
              <SunMoon size={18} />
              <span>{isHighContrast ? 'AAA ON' : 'High Contrast'}</span>
            </button>

            <button
              onClick={() => {
                setParseError("");
                setIsModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: theme.accent,
                border: `${theme.borderWidth} solid ${theme.border}`,
                color: theme.accentContrastText,
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              aria-haspopup="dialog"
            >
              <Upload size={18} />
              <span>Import Data</span>
            </button>

            <button
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
                backgroundColor: soundEnabled ? theme.surfaceBg : '#ef4444',
                border: `${theme.borderWidth} solid ${soundEnabled ? theme.border : '#ef4444'}`,
                color: soundEnabled ? theme.textPrimary : '#ffffff',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              aria-label={soundEnabled ? "Mute audio" : "Unmute audio"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span>{soundEnabled ? 'Audio On' : 'Muted'}</span>
            </button>
          </div>
        </header>

        {/* Preset Selector */}
        <section style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select Mathematical Model / Dataset
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {Object.entries(presets).map(([key, data]) => {
              const isSelected = activePresetKey === key;
              return (
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
                    border: isSelected ? `3px solid ${theme.accent}` : `${theme.borderWidth} solid ${theme.border}`,
                    backgroundColor: isSelected ? (isHighContrast ? '#111100' : '#1e293b') : theme.cardBg,
                    color: isSelected ? theme.accent : theme.textPrimary,
                    textAlign: 'left',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontWeight: isSelected ? 800 : 600 }}>{data.name}</div>
                  {key.startsWith('custom_') && (
                    <span style={{ fontSize: '0.65rem', backgroundColor: theme.accent, color: theme.accentContrastText, fontWeight: 800, padding: '2px 6px', borderRadius: '4px', position: 'absolute', top: '8px', right: '8px' }}>
                      CUSTOM
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Main Display, Graph & Controls */}
        <main style={{ backgroundColor: theme.cardBg, borderRadius: '0.75rem', padding: '1.5rem', border: `${theme.borderWidth} solid ${theme.border}`, marginBottom: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: theme.textPrimary }}>{currentPreset.name}</h2>
              <p style={{ fontSize: '0.875rem', color: theme.textSecondary, margin: 0 }}>{currentPreset.description}</p>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
              <span style={{ color: theme.accent, fontSize: '1.25rem', fontWeight: 800 }}>
                X: {currentActualX.toFixed(2)} | Y: {currentActualY.toFixed(2)}
              </span>
            </div>
          </div>

          {/* SVG Visualizer Canvas */}
          <div style={{ backgroundColor: theme.surfaceBg, borderRadius: '0.5rem', border: `${theme.borderWidth} solid ${theme.border}`, padding: '0.5rem', marginBottom: '1.25rem' }}>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <line x1={paddingX} y1={paddingY} x2={paddingX} y2={svgHeight - paddingY} stroke={theme.gridLines} strokeWidth="2" />
              <line x1={paddingX} y1={svgHeight - paddingY} x2={svgWidth - paddingX} y2={svgHeight - paddingY} stroke={theme.gridLines} strokeWidth="2" />

              {minY < 0 && maxY > 0 && (
                <line
                  x1={paddingX}
                  y1={getYPos(0)}
                  x2={svgWidth - paddingX}
                  y2={getYPos(0)}
                  stroke={theme.axisZero}
                  strokeDasharray="5 5"
                  strokeWidth="2"
                />
              )}

              <path
                d={points.reduce((acc, pt, idx) => {
                  const px = getXPos(pt.norm);
                  const py = getYPos(pt.y);
                  return `${acc} ${idx === 0 ? 'M' : 'L'} ${px} ${py}`;
                }, '')}
                fill="none"
                stroke={theme.curveStroke}
                strokeWidth={isHighContrast ? "4.5" : "3"}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {currentPreset.criticalPoints.map((pt, i) => {
                const ptNorm = (pt.x - minX) / (maxX - minX);
                const px = getXPos(ptNorm);
                const py = getYPos(pt.y);
                return (
                  <circle
                    key={i}
                    cx={px}
                    cy={py}
                    r={isHighContrast ? "7" : "5"}
                    fill={theme.landmarkDot}
                    stroke="#000000"
                    strokeWidth="2"
                  />
                );
              })}

              <line
                x1={getXPos(playhead)}
                y1={paddingY}
                x2={getXPos(playhead)}
                y2={svgHeight - paddingY}
                stroke={theme.cursorLine}
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />

              <circle
                cx={getXPos(playhead)}
                cy={getYPos(currentActualY)}
                r={isHighContrast ? "9" : "7"}
                fill={theme.cursorDot}
                stroke="#000000"
                strokeWidth="2.5"
              />
            </svg>
          </div>

          {/* Telemetry Grid with Derivative Readout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: theme.surfaceBg, padding: '0.75rem', borderRadius: '0.375rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>X Coord</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>{currentActualX.toFixed(2)}</div>
            </div>
            <div style={{ backgroundColor: theme.surfaceBg, padding: '0.75rem', borderRadius: '0.375rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Y Value</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>{currentActualY.toFixed(2)}</div>
            </div>
            <div style={{ backgroundColor: theme.surfaceBg, padding: '0.75rem', borderRadius: '0.375rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Slope (dy/dx)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: Math.abs(currentSlope) > 1.5 ? '#f43f5e' : theme.accent, marginTop: '0.2rem' }}>
                {currentSlope.toFixed(2)}
              </div>
            </div>
            <div style={{ backgroundColor: theme.surfaceBg, padding: '0.75rem', borderRadius: '0.375rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Pitch (Hz)</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>{Math.round(currentFreq)} Hz</div>
            </div>
            <div style={{ backgroundColor: theme.surfaceBg, padding: '0.75rem', borderRadius: '0.375rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
              <div style={{ fontSize: '0.75rem', color: theme.textSecondary, textTransform: 'uppercase', fontWeight: 700 }}>Spatial Pan</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: theme.textPrimary, marginTop: '0.2rem' }}>
                {currentPan <= -0.1 ? `${Math.round(Math.abs(currentPan) * 100)}% L` : currentPan >= 0.1 ? `${Math.round(currentPan * 100)}% R` : 'Center'}
              </div>
            </div>
          </div>

          {/* Accessible Scrubber Slider */}
          <div style={{ marginBottom: '1.5rem' }}>
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
              style={{
                width: '100%',
                accentColor: theme.accent,
                cursor: 'pointer',
                height: '10px'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: theme.textSecondary, marginTop: '0.25rem' }}>
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
                backgroundColor: isPlaying ? '#e11d48' : theme.accent,
                color: isPlaying ? '#ffffff' : theme.accentContrastText,
                padding: '0.65rem 1.35rem',
                borderRadius: '0.375rem',
                border: `${theme.borderWidth} solid ${theme.border}`,
                fontWeight: 800,
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
                backgroundColor: theme.buttonSecondaryBg,
                color: theme.buttonSecondaryText,
                padding: '0.65rem 1rem',
                borderRadius: '0.375rem',
                border: `${theme.borderWidth} solid ${theme.border}`,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} />
              Reset
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: theme.textSecondary }}>Duration:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                style={{
                  backgroundColor: theme.surfaceBg,
                  color: theme.textPrimary,
                  border: `${theme.borderWidth} solid ${theme.border}`,
                  borderRadius: '0.25rem',
                  padding: '0.35rem 0.6rem',
                  fontWeight: 600
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
            borderRadius: '0.5rem', 
            padding: '1rem', 
            fontSize: '0.95rem', 
            color: theme.consoleText,
            marginBottom: '1.5rem',
            fontWeight: 700
          }}
        >
          <strong>Assistive Console:</strong> {statusMessage}
        </section>

        {/* Hotkey Guide */}
        <section style={{ backgroundColor: theme.cardBg, borderRadius: '0.5rem', padding: '1rem 1.25rem', border: `${theme.borderWidth} solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Keyboard size={18} color={theme.accent} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: theme.textPrimary }}>Keyboard Navigation Shortcuts</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: theme.textSecondary }}>
            <div><kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>Space</kbd> Play / Pause sweep</div>
            <div><kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>←</kbd> / <kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>→</kbd> Step 1% with slope probe tone</div>
            <div><kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>Shift</kbd> + <kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>←</kbd> / <kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>→</kbd> Jump 5%</div>
            <div><kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>H</kbd> Toggle High Contrast (AAA)</div>
            <div><kbd style={{ backgroundColor: theme.surfaceBg, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${theme.border}`, color: theme.textPrimary, fontWeight: 700 }}>R</kbd> Reset cursor to 0</div>
          </div>
        </section>

      </div>

      {/* FR-07 Modal Dialog */}
      {isModalOpen && (
        <div 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
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
            style={{
              backgroundColor: theme.cardBg,
              border: `2px solid ${theme.border}`,
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '540px',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText color={theme.accent} size={20} />
                <h3 id="modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: theme.textPrimary }}>Import Dataset (CSV / JSON)</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDatasetSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: theme.textSecondary, marginBottom: '0.35rem' }}>
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
                    padding: '0.6rem',
                    backgroundColor: theme.surfaceBg,
                    border: `${theme.borderWidth} solid ${theme.border}`,
                    borderRadius: '0.375rem',
                    color: theme.textPrimary,
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
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
                    style={{ background: 'none', border: 'none', color: theme.accent, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
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
                    padding: '0.6rem',
                    backgroundColor: theme.surfaceBg,
                    border: `${theme.borderWidth} solid ${theme.border}`,
                    borderRadius: '0.375rem',
                    color: theme.textPrimary,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {parseError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#450a0a', border: '1px solid #ff2a2a', borderRadius: '0.375rem', padding: '0.6rem', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <AlertCircle size={16} color="#ff2a2a" />
                  <span>{parseError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    backgroundColor: theme.buttonSecondaryBg,
                    color: theme.buttonSecondaryText,
                    border: `${theme.borderWidth} solid ${theme.border}`,
                    borderRadius: '0.375rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.25rem',
                    backgroundColor: theme.accent,
                    color: theme.accentContrastText,
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 800,
                    cursor: 'pointer'
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