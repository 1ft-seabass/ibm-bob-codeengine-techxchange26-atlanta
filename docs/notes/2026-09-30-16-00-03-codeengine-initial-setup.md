---
tags: [code-engine, hono, docker, ibmcloud, deploy]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: Code Engine デプロイ基盤の初期構築

## 問題

このリポジトリを IBM Cloud Code Engine 上で動かすデプロイ基盤がなかった。
`git push` → `npm run build` の2手順で再デプロイが完結する仕組みを作る必要があった。

## 試行錯誤

### `dotenv-cli` + `$VAR` 形式（失敗）

**試したこと**: 指示書通りに `dotenv-cli` を使い `package.json` の scripts に `$CE_BUILD_NAME` 形式で環境変数を記述。

**結果**: 失敗

**理由**: Windows の npm は `cmd.exe` 経由でスクリプトを実行するため、`$CE_BUILD_NAME` が展開されずリテラル文字列として `ibmcloud` に渡されてしまった。`%CE_BUILD_NAME%` に変えても `dotenv-cli` が環境変数を設定するのは子プロセス起動後のため、shell の引数展開が先に起きて同様に失敗した。

---

### `scripts/ce-run.js` ヘルパー（成功）

**試したこと**: Node.js スクリプトで `.env.ce` を直接読み込み、`child_process.execSync` で `ibmcloud` コマンドを組み立てて実行。

**結果**: 成功

**コード例**:
```js
// scripts/ce-run.js（抜粋）
const envVars = {}; // .env.ce を parse して格納
if (subcommand === 'buildrun') {
  cmd = `ibmcloud ce buildrun submit --build ${envVars.CE_BUILD_NAME} --wait`;
} else if (subcommand === 'update_app') {
  cmd = `ibmcloud ce application update --name ${envVars.CE_APP_NAME} --image ${envVars.CE_BUILD_IMAGE} --wait`;
}
execSync(cmd, { stdio: 'inherit' });
```

## 解決策

### 構成ファイル一覧

| ファイル | 役割 |
|---|---|
| `server.js` | Hono サーバー（静的配信 + `/api/hello`） |
| `public/index.html` | 動作確認用静的ページ |
| `Dockerfile` | `icr.io/codeengine/node:22-alpine` ベース |
| `scripts/ce-run.js` | `.env.ce` を読んで `ibmcloud` を実行するヘルパー |
| `.env.ce` | CE_BUILD_NAME / CE_APP_NAME / CE_BUILD_IMAGE（Git管理外） |

### `.env.ce` の形式（プレースホルダー）

```
CE_BUILD_NAME=YOUR_BUILD_NAME
CE_APP_NAME=YOUR_APP_NAME
CE_BUILD_IMAGE=private.YOUR_REGION.icr.io/YOUR_ICR_NAMESPACE/build-YOUR_BUILD_NAME:latest
```

### デプロイコマンド（初回）

```bash
ibmcloud target -g default
ibmcloud ce project select --name YOUR_PROJECT_NAME
ibmcloud ce application create \
  --name YOUR_APP_NAME \
  --build-source https://github.com/YOUR_ORG/YOUR_REPO \
  --build-strategy dockerfile \
  --build-size medium \
  --port 8080 \
  --wait
```

### 日常更新フロー

```bash
git push origin main
npm run build
```

`npm run build` の内訳:
1. `build:image_build` → `ibmcloud ce buildrun submit --build YOUR_BUILD_NAME --wait`
2. `build:update_app` → `ibmcloud ce application update --name YOUR_APP_NAME --image YOUR_BUILD_IMAGE --wait`

### `application create` と `build create` の使い分け

- `application create --build-source` は build オブジェクトを**作らない**（buildrun を直接実行する）
- 日常更新で `buildrun submit` を使うには、別途 `ibmcloud ce build create` で build オブジェクトを作成する必要がある
- build 作成後、`ibmcloud ce build get --name YOUR_BUILD_NAME` でイメージ出力先を確認して `.env.ce` に設定する

### Dockerfile のポイント

```dockerfile
FROM icr.io/codeengine/node:22-alpine
COPY package.json .
RUN npm install --omit=dev   # devDependencies を除外して軽量化
RUN mkdir public
COPY public/ public/
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
```

- Code Engine はコンテナに `PORT` 環境変数を自動設定するため、`server.js` では `process.env.PORT || 8080` を使う

## 学び

- **Windows 環境での `dotenv-cli` の落とし穴**: shell の引数展開と環境変数設定のタイミングの差異により、Windows では `dotenv -e .env -- cmd $VAR` 形式が動かない。Node.js スクリプトで `.env` を直接 parse する方が確実。
- **`application create` は build オブジェクトを作らない**: 日常更新フローで `buildrun submit` を使うには、初回に `ibmcloud ce build create` を別途実行する必要がある。
- **`app-*` イメージの削除は危険**: 稼働中アプリが参照しているタイムスタンプ付きイメージを削除するとアプリが 404 になる。`build-*:latest` だけ残せば次回ビルドは機能する。

## 今後の改善案

- ICR ストレージが逼迫しているため、`npm run build` 後に古い `app-*` タグを自動削除するスクリプトの追加を検討する

## 関連ドキュメント

- [ICRストレージ調査ノート](./2026-09-30-16-00-03-icr-storage-investigation.md)
- 指示書: `tmp/01-first-prompt.md`

---

**最終更新**: 2026-09-30
**作成者**: AI
