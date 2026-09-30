---
tags: [babylonjs, vue3, bootstrap5, frontend, cdn]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: `tmp/02-frontend.md` — Babylon.js + Vue3 + Bootstrap5 フロントエンド実装

## 問題

素の HTML だった `public/index.html` に、Babylon.js の3D立方体・Vue3 のリアクティブ UI・Bootstrap5 のドロワーを追加する必要があった。
ビルドパイプラインは使わず、CDN の `<script>` タグのみで完結させる制約あり。

## 試行錯誤

### pointer-events の設計

**試したこと**: Vue3 の `#app` を Canvas の上にオーバーレイする際、`#app` に `pointer-events: auto` を設定すると Babylon.js のマウスドラッグが奪われてしまう。

**解決**: `#app` コンテナ自体は `pointer-events: none`、ボタン等の実 UI 要素にのみ `.ui-btn { pointer-events: auto }` を付与することで、Canvas 側のドラッグ操作を妨げずに両立できた。

---

### Babylon.js ↔ Vue3 の連携

**試したこと**: CDN グローバルビルド環境でリアクティブな双方向バインディングを組もうとすると、モジュール境界がなく複雑になる。

**解決**: グローバル変数による疎結合連携を採用:

| グローバル変数 | 役割 |
|---|---|
| `window.__vueRotating` | 自転フラグ。Babylon のレンダーループが毎フレーム参照 |
| `window.__vueApp.onBoxClick` | 立方体クリック時に Babylon の ActionManager から呼ぶ Vue 関数 |
| `window.__babylon.setBoxColor(r,g,b)` | Vue 側から立方体の色を変更 |
| `window.__babylon.resetCamera()` | Vue 側からカメラを初期位置に戻す |

## 解決策

### CDN バージョン（ピン留め済み）

| ライブラリ | バージョン | 読み込み方 |
|---|---|---|
| Bootstrap CSS | `5.3.3` | `cdn.jsdelivr.net` |
| Bootstrap JS | `5.3.3` | `cdn.jsdelivr.net` (bundle, Popper含む) |
| Vue3 | `3.4.21` | `vue.global.prod.js` (グローバルビルド) |
| Babylon.js | `6.49.0` | `cdn.babylonjs.com/babylon.js` |

### 構成概要

```
public/index.html
├── <canvas id="babylon-canvas">  ← position:fixed で背景に全面描画
├── <div id="app">                ← Vue3 オーバーレイ（pointer-events:none）
│   ├── ハンバーガーボタン（左上固定）
│   ├── LED バッジ（右上固定）
│   └── Bootstrap Offcanvas ドロワー
│       ├── 回転トグルボタン
│       ├── アングルリセットボタン
│       └── LED 状態バッジ
└── <div id="toast-container">   ← API エラー表示（5秒で自動消去）
```

### 立方体クリック時の LED トグル処理

```js
async function onBoxClick() {
  if (requesting.value) return;           // 二重クリック防止
  requesting.value = true;

  const nextOn = !ledOn.value;
  const endpoint = nextOn ? '/api/led/on' : '/api/led/off';

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    ledOn.value = nextOn;                 // 成功時のみ状態更新
    window.__babylon.setBoxColor(...);    // 成功時のみ色変更
  } catch (e) {
    showToast('APIエラー: ' + e.message); // 失敗時はトーストのみ、色・状態はそのまま
  } finally {
    requesting.value = false;
  }
}
```

**実装場所**: `public/index.html`

**主なポイント**:
1. `requesting` フラグで二重リクエストをブロック
2. 楽観的更新なし（API 成功確認後に色・状態を更新）
3. 失敗時は色・状態をクリック前のまま維持、トーストで5秒表示

### ⚠️ LED API は未実装（`03-env.md` 待ち）

`/api/led/on` と `/api/led/off` は `03-env.md`（MQTT連携・環境変数注入）で実装予定。
現時点で立方体をクリックすると API エラーのトーストが出るが、それ以外の UI は正常動作する。

## 学び

- **CDN グローバルビルド + グローバル変数連携**: バンドラなし環境では、厳密なリアクティブ連携より `window.__xxx` 経由のシンプルな橋渡しの方が見通しが良く十分実用的。
- **Offcanvas の pointer-events**: Bootstrap の Offcanvas は `position:fixed` で展開されるため、`#app` の `pointer-events:none` の外に出る。`.ui-btn` クラスで個別に `pointer-events:auto` を付けるパターンが再利用しやすい。

## 今後の改善案

- `03-env.md` 実装後、`/api/led/on` / `/api/led/off` の動作確認を行う
- ページロード時に `/api/led/status` 等で現在状態を取得する仕組みを追加してもよい（現状はリロードで常に off に戻る）

## 関連ドキュメント

- 指示書: `tmp/02-frontend.md`
- 指示書（次): `tmp/03-env.md`
- [Code Engine 初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)

---

**最終更新**: 2026-09-30
**作成者**: AI
