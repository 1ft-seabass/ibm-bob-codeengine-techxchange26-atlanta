# Babylon.js + Vue 3 + Bootstrap 5 Frontend — Setup Guide

This file is a standalone setup guide for adding a Babylon.js 3D cube frontend built with Vue 3 and Bootstrap 5 to a plain Hono server (static `public/` serving + API only).
It is written to be self-contained — no other documents need to be referenced.

The MQTT integration and Code Engine environment variable injection are covered in `03-env.md`.
This file covers only the frontend (`public/index.html`) and how to call the two API endpoints
(`POST /api/led/on` / `POST /api/led/off`, implemented in `03-env.md`).

## Prerequisites

- A Node.js + Hono static serving server (`serveStatic({ root: './public' })`) is already running.
- No build pipeline is introduced. Vue 3, Bootstrap 5, and Babylon.js are all loaded via CDN `<script>` tags in `public/index.html`. Bundlers such as webpack/vite and npm-based frontend packages are not used.
- CDN versions are pinned explicitly rather than using floating tags like `latest`. The following versions have been verified to work:
  - Bootstrap: `5.3.3`
  - Vue: `3.4.21` (global build `vue.global.prod.js`)
  - Babylon.js: `6.49.0` (`https://cdn.babylonjs.com/babylon.js`)

## Screen Layout

- A Babylon.js scene is rendered full-screen on a canvas (`position: fixed` as the background layer).
  - A 1×1×1 cube. Default color is gray.
  - The cube rotates (spins) by default.
  - Camera is `ArcRotateCamera`, initially focused on the cube.
  - Mouse wheel zooms in/out.
  - Mouse drag rotates the camera (use `camera.attachControl`).
- A Vue 3 `#app` is overlaid on top of the canvas (the container itself uses `pointer-events: none`; only actual UI elements use `pointer-events: auto` to avoid blocking drag operations on the canvas).
- A hamburger button is pinned to the top-left (`position: fixed; top: 16px; left: 16px` as a guide). Clicking it opens a Bootstrap Offcanvas drawer from the left.
- The drawer contains:
  - A **Rotation** toggle button: stops/resumes the cube's spin.
  - An **Reset Angle** button: returns the camera position/target to its initial state.
  - An LED status badge (ON: red, OFF: gray) for a visual state indicator.

## Cube Click Behavior (Toggle)

- Initial state: off (gray).
- Click while off → call `POST /api/led/on` → if successful, turn the cube red and set state to on.
- Click while on → call `POST /api/led/off` → if successful, turn the cube gray and set state to off.
- State (on/off) is held in the frontend only (it resets to off on page reload; no API to query current state from the server).
- During an API call, use a `requesting` flag (or similar) to ignore additional clicks and prevent duplicate requests.
- If the API call fails (network error or non-2xx response), keep the color and state as they were before the click (no optimistic update). Display the error temporarily via a toast or similar (e.g., auto-dismiss after 5 seconds).

## Babylon.js ↔ Vue 3 Integration (Recommended Approach)

Rather than wiring up strict reactive two-way bindings in a CDN setup, a simpler global-variable-based integration is practical and works well:

- **Rotation stop/resume**: Read a flag like `window.__vueRotating` from the Babylon render loop every frame.
- **Click handling**: Expose the Vue-side function globally as `window.__vueApp = { onBoxClick }`, and call it from Babylon's `ActionManager` (`OnPickTrigger`).
- **Camera and cube mesh**: Hold them in module-scoped variables so the "Reset Angle" button in Vue can directly call `camera.setPosition(...)` etc. to restore the initial state.

## Verification Checklist

- [ ] Created the full frontend in `public/` using Vue 3 + Bootstrap 5 + Babylon.js (CDN, versions pinned)
- [ ] Cube rotation / stop toggle works
- [ ] Mouse wheel zoom and drag camera rotation work
- [ ] "Reset Angle" button returns the camera to its initial state
- [ ] Top-left hamburger menu opens/closes the left drawer
- [ ] Clicking the cube toggles on/off and changes the color to red/gray (requires the API from `03-env.md` to be implemented)
- [ ] Rapid clicks do not send duplicate API requests
- [ ] On API failure, color and state remain unchanged from before the click

## Completion Criteria

- After running `npm start` locally, opening `http://localhost:8080` in a browser shows a spinning 3D cube, and all UI interactions work (zoom, camera rotation, reset angle, rotation toggle, drawer open/close).
- Clicking the cube triggers the corresponding API (`/api/led/on` or `/api/led/off`), visible in the browser's Network tab (backend implementation is in `03-env.md`).
