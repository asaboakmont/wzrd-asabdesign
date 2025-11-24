# Kitchen Planner — React + KonVA + Three.js (Minimal Example)

This is a minimal example showing:
- 2D planner using **react-konva**
- Simple cabinet catalog and drag/drop
- 3D view using **Three.js** that syncs with 2D

## Run locally

1. Unzip the project and `cd` into folder:
   ```
   npm install
   npm run dev
   ```
2. Open the dev URL (usually http://localhost:5173)

## Notes / Scaling tips

- The 2D uses a simple mm-to-px scale (0.5 px per mm). Adjust in `Planner2D.jsx`.
- Collision detection and advanced cabinet logic are intentionally minimal.
- For production, add:
  - Undo/redo, validation, user auth
  - Cabinet constraints, corner logic
  - Better asset management and GLTF cabinet models
  - Performance optimizations for large catalogs
