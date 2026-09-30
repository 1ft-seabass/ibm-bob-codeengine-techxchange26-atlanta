---
tags: [code-engine, mqtt, deploy, verification, complete]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: `01-first-prompt.md` / `02-frontend.md` / `03-env.md` 全完了

## 問題

3本の指示書（デプロイ基盤・フロントエンド・MQTTバックエンド）を通じて構築した一式が、本番 Code Engine 上でエンドツーエンドで動作することを確認する必要があった。

## 試行錯誤

### push 前ビルドによる 404 問題

**状況**: `03-env.md` の実装後、コミットはしたが push 前に `npm run build` を実行。ビルド・デプロイは成功したが本番 URL で `/api/led/on` が 404 を返した。

**原因**: Code Engine は GitHub を clone してビルドするため、push 前の状態では古い `package.json`（`mqtt`/`dotenv` 未記載）でビルドされ、コンテナ内に `mqtt` がインストールされず起動失敗した。

**解決**: コミット → push → `npm run build` の順に実施し、正常に動作することを確認。

## 解決策（最終的な動作確認結果）

### 本番 URL での API 動作確認

```bash
curl -X POST https://YOUR_APP_URL/api/led/on
# → {"ok":true}

curl -X POST https://YOUR_APP_URL/api/led/off
# → {"ok":true}
```

### フロントエンド動作確認

- ブラウザで本番 URL を開くと Babylon.js の3D立方体が表示・自転
- 立方体クリックで `/api/led/on` / `/api/led/off` が叩かれ、MQTT ブローカーへメッセージが到達することを確認
- ドロワー開閉・回転トグル・アングルリセットも正常動作

### 構築した一式のまとめ

| ファイル / スクリプト | 役割 |
|---|---|
| `server.js` | Hono サーバー（静的配信 + MQTT publish API） |
| `public/index.html` | Babylon.js + Vue3 + Bootstrap5 フロントエンド |
| `Dockerfile` | `icr.io/codeengine/node:22-alpine` ベース |
| `scripts/ce-run.js` | `.env.ce` 読み込み・`$VAR` 置換・ibmcloud 実行ヘルパー |
| `.env.example` | 環境変数キー名サンプル（Git管理対象） |
| `.env` | ローカル用 MQTT 接続情報（Git管理外） |
| `.env.ce` | デプロイスクリプト用（Git管理外） |
| `.env.production` | Code Engine Secret 作成用（Git管理外・作成後は役目終了） |

### 日常更新フロー（確立済み）

```bash
# コードを変更したら
git add ...
git commit -m "feat: ..."
git push origin main
npm run build        # buildrun → application update
```

### Code Engine 環境変数更新フロー（確立済み）

```bash
# MQTT接続情報を変えたいとき
# .env.production を編集してから
npm run env:update   # mqtt-secret を上書き
npm run build        # アプリを再デプロイ
```

## 学び

- **push → build の順番厳守**: Code Engine は GitHub clone ベースのビルドのため、ローカル変更は必ず push してからビルドする
- **`app-*` イメージは毎ビルドで蓄積**: ICR の 512MB 制限があるため、定期的に古い `app-*` タグを削除する運用が必要（詳細は ICR ストレージ調査ノートを参照）

## 今後の課題

- MQTT ブローカーの接続設定の調整（ブローカー側の設定最適化）
- ICR ストレージの定期クリーンアップ運用の整備
- フロントエンドの追加機能実装（Vue3 コンポーネント化等）

## 関連ドキュメント

- [Code Engine 初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [ICR ストレージ調査ノート](./2026-09-30-16-00-03-icr-storage-investigation.md)
- [Babylon.js フロントエンド実装ノート](./2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md)
- [MQTT バックエンド実装ノート](./2026-09-30-21-00-58-mqtt-backend-and-env-injection.md)

---

**最終更新**: 2026-09-30
**作成者**: AI
