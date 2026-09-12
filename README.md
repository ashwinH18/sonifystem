# SonifySTEM 🎵📐

> **Bridging accessibility in STEM through real-time mathematical sonification, spatial audio, and tactile timbre.**

SonifySTEM transforms abstract mathematical curves and biomedical time-series data into intuitive, spatial soundscapes[cite: 1]. Built specifically for blind, visually impaired (BVI), and neurodivergent learners, the tool maps visual curve dimensions directly to pitch, stereo pan, derivative-based timbre, and discrete auditory earcons[cite: 1].

---

## 🎧 Best Experienced With Headphones
*SonifySTEM utilizes binaural stereo panning[cite: 1]. Wearing headphones allows you to hear the curve move spatially from your left ear to your right ear[cite: 1].*

---

## 🚀 Key Features

* **Binaural Spatial Panning:** Continuous horizontal axis ($x$-axis) progression mapped across the stereo field from left ear to right ear using the Web Audio API `StereoPannerNode`[cite: 1].
* **Frequency Mapping Engine:** Maps vertical coordinates ($y$-axis) to musical frequency (180 Hz – 880 Hz) using clean sinusoidal synthesis with smooth exponential transitions[cite: 1].
* **Derivative-Driven Timbre Modulation:** Dynamically calculates slope ($dy/dx$) in real time[cite: 1]. As curves climb or plunge steeply, the synthesizer crossfades a harsh sawtooth wave over the fundamental sine wave for tactile auditory feedback on slope steepness[cite: 1].
* **Acoustic Earcons:**
  * **Roots ($y = 0$):** Resonant 880 Hz metallic bell chime with harmonic shimmer[cite: 1].
  * **Extrema (Peaks & Valleys):** Hollow, percussive woodblock tap[cite: 1].
* **Frame-by-Frame Scrubbing & Audio Probes:** Step incrementally through curves using arrow keys with instant single-tone probe sound feedback[cite: 1].
* **Custom Dataset Ingestion:** Built-in parser supporting two-column CSV and JSON arrays with automated linear interpolation and landmark detection[cite: 1].
* **WCAG AAA Compliance:** High-contrast yellow-on-black theme toggle (`H`), zero mouse dependency, and live screen-reader feedback via an assertive ARIA console[cite: 1].

---

## ⌨️ Keyboard Navigation

| Key | Action |
|---|---|
| `Space` | Play / Pause continuous sonification sweep[cite: 1] |
| `←` / `→` | Scrub position by 1% with instant probe tone[cite: 1] |
| `Shift` + `←` / `→` | Scrub position by 5%[cite: 1] |
| `R` | Reset playback to coordinate start[cite: 1] |
| `H` | Toggle WCAG AAA Yellow & Black High-Contrast Mode[cite: 1] |
| `Esc` | Close data import modal dialog[cite: 1] |

---

## 🛠️ Tech Stack

* **Framework:** React 19 + Vite[cite: 1]
* **Audio Engine:** Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `StereoPannerNode`)[cite: 1]
* **Visuals:** Native SVG Canvas with zero third-party chart dependencies[cite: 1]
* **Icons:** `lucide-react`[cite: 1]
* **Deployment:** Vercel CI/CD

---

## 💻 Getting Started

```bash
# Clone the repository
git clone [https://github.com/AshwinH18/sonifystem.git](https://github.com/AshwinH18/sonifystem.git)
cd sonifystem

# Install dependencies
npm install

# Run local development server
npm run dev