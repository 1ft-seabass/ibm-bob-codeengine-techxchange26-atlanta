# MQTT バックエンド + Code Engine 環境変数注入 セットアップ指示書

このファイルは、Hono サーバーに MQTT publish 機能（LED ON/OFF 制御API）を追加し、その接続情報（MQTT接続先・認証情報）をローカルと IBM Code Engine 本番の両方に注入するための単体の指示書です。このファイル単独で読んで実行できるように書かれています（他ドキュメントの参照は不要です）。

フロントエンド側（Babylon.js + Vue3 の画面）は `02-frontend.md` のスコープです。このファイルはバックエンド（`server.js`）と環境変数・デプロイ運用のみを扱います。`01`（`first-prompt.md` = Code Engine デプロイ基盤構築）がすでに完了していることが前提です。

## 追加するAPIエンドポイント

| エンドポイント | トピック | ペイロード |
|---|---|---|
| `POST /api/led/on` | `codeengine/3d/click/on` | `{"type":"click","value":"on"}` |
| `POST /api/led/off` | `codeengine/3d/click/off` | `{"type":"click","value":"off"}` |

- リクエストボディは不要（メソッドとパスのみで意味が確定する）。
- publish 成功時は `{ ok: true }` を HTTP 200 で返す。失敗時は `{ ok: false, error: "..." }` を **HTTP 500** で返す。
  - `02-frontend.md` 側の実装は `res.ok`（HTTPステータスが2xxか）で成功/失敗を判定する前提なので、失敗時に200のまま `ok: false` だけ返すとフロントが誤って成功扱いしてしまう。ステータスコードとレスポンスボディの両方で失敗を表すこと。

## 依存パッケージ

```bash
npm install mqtt dotenv
```

## MQTT クライアント設計（`server.js`）

- サーバー起動時に接続を開始する。ただし `MQTT_HOST` / `MQTT_PORT` / `MQTT_PROTOCOL` が揃っている場合のみ接続を試み、揃っていない場合は警告ログを出して MQTT クライアントを起動しない（サーバー自体は正常起動する）。
- 接続URLは `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}` の形で組み立てる。`MQTT_PROTOCOL` に `mqtts`（生MQTT over TLS、通常ポート8883）または `wss`（MQTT over WebSocket over TLS、通常ポート8884）を入れることでブローカー種別に対応できる。
- 認証情報（`MQTT_USERNAME` / `MQTT_PASSWORD`）は `mqtt.connect(url, { username, password })` に渡す。
- `client.on('error', ...)` を必ず登録する。**未登録だと Node.js の未処理例外でプロセスごとクラッシュする。** ハンドラ内はログ出力のみに留める。
- `client.on('connect', ...)` / `client.on('reconnect', ...)` / `client.on('offline', ...)` もログしておくと運用時に状態が追いやすい。
- 接続確立（`connect`イベント）時に、疎通確認用として `codeengine/connected` トピックへ `{"type":"connected"}` を publish する（QoS 0 / retain なし）。ブローカー側で購読しておけば、サーバーが起動してMQTT接続に成功したことを外部から確認できる。
- `SIGTERM` 受信時に `client.end()` を呼んでクリーンシャットダウンする（Code Engine がコンテナ停止時に送る）。

### publish のラップ（未接続・タイムアウト対策）

- `client.connected === false` の場合は実際に publish を試みず、即座にエラー（`mqtt not connected`）を返す。ブローカー未接続時にAPI呼び出しが無限に待たされないようにする。
- `client.publish()` のコールバックに対して 5 秒程度のタイムアウトを設定し、応答がない場合はタイムアウトエラーを返す。
- QoS 0 / retain なしを既定とする（デモ用途につき、特別な要件がなければこの既定のままでよい）。

## 環境変数・設定ファイルの役割分担（最重要）

このリポジトリには環境変数用のファイルが複数あるが、役割が異なるので混同しないこと。

| ファイル | 役割 | 実行中のアプリが読むか |
|---|---|---|
| `.env.ce` | デプロイスクリプト（`npm run build:*` の `ibmcloud ce ...`）専用 | 読まない |
| `.env`（ローカル用、新規） | ローカルで `node server.js` を起動したときに `dotenv` が読む | ローカル実行時のみ読む |
| `.env.production`（本番用、新規） | Code Engine の Secret を作る際の入力ファイル。作成後はそのままリポジトリに置かず、Secret化したら役目は終わり | 読まない（Secretを経由してCode Engine側の環境変数になる） |

いずれも Git 管理外（`.gitignore` 対象）にすること。`.env.example` を Git 管理下に用意し、キー名と説明だけをサンプルとして残す。

### `.env.example`（ローカル用サンプル）

```
# MQTT ブローカーのホスト名（例: xxxxx.s1.eu.hivemq.cloud）
MQTT_HOST=xxxxx.s1.eu.hivemq.cloud

# MQTT ブローカーのポート番号（mqtts なら通常8883、wss なら通常8884）
MQTT_PORT=8883

# 接続プロトコル: mqtts（生MQTT over TLS）または wss（MQTT over WebSocket over TLS）
MQTT_PROTOCOL=mqtts

# MQTT 認証情報
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password
```

`server.js` の先頭で `require('dotenv').config()` を呼び、起動時に `.env` を読み込む。`.env` が存在しない環境（本番コンテナ等）でも `dotenv` はエラーにせず無視するだけなので、そのままでよい。

## ローカル検証

- `.env.example` をコピーして `.env` を作成し、実際のMQTTブローカー情報を入力する。テスト用には Docker で `mosquitto` をローカル起動するか、HiveMQ Cloud の無料枠を1つ検証用に作っておくとよい。
- `npm start` でサーバーを起動し、`mosquitto_sub` や MQTT Explorer 等で `codeengine/3d/click/on` `codeengine/3d/click/off` を購読しておく。
- ブラウザで立方体をクリックし、購読側にメッセージが届くことを確認する。
- MQTT環境変数を未設定のまま `npm start` した場合でもサーバーは正常起動し、`/api/led/on|off` を叩くと `{ ok: false, error: 'mqtt not connected' }` が返ることを確認する（クラッシュしないことの確認）。
- **サーバープロセスは人間側のターミナルで起動・再起動すること。** AIエージェントの`execute_command`等でバックグラウンド起動したプロセスが残ったまま`.env`を書き換えても、旧プロセスには反映されず「MQTT未接続」のまま原因が分かりにくくなることがある。

## Code Engine（本番）への環境変数注入

Code Engine 上のコンテナはリポジトリの `.env` / `.env.ce` を一切参照しない。アプリケーション自体に環境変数（Secret）として設定する必要がある。

### 1. 本番用ファイルを用意する

```bash
cp .env.example .env.production
# .env.production を編集して本番ブローカー情報を入力（.gitignore 対象）
```

ローカル検証用のブローカー情報をそのまま本番 Secret に流用しないこと。本番用は別ファイルに分ける。

### 2. Secret を作成し、アプリに紐付ける（初回のみ）

```bash
ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production
ibmcloud ce application update --name <APP_NAME> --env-from-secret mqtt-secret
```

`--from-env-file` で `.env` 形式のファイルをそのまま Secret に変換できる。

### 3. Secret を更新する場合（2回目以降）

```bash
ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production
```

Secret を更新しただけではアプリには反映されないので注意。アプリが Secret を環境変数として参照している場合、Code Engine 側の挙動として新しいリビジョンの起動が必要になることがある。反映有無は `ibmcloud ce application get --name <APP_NAME>` で確認する。

### 4. `package.json` へのショートカット追加（推奨）

`01`（`first-prompt.md`）で導入した `dotenv-cli` ベースのデプロイスクリプト（`build:target_region` 等）と同じリージョン/プロジェクト選択を使い回して、以下のスクリプトを追加すると運用が楽になる。

```json
{
  "scripts": {
    "build:env_create": "node scripts/ce-run.js ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production",
    "build:env_update": "node scripts/ce-run.js ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production",
    "build:env_attach": "node scripts/ce-run.js ibmcloud ce application update --name $CE_APP_NAME --env-from-secret mqtt-secret",
    "env:create": "npm run build:target_region && npm run build:target_group && npm run build:select_project && npm run build:env_create",
    "env:update": "npm run build:target_region && npm run build:target_group && npm run build:select_project && npm run build:env_update",
    "env:attach": "npm run build:target_region && npm run build:target_group && npm run build:select_project && npm run build:env_attach"
  }
}
```

運用フロー（初回）:

```bash
npm run env:create   # .env.production から mqtt-secret を作成
npm run env:attach   # アプリに mqtt-secret を紐付け
```

2回目以降（値を変えたとき）:

```bash
npm run env:update
```

> `$VAR` を含むコマンドを `npm run` 経由で実行する場合、Windows PowerShell では `$VAR` がシェル変数として解釈されて期待通りに展開されない問題がある。`dotenv` パッケージで環境変数ファイルを読み込み、引数中の `$VAR` を Node.js 側で置換してから `spawnSync` で実行するヘルパースクリプト（`scripts/ce-run.js`）を経由させることで、bash/PowerShell 双方で同じ `npm run` コマンドが動くようにできる。また `dotenv-cli` は v11 で構文が変わっている（`-e` → `dotenv run -f`）ため、バージョンによって挙動が変わることに注意。この問題を回避するために `dotenv-cli` を直接使わず自前の `ce-run.js` に統一するのも一つの手。

## 確認項目・チェックリスト

- [ ] `mqtt` / `dotenv` パッケージを追加した
- [ ] `/api/led/on` / `/api/led/off` が正しいトピック・ペイロードで MQTT publish する
- [ ] publish失敗時は HTTP 500 で `{ ok: false, error: "..." }` を返す（200のまま`ok:false`にしていない）
- [ ] `client.on('error', ...)` を登録しており、MQTT接続エラーでプロセスがクラッシュしない
- [ ] MQTT接続確立時に `codeengine/connected` へ `{"type":"connected"}` が publish される
- [ ] MQTT未接続時にAPIを叩いても即座にエラーレスポンスが返る（ハングしない）
- [ ] MQTT環境変数が未設定でもサーバーが正常起動する
- [ ] `SIGTERM` 受信時に `client.end()` を呼ぶ処理がある
- [ ] `.env.example` を Git 管理下に用意した（実際の値は書かない）
- [ ] `.env` / `.env.production` が `.gitignore` 対象になっている
- [ ] Code Engine アプリに `mqtt-secret` を作成・紐付けした
- [ ] README 等にローカル/本番それぞれの環境変数設定手順を記載した

## 完了条件

- ローカルで `.env` を設定した状態で `npm start` → 立方体クリックで MQTT publish が成功する。
- `.env` 未設定でもサーバーが起動し、APIはエラーレスポンスを返す（クラッシュしない）。
- Code Engine 本番アプリに `mqtt-secret` を紐付け、本番URLで立方体をクリックした際にも MQTT publish が成功する。
