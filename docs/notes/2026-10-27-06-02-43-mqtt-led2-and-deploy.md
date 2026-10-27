---
tags: [mqtt, code-engine, deploy, env, node]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-27
**関連タスク**: MQTT_IOT_CONTROL_LED2追加・起動時envチェック改善・Code Engineデプロイ

## 問題

以下の3点の対応が必要だった：

1. 2台目の LED デバイス（AtomS3 MAC: `30EDA0CA4718`）が追加され、`/api/device/on|off` で同時制御したい
2. 起動時に環境変数の設定漏れやサンプル値のままの項目を検出する仕組みがなかった
3. 上記を実装して Code Engine 本番に反映する

## 試行錯誤

### envチェック: 日本語メッセージの文字化け

**試したこと**: `console.warn` に日本語・絵文字を含むメッセージを実装:
```js
console.warn(`[env] ⚠ ${key} が未設定です`);
console.log(`[env] ✓ ${key}`);
```

**結果**: Windows PowerShell で文字化け発生（ユーザーがスクリーンショットで報告）

**解決**: メッセージを ASCII のみに変更:
```js
console.warn(`[env] WARN: ${key} is not set`);
console.log(`[env] OK: ${key}`);
```

---

### envチェック: optional 変数の扱い

**問題**: `MQTT_IOT_CONTROL_LED2` は将来追加されるデバイス用のオプション変数。未設定でも警告が出ると混乱する。

**試したこと①**: `.env.example` にコメントアウト行として記述し、パーサーで `# KEY=value` 形式をオプションとして認識させる。

**結果**: 採用

**仕組み**:
- `.env.example` でコメントアウト → optional 扱い（未設定でも `OK (optional, not set)` のみ表示）
- `.env.example` でアクティブな行 → required 扱い（未設定は `WARN`、サンプル値のままも `WARN`）

```js
const required = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
if (required) { requiredVars[required[1]] = required[2].trim(); return; }
const optional = line.match(/^#\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
if (optional) { optionalVars[optional[1]] = optional[2].trim(); }
```

## 解決策

### MQTT_IOT_CONTROL_LED2 の追加

**実装場所**: `server.js`, `.env.example`

環境変数をフォールバックなしで読み込み、`if (MQTT_IOT_CONTROL_LED2)` で存在チェックして `Promise.all` に追加:

```js
const MQTT_IOT_CONTROL_LED2 = process.env.MQTT_IOT_CONTROL_LED2;

// /api/device/on|off 内
const publishes = [
  publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })),
  publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ direction: 'cw', speed: 3 })),
];
if (MQTT_IOT_CONTROL_LED2) {
  publishes.push(publishAsync(MQTT_IOT_CONTROL_LED2, JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })));
}
await Promise.all(publishes);
```

`.env.example` での記述（コメントアウト = optional）:
```
# LED2 (AtomS3, MAC 30EDA0CA4718) [optional]
# ON payload : {"type":"led","r":255,"g":255,"b":255}
# OFF payload: {"type":"led","r":0,"g":0,"b":0}
# MQTT_IOT_CONTROL_LED2=atoms3/30EDA0CA4718/control/led
```

### 起動時 envチェック関数

**実装場所**: `server.js` 冒頭（即時実行関数）

起動ログ例（全項目 OK の場合）:
```
[env] OK: MQTT_HOST
[env] OK: MQTT_PORT
...
[env] OK (optional): MQTT_IOT_CONTROL_LED2
[env] all env vars are configured
```

### デプロイ手順

今回のデプロイは Secret 更新 → アプリ再起動のみ（コード変更は前のコミットで済んでいたため）:

```powershell
# 1. .env.production に MQTT_IOT_CONTROL_LED2 を追加

# 2. Secret 更新
npm run env:update

# 3. アプリ再起動（イメージ変更なし・Secret 反映のため）
npm run build:update_app
```

`build:image_build`（イメージビルド）は不要だった。`build:update_app` だけで新 Secret を持つコンテナに入れ替わる。

## 学び

- **optional 変数はコメントアウトで表現**: `.env.example` でコメントアウト → パーサーが optional と判断する設計はシンプルで分かりやすい。
- **Secret 更新だけでは再起動しない**: Code Engine は `env:update` で Secret を更新しても、既存コンテナはそのまま動き続ける。`build:update_app` で新リビジョンに切り替えて初めて反映される。
- **コード変更がない場合は `build:update_app` だけで OK**: `build:image_build` は不要。Secret や設定変更のみなら `env:update` + `build:update_app` の2ステップで済む。

## 今後の改善案

- LED デバイスが増えた場合、`MQTT_IOT_CONTROL_LED3` のように番号を増やすか、配列形式（`MQTT_IOT_CONTROL_LEDS=topic1,topic2`）にするか検討する
- `build:update_app` のみのショートカット npm script `npm run deploy:secret` のようなものを追加してもよい

## 関連ドキュメント

- [MQTTトピックリファクタリングノート](./2026-10-23-11-27-21-mqtt-iot-topics-refactor.md)
- [Code Engineデプロイトラブルシュートノート](./2026-10-23-13-13-29-deploy-to-code-engine.md)
- [clone後セットアップノート](./2026-10-27-06-02-43-clone-fresh-setup.md)

---

**最終更新**: 2026-10-27
**作成者**: AI
