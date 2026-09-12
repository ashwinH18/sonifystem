# SonifySTEM 🎵📐

> **Bridging accessibility in STEM through real-time mathematical sonification and spatial audio.**

SonifySTEM transforms abstract mathematical equations and biomedical time-series data into intuitive, spatial soundscapes. Built specifically for blind, visually impaired (BVI), and neurodivergent learners, the tool maps visual curve dimensions directly to pitch, stereo pan, and discrete auditory earcons.

---

## 🚀 Key Features

* **Binaural Spatial Panning:** Maps horizontal axis progression ($x$-axis) continuously across the stereo field from left ear to right ear using the Web Audio API `StereoPannerNode`.
* **Frequency Mapping Engine:** Maps vertical coordinates ($y$-axis) to musical frequency (180 Hz – 880 Hz) using clean sinusoidal synthesis with smooth exponential transitions.
* **Auditory Cues (Earcons):** Generates targeted auditory markers at critical points (local extrema, inflection points, and cardiac waveform events like R-peaks).
* **Screen Reader Ready:** Built-in `aria-live` status console communicates numerical coordinates and topological landmarks in real time.
* **Interactive Curvature Suite:** Preloaded mathematical models including:
  * **Quadratic:** $y = x^2$ (Parabolic vertex demonstration)
  * **Cubic:** $y = x^3 - 3x$ (Multiple extrema and inflection points)
  * **Harmonic:** $y = \sin(x)$ (Periodic oscillation)
  * **Biomedical ECG:** P-Q-R-S-T cardiac cycle simulation

---

## 🛠️ Tech Stack

* **Framework:** React 19 + Vite
* **Audio Engine:** Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`, `StereoPannerNode`)
* **Icons:** `lucide-react`
* **Styling:** Modular CSS & Accessible UI Tokens

---

## 💻 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* Headphones or stereo speakers (required for spatial audio)

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/AshwinH18/sonifystem.git](https://github.com/AshwinH18/sonifystem.git)
   cd sonifystem