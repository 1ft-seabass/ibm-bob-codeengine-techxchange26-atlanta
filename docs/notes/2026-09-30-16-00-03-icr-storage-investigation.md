---
tags: [icr, code-engine, storage, maintenance, ibmcloud]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: ICR ストレージ 80% 超え警告の調査

## 問題

`npm run build` 実行中に以下の警告が出た:

```
IBM Container Registry のストレージ使用量が割り当て量の 80% を超えています。
```

ストレージ上限に達するとビルド・デプロイが失敗するリスクがあるため、現状を調査した。

## 調査

### ストレージ使用量の確認

```bash
ibmcloud cr quota
```

**結果**:

| 項目 | 制限 | 使用済み |
|---|---|---|
| プル・トラフィック | 5.0 GB | 0 B |
| ストレージ | 512 MB | 422 MB（約 82%） |

残り約 90 MB。1回のビルドで約 60〜70 MB 消費するため、あと 1〜2 回のビルドで上限に達する可能性がある。

### 現在のイメージ一覧

```bash
ibmcloud cr images
```

**結果（プロジェクト `YOUR_PROJECT_NAME` / namespace `YOUR_ICR_NAMESPACE`）**:

| イメージ | タグ | サイズ | 削除可否 |
|---|---|---|---|
| `app-hono-app` | `TIMESTAMP` | 62 MB | ❌ 稼働中アプリが参照 |
| `app-ibm-bob-codeengine-sample-02` | `TIMESTAMP` | 62 MB | ❌ 稼働中アプリが参照 |
| `build-bob-codeengine-sample-build` | `latest` | 67 MB | ❌ 次回ビルドに必要 |
| `build-hono-app-build` | `latest` | 62 MB | ❌ 次回ビルドに必要 |
| `build-ibm-bob-codeengine-sample-02-build` | `latest` | 69 MB | ❌ 次回ビルドに必要 |

**結論**: 現時点で安全に削除できるイメージはない。全て稼働中アプリの参照先か次回ビルドに必要なもの。

### イメージの種類と役割

Code Engine が ICR に作成するイメージには2種類ある:

| 種類 | 命名パターン | 生成タイミング | 役割 |
|---|---|---|---|
| `app-*` | `app-{APP_NAME}:{タイムスタンプ}` | `application create` / `application update` 時 | アプリが実際に参照するイメージ |
| `build-*` | `build-{BUILD_NAME}:latest` | `buildrun submit` 時 | ビルド成果物（`application update --image` で指定） |

- `app-*` タグは `application update` のたびに新しいタイムスタンプで追加される（古いものが残り続ける）
- `build-*:latest` は上書きされるため蓄積しない

## 解決策

### 今後の運用

`npm run build` を実行するたびに `app-*` タグが1つ追加される。定期的に古い `app-*` タグを削除する必要がある。

**削除してよいもの**:
- `app-{APP_NAME}:{古いタイムスタンプ}` — 現在アプリが参照していないもの

**削除してはいけないもの**:
- `app-{APP_NAME}:{現在のタイムスタンプ}` — `ibmcloud ce application get --name YOUR_APP_NAME` で確認できる
- `build-{BUILD_NAME}:latest` — 次回 `buildrun submit` の出力先

### 現在参照中のイメージ確認コマンド

```bash
ibmcloud ce application get --name YOUR_APP_NAME
# → "イメージ:" 欄に表示されているタグが削除禁止
```

### 古い `app-*` タグの削除コマンド

```bash
ibmcloud cr image-rm YOUR_ICR_REGION/YOUR_ICR_NAMESPACE/app-YOUR_APP_NAME:OLD_TIMESTAMP
```

### ストレージ使用量の確認コマンド

```bash
ibmcloud cr quota
```

## 学び

- **`app-*` イメージは毎回 `application update` で蓄積する**: `build-*:latest` と違い、`app-*` はタイムスタンプ付きで積み重なる。Lite プランの 512 MB 制限では数回のデプロイでひっ迫する。
- **削除前に必ず現在の参照イメージを確認する**: `application get` で確認せずに削除すると、アプリが 404 で応答不能になる。
- **`build-*:latest` は消さなくてよい**: 常に上書きされるため蓄積しない。削除するとむしろ次回 `buildrun submit` が失敗する。

## 今後の改善案

- `npm run build` 後に古い `app-*` タグを自動削除するスクリプト（`scripts/ce-cleanup.js` 等）の追加を検討する
- ICR のストレージ使用量をビルド後に自動表示する仕組みを追加する

## 関連ドキュメント

- [Code Engine 初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)

---

**最終更新**: 2026-09-30
**作成者**: AI
