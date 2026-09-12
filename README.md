# SonifySTEM 🎵📐

> **Bridging accessibility in STEM through real-time mathematical sonification, spatial audio, and tactile timbre.**

SonifySTEM transforms abstract mathematical curves and biomedical time-series data into intuitive, spatial soundscapes. Built specifically for blind, visually impaired (BVI), and neurodivergent learners, the tool maps visual curve dimensions directly to pitch, stereo pan, derivative-based timbre, and discrete auditory earcons.

---

## 🎧 Best Experienced With Headphones
*SonifySTEM utilizes binaural stereo panning. Wearing headphones allows you to hear the curve move spatially from your left ear to your right ear.*

---

## 🚀 Key Features

* **Binaural Spatial Panning:** Continuous horizontal axis ($x$-axis) progression mapped across the stereo field from left ear to right ear using the Web Audio API `StereoPannerNode`.
* **Frequency Mapping Engine:** Maps vertical coordinates ($y$-axis) to musical frequency (180 Hz – 880 Hz) using clean sinusoidal synthesis with smooth exponential transitions.
* **Derivative-Driven Timbre Modulation:** Dynamically calculates slope ($dy/dx$) in real time. As curves climb or plunge steeply, the synthesizer crossfades a harsh sawtooth wave over the fundamental sine wave for tactile auditory feedback on slope steepness.
* **Acoustic Earcons:**
  * **Roots ($y = 0$):** Resonant 880 Hz metallic bell chime with harmonic shimmer.
  * **Extrema (Peaks & Valleys):** Hollow, percussive woodblock tap.
* **Frame-by-Frame Scrubbing & Audio Probes:** Step incrementally through curves using arrow keys with instant single-tone probe sound feedback.
* **Custom Dataset Ingestion:** Built-in parser supporting two-column CSV and JSON arrays with automated linear interpolation and landmark detection.
* **WCAG AAA Compliance:** High-contrast yellow-on-black theme toggle (`H`), zero mouse dependency, and live screen-reader feedback via an assertive ARIA console.

---

## ⌨️ Keyboard Navigation

| Key | Action |
|---|---|
| `Space` | Play / Pause continuous sonification sweep |
| `←` / `→` | Scrub position by 1% with instant probe tone |
| `Shift` + `←` / `→` | Scrub position by 5% |
| `R` | Reset playback to coordinate start |
| `H` | Toggle WCAG AAA Yellow & Black High-Contrast Mode |
| `Esc` | Close data import modal dialog |

---

## 🛠️ Tech Stack

* **Framework:** React 19 + Vite
* **Audio Engine:** Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `StereoPannerNode`)
* **Visuals:** Native SVG Canvas with zero third-party chart dependencies
* **Icons:** `lucide-react`
* **Deployment:** Vercel CI/CD

---

## 🌐 Live Application

Experience the tool live in your browser:
**[sonifystem.vercel.app](https://sonifystem.vercel.app)**