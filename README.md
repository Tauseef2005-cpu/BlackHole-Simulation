# Real-Time Realistic Black Hole Simulation in C++

A high-performance, photorealistic, 3D real-time black hole rendering and physics simulation created using **C++17**, **OpenGL 4.3+**, **GLFW**, **GLAD**, **GLM**, **Dear ImGui**, and **CMake**.

The simulation visualizes a scientifically inspired **Kerr / Schwarzschild Black Hole** surrounded by a glowing volumetric accretion disk, a sharp photon ring, strong gravitational lensing, relativistic Doppler boosting, gravitational redshift, and a deep-space starfield with nebulae.

---

## Visual Features

- **Completely Dark Event Horizon**: Ray capture at \(R_s = 2M\).
- **Relativistic Geodesic Ray Marching**: Real-time numerical integration of photon trajectories bent by general relativity light deflection.
- **Kerr Black Hole Spin**: Frame-dragging swirls light and shifts the Innermost Stable Circular Orbit (ISCO) inward.
- **Volumetric Accretion Disk**: Procedural 3D Simplex noise with Keplerian differential orbital rotation (\(\Omega \propto r^{-1.5}\)).
- **Temperature-Based Color Progression**: Inner disk near ISCO is white-hot/yellow, middle disk is warm orange/yellow, outer disk is deep red.
- **Relativistic Doppler Effect & Gravitational Redshift**: Approaching disk side is blue-shifted and brighter; receding side is red-shifted and dimmer.
- **Glowing Photon Ring**: Razor-thin, luminous ring surrounding the event horizon at \(r \approx 1.5 R_s\).
- **Gravitationally Lensed Starfield**: Deep space background stars and multi-colored nebulae distorted into Einstein rings.
- **HDR Bloom & ACES Tone Mapping**: Multi-pass Gaussian blur pyramid with ACES Filmic Tone Mapping and Gamma 2.2 correction.
- **Interactive Control Panel**: Real-time parameter tweaking via ImGui.

---

## 1. Physics & Astrophysics Overview

### Schwarzschild & Kerr Metric
For a non-rotating black hole of mass \(M\), the Schwarzschild radius is:
\[ R_s = \frac{2 G M}{c^2} \]
In normalized simulation units (\(G=1, c=1\)), \(R_s = 2M\).

For a rotating Kerr black hole with dimensionless spin parameter \(a \in [-0.998, 0.998]\):
- **Photon Sphere Radius**:
  \[ R_{\text{photon}} = 2M \left[ 1 + \cos\left(\frac{2}{3} \arccos(-a)\right) \right] \]
- **Innermost Stable Circular Orbit (ISCO)**:
  \[ Z_1 = 1 + (1 - a^2)^{1/3} \left[ (1+a)^{1/3} + (1-a)^{1/3} \right] \]
  \[ Z_2 = \sqrt{3 a^2 + Z_1^2} \]
  \[ R_{\text{ISCO}} = M \left[ 3 + Z_2 - \text{sign}(a) \sqrt{(3 - Z_1)(3 + Z_1 + 2 Z_2)} \right] \]

As spin \(a \to 0.998\), \(R_{\text{ISCO}}\) shrinks from \(6M\) down to \(\sim 1.2M\), allowing the glowing accretion disk to extend much deeper into the black hole's gravitational well.

### Light Deflection Geodesics
Light rays traveling near mass \(M\) experience acceleration toward the center:
\[ \vec{a} \approx -\frac{3 G M}{c^2 r^5} (\vec{p} \times \vec{v})^2 \vec{p} \]
Kerr spin induces frame dragging:
\[ \vec{a}_{\text{drag}} = \frac{2 M a}{r^3} (\vec{S} \times \vec{v}) \]

### Relativistic Doppler Boosting
Gas orbiting in the accretion disk moves at relativistic speed \(v = \frac{0.45}{\sqrt{r / R_s}}\). The Doppler factor \(\delta\) for light emitted toward a ray direction is:
\[ \delta = \frac{1}{\gamma (1 - \vec{v}_{\text{gas}} \cdot \vec{n}_{\text{ray}})}, \quad \gamma = \frac{1}{\sqrt{1 - v^2}} \]
Observed intensity scales by \(\delta^3.5\), creating the characteristic asymmetric brightness profile where the approaching disk side shines significantly brighter and bluer than the receding side.

---

## 2. Rendering Pipeline Architecture

```text
       Primary Camera Ray Generation
                   ↓
   Geodesic Ray Marching Fragment Shader
  (Lensing, Kerr Drag, Volumetric Disk, Stars)
                   ↓
        HDR Floating-Point FBO (GL_RGBA16F)
        ├── Attachment 0: Main HDR Scene
        └── Attachment 1: Bright Pass (> Threshold)
                   ↓
       9-Tap Gaussian Blur Ping-Pong Passes
                   ↓
   ACES Filmic Tone Mapping & Gamma Correction
                   ↓
        Screen Output + ImGui GUI Overlay
```

---

## 3. Project Structure

```text
BlackHoleSimulation/
│
├── CMakeLists.txt
├── README.md
│
├── include/
│   ├── BlackHole.hpp
│   ├── AccretionDisk.hpp
│   ├── Camera.hpp
│   ├── Renderer.hpp
│   ├── Shader.hpp
│   ├── Simulation.hpp
│   ├── glad/
│   │   └── glad.h
│   └── KHR/
│       └── khrplatform.h
│
├── src/
│   ├── main.cpp
│   ├── BlackHole.cpp
│   ├── AccretionDisk.cpp
│   ├── Camera.cpp
│   ├── Renderer.cpp
│   ├── Shader.cpp
│   ├── Simulation.cpp
│   ├── glad.c
│   └── imgui/          (Dear ImGui v1.90 vendored sources)
│
└── shaders/
    ├── blackhole.vert
    ├── blackhole.frag
    ├── bloom.vert
    ├── bloom.frag
    ├── composite.vert
    └── composite.frag
```

---

## 4. Dependencies & Prerequisites

- **C++ Compiler**: GCC 10+ / MSVC 2022 / Clang (C++17 support)
- **CMake**: 3.20 or newer
- **OpenGL**: 4.3 Core Profile
- **GLFW3**: Windowing & Input handling
- **GLM**: OpenGL Mathematics library

### Environment Setup (MSYS2 / MinGW UCRT64)
If building on Windows via MSYS2:
```bash
pacman -S mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-ninja mingw-w64-ucrt-x86_64-glfw mingw-w64-ucrt-x86_64-glm
```

---

## 5. Building & Running

### Option 1: 🚀 WebGL Web Application (Run in 1 Command!)

No compilation or C++ dependencies required. Runs in any web browser at 120+ FPS!

Run with **only one command**:
```bash
node server.js
```
*Or on Windows, simply double-click `run.bat` or run:*
```bash
python -m http.server 8000
```

### Option 2: Native C++ / OpenGL 4.3 App
```bash
mkdir build
cd build
cmake .. -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build .
```

### Build via MSVC (Visual Studio)
```bash
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

### Run Executable
```bash
./BlackHoleSimulation
```

---

## 6. Controls Guide

| Input | Action |
| :--- | :--- |
| **W / S** | Move Camera Forward / Backward |
| **A / D** | Orbit / Move Camera Left / Right |
| **Q / E** | Move Camera Vertically Up / Down |
| **Mouse Left Drag** | Orbit around Black Hole |
| **Mouse Scroll** | Zoom In / Out (Adjust FOV) |
| **R** | Reset Camera to Default View |
| **TAB** | Toggle ImGui Control Panel |
| **ESC** | Exit Simulation |

---

## 7. Performance Tuning & GPU Optimization

- **Quality Presets**:
  - **High**: 128 ray marching steps (maximum visual fidelity).
  - **Medium**: 64 ray marching steps (recommended for mid-range GPUs).
  - **Performance**: 32 ray marching steps (60+ FPS on low-power GPUs).
- **Adaptive Step Sizing**: Step distance dynamically scales based on distance from event horizon and disk boundary to avoid unnecessary ray iterations in empty space.
