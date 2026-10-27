---
tags: [babylonjs, vue3, websocket, ui, frontend]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-10-23
**Related Task**: Babylon.js UI improvements — 4 items (drag stuck, yellow highlight, WebSocket clock, text label)

## Problem

The following four improvements were requested:

1. When rotating the 3D view by dragging, releasing the mouse outside the canvas left the drag state stuck
2. No visual feedback during dragging made it hard to tell the interaction was active
3. There was no way to verify connectivity between the frontend and backend
4. The app name should be displayed in the 3D scene

## Attempts

### ① Drag Stuck: Releasing with `mouseleave`

**Tried**: Using `canvas.addEventListener('mouseleave', ...)` to cancel the drag state.

**Result**: Not adopted

**Reason**: `mouseleave` only fires at the moment the mouse crosses the canvas boundary, so fast moves or switching to another window are missed. The Pointer Events API's `setPointerCapture` / `lostpointercapture` is more reliable.

### ③ WebSocket: Manual Bridge to Coexist Hono + WebSocket

**Tried**: Creating a custom `http.createServer()` and manually calling Hono's `app.fetch()` from `httpServer.on('request', ...)`.

**Result**: Failed (`Failed to fetch`)

**Reason**: Building the `Request` object passed to `app.fetch()` — particularly converting the body stream — did not work correctly, and API responses were not returned.

### ③ WebSocket: Attach WebSocketServer to `serve()` Return Value (Succeeded)

**Tried**: Confirmed that `@hono/node-server`'s `serve()` returns an `http.Server`-compatible object, and attached a `WebSocketServer` directly to its return value.

**Result**: Succeeded

```js
const httpServer = serve({ fetch: app.fetch, port }, (info) => { ... });
const wss = new WebSocketServer({ server: httpServer });
```

## Solution

### ① Fix Drag Stuck Bug

**Implementation location**: `public/index.html` — Babylon.js section

Used the Pointer Events API's `setPointerCapture` and forced a Babylon internal state reset in `lostpointercapture`:

```js
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', (e) => {
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel', (e) => {
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('lostpointercapture', () => {
  scene.simulatePointerUp(new BABYLON.PointerEventTypes());
  camera._isDragging = false;
});
```

### ② Turn Cube Yellow While Dragging

**Implementation location**: `public/index.html` — Babylon.js section

Used `scene.onPointerObservable` to detect hits on the box. On `POINTERDOWN`, save the color and change to yellow; on `POINTERUP`, restore it:

```js
let savedColor = null;

scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
      pointerInfo.pickInfo?.hit &&
      pointerInfo.pickInfo.pickedMesh === box) {
    savedColor = mat.diffuseColor.clone();
    mat.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.0); // yellow
  } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
    if (savedColor !== null) {
      mat.diffuseColor = savedColor;
      savedColor = null;
    }
  }
});
```

### ③ Broadcast Server Clock via WebSocket

**Implementation location**: `server.js`

Used the `ws` package and attached a `WebSocketServer` to the `serve()` return value. Pushes an ISO string to all clients every second:

```js
const httpServer = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});

const wss = new WebSocketServer({ server: httpServer });

setInterval(() => {
  const payload = JSON.stringify({ type: 'clock', time: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(payload);
  });
}, 1000);
```

### ④ Display Server Clock at the Bottom of the Vue Drawer

**Implementation location**: `public/index.html` — Vue section

Connects via WebSocket in `onMounted`. Auto-reconnects after 3 seconds on disconnect. Displays `serverTime` at the bottom of the drawer:

```js
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'clock') {
      serverTime.value = new Date(data.time).toLocaleString('ja-JP');
    }
  });
  ws.addEventListener('close', () => setTimeout(connectWs, 3000));
}
onMounted(connectWs);
```

### ⑤ Text Label Above the Cube

**Implementation location**: `public/index.html` — Babylon.js section

Drew white text on a `DynamicTexture` using the Canvas 2D API, then attached it to a transparent plane mesh. Used `BILLBOARDMODE_Y` so it only follows the camera horizontally:

```js
const labelPlane = BABYLON.MeshBuilder.CreatePlane('label', { width: 2.2, height: 0.5 }, scene);
labelPlane.position.y = 0.9;
labelPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

const labelTex = new BABYLON.DynamicTexture('labelTex', { width: 512, height: 128 }, scene, false);
const ctx = labelTex.getContext();
ctx.font = 'bold 36px sans-serif';
ctx.fillStyle = '#ffffff';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('IBM TechXchange', 256, 48);
ctx.font = 'bold 30px sans-serif';
ctx.fillText('Atlanta Sample', 256, 90);
labelTex.update();

const labelMat = new BABYLON.StandardMaterial('labelMat', scene);
labelMat.diffuseTexture  = labelTex;
labelMat.opacityTexture  = labelTex;
labelMat.emissiveColor   = new BABYLON.Color3(1, 1, 1);
labelMat.backFaceCulling = false;
labelMat.hasAlpha        = true;
labelPlane.material = labelMat;
```

## Lessons Learned

- **`setPointerCapture` is reliable**: The Pointer Events API's capture/release detects drag end more reliably than `mouseleave` — it handles moves outside the canvas and switching to other windows.
- **Use the `serve()` return value**: `@hono/node-server`'s `serve()` returns an `http.Server` compatible object, so WebSocket can coexist without a manual bridge.
- **`DynamicTexture` + `opacityTexture`**: To show text on a transparent background, assign the same texture to both `diffuseTexture` and `opacityTexture` to enable alpha.
- **`BILLBOARDMODE_Y`**: For text labels, Y-axis-only camera tracking looks more natural than full `BILLBOARDMODE_ALL`.

## Future Improvements

- Make the text label font size responsive to the viewport size
- Extend the WebSocket `type` to also broadcast MQTT connection status
- Animate the yellow highlight during drag (e.g. pulsing) for more visual feedback

## Related Documents

- [Babylon.js + Vue 3 Frontend Setup Note](./2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md)
- [MQTT Backend Implementation Note](./2026-09-30-21-00-58-mqtt-backend-and-env-injection.md)
- [MQTT IoT Topics Refactor Note](./2026-10-23-11-27-21-mqtt-iot-topics-refactor.md)

---

**Last updated**: 2026-10-23
**Author**: AI
