# IBM Code Engine デプロイ基盤 セットアップ指示書

このファイルは、Node.js(Hono)+ IBM Cloud Code Engine による Web アプリのデプロイ基盤を、
新しいリポジトリ・新しいプロジェクトに構築するための単体の指示書です。
このファイル単独で読んで実行できるように書かれています(他ドキュメントの参照は不要です)。

## この指示書で作るもの

- Hono フレームワークによる Node.js の Web サーバー(静的ファイル配信 + API)
- それを Docker イメージ化して IBM Cloud Code Engine 上で動かす一式
- GitHub リポジトリを直接ソースにして `ibmcloud` CLI だけでビルド・デプロイが完結する運用
- 日常更新を `git push` → `npm run build` の2手順に短縮する仕組み

フロントエンドの技術選定(Vue 等の導入)はこの指示書のスコープ外とする。
まずは素の HTML + サーバーが動く状態を作ることを優先し、フロントは後から差し替えてよい。

## 前提条件

- `ibmcloud` CLI がインストール済み、ログイン済みであること
- `ibmcloud plugin install code-engine` で `code-engine` プラグインが導入済みであること
- デプロイ先の IBM Cloud Code Engine **プロジェクトが既に存在**していること
  (プロジェクトが無い場合のみ `ibmcloud ce project create --name <PROJECT_NAME>` で作成する)
- デプロイ元となる GitHub リポジトリが**公開(public)リポジトリ**として用意されていること
  (プライベートリポジトリの場合、`--build-source` だけでは認証できず、
  別途アクセストークン等の設定が必要になる。その手順はこの指示書の範囲外とする)

## 手順

### 1. サーバー本体を作る

`package.json` に以下を追加する:

```json
{
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0"
  }
}
```

`server.js` を作成する:

```js
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');

const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

// IBM Code Engine はコンテナに PORT 環境変数を自動設定するため、必ず process.env.PORT を優先すること
const port = process.env.PORT || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});
```

`public/index.html` に最低限の静的ページを1つ置く(中身は自由。動作確認できればよい)。

### 2. Dockerfile を作る

```dockerfile
FROM icr.io/codeengine/node:22-alpine
COPY package.json .
RUN npm install
RUN mkdir public
COPY public/ public/
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
```

注意: `npm install` は `devDependencies` も含めてしまう。本番イメージを軽量化したい場合は
`RUN npm install --omit=dev` に変更すること(セキュリティチェック系のツールなど、本番実行に不要な
パッケージが devDependencies にある場合は特に推奨)。

### 3. リポジトリを push する

**Code Engine は GitHub リポジトリを直接参照してビルドするため、ローカルにコミットしただけでは
不十分。必ず `git push` してリモートに Dockerfile が存在する状態にしてから次に進むこと。**
push 前にビルドを実行すると `Dockerfile not found` 相当のエラーでビルドが失敗する。

```bash
git push origin main
```

### 4. Code Engine プロジェクトを選択する

```bash
ibmcloud target -g default
ibmcloud ce project select --name <PROJECT_NAME>
```

### 5. アプリを作成する(ビルド+デプロイを一括実行)

```bash
ibmcloud ce application create \
  --name <APP_NAME> \
  --build-source https://github.com/<owner>/<repo> \
  --build-strategy dockerfile \
  --build-size medium \
  --port 8080 \
  --wait
```

`--wait` を付けるとビルド完了・起動確認まで待って公開 URL を返す。

オプション名の注意: `application create` では `--build-source` を使う。
`ibmcloud ce build create` 単体では同じ意味のオプションが `--source` になり名前が異なるため、
`application create` に統一して使う方が混乱がない。

### 6. 動作確認

```bash
curl https://<出力されたURL>/
curl https://<出力されたURL>/api/hello
```

アプリの状態(URL・現在のイメージ・稼働状況)はコマンドでも確認できる:

```bash
ibmcloud ce application get --name <APP_NAME>
```

ビルドが失敗した場合は、ビルドのログ・イベントをコマンドで確認する:

```bash
ibmcloud ce buildrun get --name <APP_NAME>
ibmcloud ce build events --build <BUILD_NAME>
```

これらのコマンドで状況が掴みにくい場合のみ、IBM Cloud コンソールの Code Engine 画面を
開いてビジュアルに確認してもよい(必須ではない)。

### 7. 日常更新フローを整備する

`.env.ce` というファイルを作り、**Git 管理対象外**にする(`.gitignore` に追記):

```bash
CE_BUILD_NAME=<application create 実行時に自動生成されたbuild名。ibmcloud ce build list で確認可能>
CE_APP_NAME=<APP_NAME>
CE_BUILD_IMAGE=private.<region>.icr.io/<ICR_NAMESPACE>/build-<CE_BUILD_NAME>:latest
```

`dotenv-cli` を導入し、`package.json` に以下を追加する:

```json
{
  "scripts": {
    "build:image_build": "dotenv -e .env.ce -- ibmcloud ce buildrun submit --build $CE_BUILD_NAME --wait",
    "build:update_app": "dotenv -e .env.ce -- ibmcloud ce application update --name $CE_APP_NAME --image $CE_BUILD_IMAGE --wait",
    "build": "npm run build:image_build && npm run build:update_app"
  }
}
```

以降の更新作業は次の2手順のみで完結する:

```bash
git push origin main
npm run build
```

## 運用上の注意点(ハマりどころ)

- **イメージの種類を混同しない**: `application create` が生成する `app-<APP_NAME>:<タイムスタンプ>`
  イメージと、`buildrun submit` が生成する `build-<CE_BUILD_NAME>:latest` イメージは別物。
  コンテナレジストリのクリーンアップを行う際、稼働中アプリが参照している `app-*` タグ付きイメージを
  削除するとアプリが `404` で応答不能になる。`build-*:latest` だけ残せば安全。
- **1つのプロジェクトに複数アプリを同居させてよい**: 新しいアプリを追加する際にプロジェクトを
  作り直す必要はない。`ibmcloud ce project select` で既存プロジェクトを選び、
  手順5から始めればよい。ただし ICR の namespace はプロジェクト内で共有されるため、
  アプリが増えるほどイメージが蓄積しやすくなる点は意識すること。
- **機密性のある値をリポジトリに直書きしない**: ICR の内部 URL やプロジェクト固有の名前は
  `.env.ce`(Git管理外)に切り出し、`package.json` の scripts には環境変数参照のみを書く。
  これによりこのリポジトリ自体を別プロジェクトのベースとして使い回せる状態を保てる。

## 完了条件

- `curl` でトップページと `/api/hello` の両方が 200 で応答する
- `.env.ce` に3つの値が設定され、Git 管理対象外になっている
- `npm run build` を実行するだけで再デプロイが完結する
