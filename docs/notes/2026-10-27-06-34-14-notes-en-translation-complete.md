---
tags: [docs, translation, english, notes, maintenance]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-27
**関連タスク**: docs/notes/en 整備 — 全日本語ノートの英訳・登壇向けドキュメント公開

## 問題

IBM TechXchange 2026 Atlanta の登壇にあたり、GitHub 上で英語参加者が読めるドキュメントが必要だった。
`docs/notes/` 配下の日本語ノートと `tmp/` 指示書を英訳し、`docs/notes/en/` に整備した。

## やったこと

### 1. tmp/ 指示書の英訳（3本）

`tmp/` 配下の指示書を `docs/notes/en/` に英訳して配置。**ファイル名は `tmp/` と同名に統一**（対応関係を明確にするため）。

| 元ファイル | 英訳ファイル |
|---|---|
| `tmp/01-first-prompt.md` | `docs/notes/en/01-first-prompt.md` |
| `tmp/02-frontend.md` | `docs/notes/en/02-frontend.md` |
| `tmp/03-env.md` | `docs/notes/en/03-env.md` |

※ 初回は `01-code-engine-deploy-setup.md` 等の説明的な名前で作成したが、ユーザーの指摘で `tmp/` と同名に統一し直した。

### 2. 日本語ノートの英訳（14本）

`docs/notes/` 配下の全日本語ノートを英訳して `docs/notes/en/` に配置。同じファイル名を使用。

| 日付 | ノート |
|---|---|
| 2026-09-30 | `2026-09-30-16-00-03-codeengine-initial-setup.md` |
| 2026-09-30 | `2026-09-30-16-00-03-icr-storage-investigation.md` |
| 2026-09-30 | `2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md` |
| 2026-09-30 | `2026-09-30-21-00-58-mqtt-backend-and-env-injection.md` |
| 2026-09-30 | `2026-09-30-21-11-40-e2e-verification-complete.md` |
| 2026-10-01 | `2026-10-01-13-51-32-icr-cleanup-script.md` |
| 2026-10-23 | `2026-10-23-11-27-21-babylon-ui-improvements.md` |
| 2026-10-23 | `2026-10-23-11-27-21-mqtt-iot-topics-refactor.md` |
| 2026-10-23 | `2026-10-23-13-13-29-deploy-to-code-engine.md` |
| 2026-10-27 | `2026-10-27-06-02-43-bob-coin-cost-analysis.md` |
| 2026-10-27 | `2026-10-27-06-02-43-clone-fresh-setup.md` |
| 2026-10-27 | `2026-10-27-06-02-43-mqtt-led2-and-deploy.md` |

※ 段階的に作業: 初手3件（コスト確認）→ 残り9件一括

### 3. docs/notes/ 直下への指示書コピー

`tmp/` の指示書3本を `docs/notes/` 直下にも配置（日本語原文として）。

### 4. コミット一覧

| コミット | 内容 |
|---|---|
| `aed8505` | tmp指示書3本の英訳をdocs/notes/enに追加 |
| `54d2431` | docs/notes/enのファイル名をtmp/と同名に統一 |
| `921b4e5` | 初期3ノートの英訳をdocs/notes/enに追加 |
| `970f54e` | 残り9ノートの英訳をdocs/notes/enに追加（全ノート英訳完了） |
| `a39f53c` | tmp指示書3本をdocs/notesに追加（日本語原文） |

## docs/notes/en/ の最終構成

```
docs/notes/en/
├── 01-first-prompt.md              # Code Engine デプロイ基盤セットアップ（英訳）
├── 02-frontend.md                  # Babylon.js+Vue3 フロントエンド（英訳）
├── 03-env.md                       # MQTTバックエンド+環境変数注入（英訳）
├── 2026-09-30-*（5本）             # 初期構築ノート群
├── 2026-10-01-*（1本）             # ICRクリーンアップ
├── 2026-10-23-*（3本）             # UI改修・MQTTリファクタ・デプロイ
└── 2026-10-27-*（3本）             # 今日の作業ノート群
```

## 学び

- **ファイル名は対応する日本語ノートと同名にする**: 最初に説明的な名前で作ると後でリネームが必要になる。最初から同名にすれば `git mv` のコストが不要。
- **段階的なバッチ処理が有効**: 全件一括より「数件試してコスト確認 → 残り一括」の方がリスクが低く、ユーザーも安心できる。
- **英訳の品質方針**: FrontMatter タグはそのまま（英語キーワードなので変更不要）、⚠️ 注意書きは英語化、日本語固有の慣用表現は同等の英語表現に置き換えた。

## 今後の改善案

- 新しいノートを追加する際は日本語版と同時に英訳版も `docs/notes/en/` に作成するフローにすると蓄積を防げる
- `docs/notes/en/README.md` を追加して英語読者向けの案内ページを用意してもよい

## 関連ドキュメント

- [英訳セッションのBob Coinコスト分析](./2026-10-27-06-34-14-bob-coin-translation-cost-analysis.md)

---

**最終更新**: 2026-10-27
**作成者**: AI
