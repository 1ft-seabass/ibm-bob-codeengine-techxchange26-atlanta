---
tags: [mqtt, hono, code-engine, dotenv, backend]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: `tmp/03-env.md` — MQTT バックエンド実装 + Code Engine 環境変数注入

## 問題

- `02-frontend.md` で実装した立方体クリックの `/api/led/on` / `/api/led/off` が未実装だった
- MQTT ブローカーへの接続情報をローカルと Code Engine 本番の両方に安全に注入する仕組みが必要だった
- `scripts/ce-run.js` が固定コマンドしか対応しておらず、`ibmcloud ce secret` 系コマンドに使えなかった

## 試行錯誤

### push 前に `npm run build` すると mqtt が入らない問題

**試したこと**: ローカルで `server.js` と `package.json` を変更した状態で `npm run build` を実行。ビルド成功・デプロイも完了したが、本番 URL で `/api/led/on` を叩くと `404` が返った。

**原因**: Code Engine は GitHub リポジトリを clone してビルドする。ローカルの変更がコミット・push される前にビルドしたため、GitHub 上には古い `package.json`（`mqtt`/`dotenv` が未記載）が残っており、`npm install --omit=dev` で `mqtt`/`dotenv` がインストールされなかった。結果、`server.js` の `require('mqtt')` が失敗してサーバーが起動できず 404 になった。

**教訓**: `npm run build` は必ず **コミット → push → ビルド** の順で行うこと。

---

### `scripts/ce-run.js` の `$VAR` 展開問題

**背景**: `env:attach` スクリプトで `--name $CE_APP_NAME` のように環境変数参照を書く必要があった。Windows の PowerShell/cmd では shell が `$VAR` を展開しないため、`ce-run.js` 側で展開する必要があった。

**解決**: `ce-run.js` に `substituteVars()` 関数を追加し、`.env.ce` の値で `$VAR` を Node.js 側で置換してから `execSync` に渡すように変更。

## 解決策

### `server.js` の MQTT 実装ポイント

```js
// MQTT_HOST / MQTT_PORT / MQTT_PROTOCOL が揃っている場合のみ接続
if (MQTT_HOST && MQTT_PORT && MQTT_PROTOCOL) {
  const url = `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`;
  mqttClient = mqtt.connect(url, { username: MQTT_USERNAME, password: MQTT_PASSWORD });
  // connect / reconnect / offline / error イベントをそれぞれ登録
} else {
  console.warn('[mqtt] 未設定。MQTT クライアントを起動しません。');
}
```

**重要ポイント**:
- `client.on('error', ...)` を**必ず登録**。未登録だと接続エラーでプロセスがクラッシュする
- `SIGTERM` 受信時に `client.end()` でクリーンシャットダウン（Code Engine がコンテナ停止時に送る）
- 接続確立時に `codeengine/connected` トピックへ `{"type":"connected"}` を publish（外部から起動確認できる）

### publish ヘルパー（未接続チェック + タイムアウト）

```js
function publishAsync(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      return reject(new Error('mqtt not connected')); // 即座にエラー（ハングしない）
    }
    const timer = setTimeout(() => reject(new Error('mqtt publish timeout')), 5000);
    mqttClient.publish(topic, payload, { qos: 0, retain: false }, (err) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve();
    });
  });
}
```

### API エンドポイント

| エンドポイント | トピック | ペイロード |
|---|---|---|
| `POST /api/led/on` | `codeengine/3d/click/on` | `{"type":"click","value":"on"}` |
| `POST /api/led/off` | `codeengine/3d/click/off` | `{"type":"click","value":"off"}` |

- 成功時: `{ ok: true }` HTTP 200
- 失敗時: `{ ok: false, error: "..." }` **HTTP 500**（フロントが `res.ok` で判定するため必ず500を返す）

### 環境変数ファイルの役割分担

| ファイル | 役割 | Git管理 |
|---|---|---|
| `.env` | ローカル実行時に `dotenv` が読む | 管理外 |
| `.env.production` | Secret 作成用の入力ファイル | 管理外 |
| `.env.ce` | `npm run build:*` 用のデプロイスクリプト専用 | 管理外 |
| `.env.example` | キー名のサンプル（実値なし） | **管理対象** |

### Code Engine への環境変数注入フロー（初回）

```bash
cp .env.example .env.production
# .env.production に本番ブローカー情報を記入

npm run env:create   # ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production
npm run env:attach   # ibmcloud ce application update --name <APP_NAME> --env-from-secret mqtt-secret
```

2回目以降（値を更新したとき）:

```bash
npm run env:update   # ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production
```

### `scripts/ce-run.js` の汎用化

任意の `ibmcloud` コマンドを `.env.ce` の値で `$VAR` 置換して実行できるように拡張:

```js
// 使い方: node scripts/ce-run.js ibmcloud ce application update --name $CE_APP_NAME ...
} else if (subcommand === 'ibmcloud') {
  const rawArgs = process.argv.slice(2).join(' ');
  cmd = substituteVars(rawArgs); // $CE_APP_NAME → 実際の値に置換
}
```

## 学び

- **push 前にビルドしない**: Code Engine は GitHub clone ベースのビルドのため、ローカル変更は必ず push してからビルドする。`server.js` と `package.json` が同時に変わる場合は特に注意。
- **`client.on('error')` は必須**: Node.js の EventEmitter は `error` イベントのリスナーが未登録だと未処理例外になりプロセスがクラッシュする。MQTT クライアントも同様。
- **失敗時は必ず HTTP 500 を返す**: フロントエンドが `res.ok`（2xx判定）で成功/失敗を判定している場合、`{ ok: false }` を HTTP 200 で返すと誤って成功扱いされる。

## 今後の改善案

- `npm run build` の前に未 push のコミットがないかチェックするスクリプトを追加してもよい
- `env:create` が「既に存在する」エラーで失敗したとき、自動で `env:update` にフォールバックする仕組みを検討する

## 関連ドキュメント

- 指示書: `tmp/03-env.md`
- [Code Engine 初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [Babylon.js フロントエンド実装ノート](./2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md)

---

**最終更新**: 2026-09-30
**作成者**: AI
