---
tags: [babylonjs, vue3, websocket, ui, frontend]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-23
**関連タスク**: Babylon.js UI 改修 4点（ドラッグ残り・黄色・WebSocket 時刻・テキストラベル）

## 問題

以下の4点の改善要望があった:

1. ドラッグで3D回転中、マウスをキャンバス外で離すとドラッグ状態が残り続ける
2. ドラッグ中に視覚フィードバックがなく、操作していることが分かりにくい
3. フロントエンドとバックエンドの疎通を確認する手段がなかった
4. 3Dシーン上にアプリ名を表示したかった

## 試行錯誤

### ①ドラッグ残り: `mouseleave` で解除する案

**試したこと**: `canvas.addEventListener('mouseleave', ...)` でドラッグを解除しようとした。

**結果**: 採用せず

**理由**: `mouseleave` はマウスが canvas 境界を出た瞬間のみ発火するため、高速移動や別ウィンドウへの移動では取りこぼす。Pointer Events API の `setPointerCapture` / `lostpointercapture` の方が確実。

### ③WebSocket: 手書きブリッジで Hono + WebSocket を同居させる案

**試したこと**: `http.createServer()` を自前で作り、`httpServer.on('request', ...)` で Hono の `app.fetch()` を手動で呼び出す実装。

**結果**: 失敗（`Failed to fetch`）

**理由**: `app.fetch()` に渡す `Request` オブジェクトの組み立て（特にボディのストリーム変換）が正しく動作せず、API レスポンスが返らなかった。

### ③WebSocket: `serve()` の戻り値に WebSocketServer をアタッチ（成功）

**試したこと**: `@hono/node-server` の `serve()` が `http.Server` 互換オブジェクトを返すことを確認し、その戻り値に直接 `WebSocketServer` をアタッチ。

**結果**: 成功

```js
const httpServer = serve({ fetch: app.fetch, port }, (info) => { ... });
const wss = new WebSocketServer({ server: httpServer });
```

## 解決策

### ①ドラッグ残りバグ修正

**実装場所**: `public/index.html` Babylon.js セクション

Pointer Events API の `setPointerCapture` を使い、`lostpointercapture` で Babylon 内部状態を強制リセット:

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

### ②ドラッグ中に立方体を黄色く

**実装場所**: `public/index.html` Babylon.js セクション

`scene.onPointerObservable` で box へのヒットを検出。`POINTERDOWN` 時に色を保存して黄色に変更、`POINTERUP` 時に復元:

```js
let savedColor = null;

scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN &&
      pointerInfo.pickInfo?.hit &&
      pointerInfo.pickInfo.pickedMesh === box) {
    savedColor = mat.diffuseColor.clone();
    mat.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.0); // 黄色
  } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
    if (savedColor !== null) {
      mat.diffuseColor = savedColor;
      savedColor = null;
    }
  }
});
```

### ③WebSocket でサーバー時刻を配信

**実装場所**: `server.js`

`ws` パッケージを使い、`serve()` の戻り値に `WebSocketServer` をアタッチ。1秒ごとに ISO 文字列を全クライアントへ push:

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

### ④Vue メニュー下部にサーバー時刻表示

**実装場所**: `public/index.html` Vue セクション

`onMounted` で WebSocket 接続。切断時は 3 秒後に自動再接続。ドロワー下部に `serverTime` を表示:

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

### ⑤立方体上部にテキストラベル

**実装場所**: `public/index.html` Babylon.js セクション

`DynamicTexture` に Canvas 2D API で白文字を描画し、透明な平面メッシュに貼り付け。`BILLBOARDMODE_Y` で水平回転のみカメラ追従:

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

## 学び

- **`setPointerCapture` が確実**: `mouseleave` より Pointer Events API の capture/release が確実にドラッグ終了を検出できる。キャンバス外・別ウィンドウ移動にも対応。
- **`serve()` の戻り値を活用**: `@hono/node-server` の `serve()` は `http.Server` 互換を返すので、手書きブリッジ不要で WebSocket を同居できる。
- **`DynamicTexture` + `opacityTexture`**: 背景透明・文字のみ表示には `diffuseTexture` と同じテクスチャを `opacityTexture` にも設定するとアルファが効く。
- **`BILLBOARDMODE_Y`**: テキストラベルは全方向追従（`BILLBOARDMODE_ALL`）より Y 軸のみの方が自然に見える。

## 今後の改善案

- テキストラベルのフォントサイズをビューポートサイズに応じてレスポンシブに変える
- WebSocket の `type` を拡張して MQTT 接続状態なども配信できるようにする
- ドラッグ中の黄色をアニメーション（パルス）にするとより視覚的にわかりやすい

## 関連ドキュメント

- [Babylon.js+Vue3フロントエンド実装ノート](./2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md)
- [MQTTバックエンド実装ノート](./2026-09-30-21-00-58-mqtt-backend-and-env-injection.md)
- [MQTTトピックリファクタリングノート](./2026-10-23-11-27-21-mqtt-iot-topics-refactor.md)

---

**最終更新**: 2026-10-23
**作成者**: AI
