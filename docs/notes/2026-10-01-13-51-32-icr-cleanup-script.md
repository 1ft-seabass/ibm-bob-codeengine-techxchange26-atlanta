---
tags: [icr, code-engine, cleanup, maintenance, storage]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-01
**関連タスク**: ICR ストレージ 80% 超え対応 — 自動クリーンアップ整備

## 問題

`npm run build` を繰り返すと ICR に不要なダイジェスト（タグなし）が蓄積し、ストレージ上限（512 MB）を圧迫する。

- `ibmcloud cr images` では**タグ付きイメージしか見えない**
- タグを削除してもダイジェスト（レイヤー実体）は残り続ける
- `ibmcloud cr image-digests` で初めてタグなしダイジェストが確認できる

調査の結果、424 MB の使用量の大半はこのタグなしダイジェストの残留が原因だった。

## 解決策

### `scripts/ce-cleanup.js`

`npm run build` の最後に自動実行されるクリーンアップスクリプト。

**動作**:
1. `.env.ce` の `CE_BUILD_IMAGE` から ICR の region / namespace / repository を取得
2. `ibmcloud cr image-digests` でタグなしダイジェストを一覧取得
3. `latest` タグが付いているものは**スキップ**（削除禁止）
4. タグなしのみ `ibmcloud cr image-rm` で削除

**実装場所**: `scripts/ce-cleanup.js`

### `package.json` への組み込み

```json
"build:cleanup": "node scripts/ce-cleanup.js",
"build": "npm run build:image_build && npm run build:update_app && npm run build:cleanup"
```

`npm run build` の流れ:
1. `build:image_build` → 新しい `latest` を ICR に push
2. `build:update_app` → Code Engine アプリを更新
3. `build:cleanup` → 古いタグなしダイジェストを自動削除

### ICR のタグ vs ダイジェストの関係

| コマンド | 見えるもの |
|---|---|
| `ibmcloud cr images` | タグ付きイメージのみ |
| `ibmcloud cr image-digests` | タグ付き + **タグなし**（全ダイジェスト） |

タグを削除しただけでは実体（ダイジェスト）は残る。ダイジェスト単位で削除して初めてストレージが解放される。

## 学び

- **`ibmcloud cr images` だけでは不十分**: タグなしダイジェストは `image-digests` コマンドでしか見えない。ストレージが減らないと感じたら `image-digests` で確認する。
- **GC のタイミングは不定期**: 削除直後は使用量が反映されないことがある。時間をおいて再確認する。
- **`latest` タグのダイジェストは削除禁止**: 稼働中のアプリが参照しているため、必ずタグの有無を確認してから削除する。

## 今後の改善案

- クリーンアップ後に `ibmcloud cr quota` を表示して使用量を確認するステップを追加してもよい

## 関連ドキュメント

- [ICR ストレージ調査ノート](./2026-09-30-16-00-03-icr-storage-investigation.md)
- [Code Engine 初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)

---

**最終更新**: 2026-10-01
**作成者**: AI
