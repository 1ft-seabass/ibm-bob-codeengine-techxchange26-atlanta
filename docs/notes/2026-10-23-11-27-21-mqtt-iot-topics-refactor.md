---
tags: [mqtt, hono, environment-variables, api, refactor]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-23
**関連タスク**: MQTT IoT トピックの環境変数化とエンドポイントリネーム

## 問題

- Node-RED フローの解析により、末端デバイスへの publish トピックが確定した
- 従来の `/api/led/on` / `/api/led/off` は LED しか制御していなかったが、Servo も同時制御する仕様に変更が必要だった
- トピック（デバイスの MAC アドレスを含む）をコードに直書きすると、デバイス交換時の変更が困難になる

## 試行錯誤

### フォールバック値をコードに直書きする案

**試したこと**: 環境変数が未設定の場合に備えて、`|| 'atoms3/xxxx/control/led'` のようなフォールバックをコードに書いた。

**結果**: 採用せず

**理由**: フォールバックがあると「環境変数を設定し忘れても動いてしまう」ため、設定漏れに気づきにくい。`.env.example` に丁寧なコメントを書いてフォールバックなしにするほうが明示的でよい。

## 解決策

### 環境変数の追加

**実装場所**: `.env.example`, `.env`, `.env.production`, `server.js`

`.env.example` に ON/OFF ペイロードをコメントで明記し、デバイス交換時の手がかりにした:

```
# LED (AtomS3, MAC XXXXXXXXXXXX)
# ON payload : {"type":"led","r":255,"g":255,"b":255}
# OFF payload: {"type":"led","r":0,"g":0,"b":0}
MQTT_IOT_CONTROL_LED=atoms3/XXXXXXXXXXXX/control/led

# Servo (AtomS3, MAC XXXXXXXXXXXX)
# ON payload : {"direction":"cw","speed":3}
# OFF payload: {"command":"stop"}
MQTT_IOT_CONTROL_SERVO=atoms3/XXXXXXXXXXXX/control/servo
```

### server.js の変更

**実装場所**: `server.js`

環境変数をフォールバックなしで読み込み:

```js
const MQTT_IOT_CONTROL_LED   = process.env.MQTT_IOT_CONTROL_LED;
const MQTT_IOT_CONTROL_SERVO = process.env.MQTT_IOT_CONTROL_SERVO;
```

### エンドポイントリネームと並列 publish

LED と Servo を両方制御するため `/api/led/*` → `/api/device/*` にリネーム。
`Promise.all` で LED と Servo を並列 publish:

```js
app.post('/api/device/on', async (c) => {
  await Promise.all([
    publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })),
    publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ direction: 'cw', speed: 3 })),
  ]);
  return c.json({ ok: true });
});

app.post('/api/device/off', async (c) => {
  await Promise.all([
    publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 0, g: 0, b: 0 })),
    publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ command: 'stop' })),
  ]);
  return c.json({ ok: true });
});
```

### フロントエンドの修正

**実装場所**: `public/index.html`

fetch 先を新エンドポイントに変更:
```js
const endpoint = nextOn ? '/api/device/on' : '/api/device/off';
```

### 末端デバイスへの publish 仕様（Node-RED フロー解析結果）

| 対象 | topic | ON時payload | OFF時payload |
|---|---|---|---|
| LED (AtomS3) | `atoms3/XXXX/control/led` | `{"type":"led","r":255,"g":255,"b":255}` | `{"type":"led","r":0,"g":0,"b":0}` |
| Servo (AtomS3) | `atoms3/XXXX/control/servo` | `{"direction":"cw","speed":3}` | `{"command":"stop"}` |

## 学び

- **フォールバックなしが明示的**: 環境変数の設定漏れをランタイムで早期に検出できる。フォールバックは「動いてしまう」ため本番事故の温床になりやすい。
- **`.env.example` にペイロードを書く**: トピックだけでなく ON/OFF 時のペイロード仕様をコメントに残すと、デバイス交換や仕様変更時の調査コストが下がる。
- **`Promise.all` で並列 publish**: 直列にすると片方が遅延した場合に全体が遅くなる。独立した publish は並列で行うのがよい。

## 今後の改善案

- `MQTT_IOT_CONTROL_LED` / `MQTT_IOT_CONTROL_SERVO` が未設定の場合、起動時に警告を出す仕組みを追加してもよい
- デバイス数が増えた場合、トピックを配列や JSON で管理する設計も検討する

## 関連ドキュメント

- [MQTTバックエンド実装ノート](./2026-09-30-21-00-58-mqtt-backend-and-env-injection.md)
- [エンドツーエンド動作確認ノート](./2026-09-30-21-11-40-e2e-verification-complete.md)

---

**最終更新**: 2026-10-23
**作成者**: AI
