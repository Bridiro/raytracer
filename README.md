# GPU-Accelerated Raytracer - WebAssembly

**Work in Progress**

A real-time 3D raytracer built with Rust and WebAssembly, featuring GPU-accelerated rendering through WebGL fragment shaders and an integrated scene editor.

## Features

- **Real-time Raytracing**: GPU-accelerated raytracing using WebGL fragment shaders
- **Dual-Mode Interface**: 
  - Raytracer mode for real-time viewing with FPS camera controls
  - Scene Editor mode for object placement and property editing
- **Material System**: Support for Lambertian, Metal, and Dielectric (glass) materials
- **Interactive Scene Editor**: 
  - Multi-view 2D canvases (Top, Side, Front views)
  - Real-time object manipulation with visual feedback
  - Camera positioning controls
- **Performance Monitoring**: Real-time FPS counter and frame time tracking
- **Scene Management**: JSON export/import functionality
- **Built-in Presets**: Cornell Box, Glass Scene, and Metal Scene demonstrations

## Materials Supported

- **Lambertian**: Diffuse materials with realistic light scattering
- **Metal**: Reflective surfaces with adjustable roughness
- **Dielectric**: Glass and transparent materials with proper refraction

## Controls

### Raytracer Mode
- WASD: Move camera
- Mouse: Look around (click to capture mouse)
- ESC: Release mouse

### Scene Editor Mode
- Object selection and property editing
- Real-time position, radius, material, and color adjustment
- Multi-view visualization for precise object placement

## Building

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

### Build Instructions

```bash
# Clone the repository
git clone https://github.com/Bridiro/raytracer.git
cd raytracer

# Build the WebAssembly module
wasm-pack build --target web --out-dir web/pkg

# Serve the web directory
cd web
python3 -m http.server 8000

# Open http://localhost:8000 in your browser
```

## Architecture

- **Rust Backend**: Core raytracing engine with Vec3/Mat4 math operations
- **WebGL Shaders**: GPU fragment shaders for real-time raytracing
- **WASM Interface**: Seamless JavaScript-Rust communication
- **Dual-Mode UI**: Toggle between viewing and editing modes

## Technical Details

The raytracer runs entirely on the GPU using WebGL fragment shaders for maximum performance. The Rust backend handles scene management and camera operations, while the JavaScript frontend provides the dual-mode interface for both viewing and editing.

## License

This project is licensed under the MIT License.