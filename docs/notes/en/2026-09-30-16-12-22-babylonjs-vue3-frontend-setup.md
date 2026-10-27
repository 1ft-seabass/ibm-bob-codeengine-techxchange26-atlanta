---
tags: [babylonjs, vue3, bootstrap5, frontend, cdn]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-09-30
**Related Task**: `tmp/02-frontend.md` — Babylon.js + Vue 3 + Bootstrap 5 frontend implementation

## Problem

The plain `public/index.html` needed a Babylon.js 3D cube, a reactive Vue 3 UI, and a Bootstrap 5 drawer.
The constraint was to build everything without a build pipeline — CDN `<script>` tags only.

## Attempts

### pointer-events Design

**Tried**: When overlaying Vue 3's `#app` on top of the canvas, setting `pointer-events: auto` on `#app` caused Babylon.js mouse drag events to be captured by Vue instead.

**Solution**: Set `pointer-events: none` on the `#app` container itself, and apply `.ui-btn { pointer-events: auto }` only to actual UI elements (buttons etc.). This allowed both the canvas drag and the Vue UI to coexist without conflict.

---

### Babylon.js ↔ Vue 3 Integration

**Tried**: Setting up strict reactive two-way bindings in a CDN global build environment leads to complex code without clear module boundaries.

**Solution**: Adopted a loose-coupling approach via global variables:

| Global Variable | Role |
|---|---|
| `window.__vueRotating` | Rotation flag. Read by the Babylon render loop every frame |
| `window.__vueApp.onBoxClick` | Vue function called from Babylon's ActionManager on cube click |
| `window.__babylon.setBoxColor(r,g,b)` | Called from Vue to change the cube color |
| `window.__babylon.resetCamera()` | Called from Vue to return the camera to its initial position |

## Solution

### CDN Versions (Pinned)

| Library | Version | How Loaded |
|---|---|---|
| Bootstrap CSS | `5.3.3` | `cdn.jsdelivr.net` |
| Bootstrap JS | `5.3.3` | `cdn.jsdelivr.net` (bundle, includes Popper) |
| Vue 3 | `3.4.21` | `vue.global.prod.js` (global build) |
| Babylon.js | `6.49.0` | `cdn.babylonjs.com/babylon.js` |

### Layout Overview

```
public/index.html
├── <canvas id="babylon-canvas">  ← position:fixed, full-screen background
├── <div id="app">                ← Vue 3 overlay (pointer-events:none)
│   ├── Hamburger button (top-left, fixed)
│   ├── LED badge (top-right, fixed)
│   └── Bootstrap Offcanvas drawer
│       ├── Rotation toggle button
│       ├── Reset Angle button
│       └── LED status badge
└── <div id="toast-container">   ← API error display (auto-dismiss after 5s)
```

### LED Toggle on Cube Click

```js
async function onBoxClick() {
  if (requesting.value) return;           // prevent double-click
  requesting.value = true;

  const nextOn = !ledOn.value;
  const endpoint = nextOn ? '/api/led/on' : '/api/led/off';

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    ledOn.value = nextOn;                 // update state only on success
    window.__babylon.setBoxColor(...);    // change color only on success
  } catch (e) {
    showToast('API error: ' + e.message); // on failure: toast only, color/state unchanged
  } finally {
    requesting.value = false;
  }
}
```

**Implementation location**: `public/index.html`

**Key points**:
1. `requesting` flag blocks duplicate requests
2. No optimistic update (color and state update only after API success is confirmed)
3. On failure, color and state remain as before the click; a toast displays for 5 seconds

### ⚠️ LED API Not Yet Implemented (Pending `03-env.md`)

`/api/led/on` and `/api/led/off` are to be implemented in `03-env.md` (MQTT integration + env injection).
At this point, clicking the cube shows an API error toast, but all other UI interactions work normally.

## Lessons Learned

- **CDN global build + global variable bridging**: In a no-bundler environment, a simple `window.__xxx` bridge is cleaner and more practical than trying to set up strict reactive bindings.
- **Offcanvas and pointer-events**: Bootstrap's Offcanvas is rendered with `position:fixed`, which takes it outside the `#app` `pointer-events:none` scope. Applying `pointer-events:auto` per element with a `.ui-btn` class is a reusable pattern.

## Future Improvements

- After implementing `03-env.md`, verify `/api/led/on` / `/api/led/off` behavior end-to-end
- Consider adding a `/api/led/status` endpoint to fetch current state on page load (currently resets to off on reload)

## Related Documents

- Setup guide: `tmp/02-frontend.md`
- Next setup guide: `tmp/03-env.md`
- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)

---

**Last updated**: 2026-09-30
**Author**: AI
