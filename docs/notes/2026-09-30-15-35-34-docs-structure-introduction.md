---
tags: [docs-structure, kit-my-basic-start, setup, pattern-introduction, documentation]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: kit-my-basic-start を使った docs-structure + setup-securecheck 導入

## 問題

プロジェクトにドキュメント管理の構造がなく、AI との協調作業でドキュメントが散在しがちな状態だった。
AI アシスタントがドキュメントを自律的に探索・管理できる仕組みを整えるため、`docs-structure` パターンの導入を決定した。

## 導入経緯

`kit-my-basic-start`（https://github.com/1ft-seabass/my-ai-collaboration-patterns/patterns/kit-my-basic-start）を使用し、以下の2段階導入を計画：

1. **docs-structure**（今回）：ドキュメント構造の整備
2. **setup-securecheck**（次回）：セキュリティチェックの導入

## 実施手順

`docs-structure` パターンの README.md に記載された「Node.js 環境でのワンショット手順」に従って実施。

```bash
npx degit 1ft-seabass/my-ai-collaboration-patterns/patterns/docs-structure ./tmp/docs-structure-install --force
node ./tmp/docs-structure-install/install.js
rm -rf ./tmp/docs-structure-install
```

## 解決策

`install.js` が `templates/` 配下のファイルを `docs/` に自動配置。新規ファイル 20 件が作成された。

**作成されたディレクトリ構成**:

```
docs/
├── README.md
├── actions/
│   ├── README.md
│   ├── 00_session_end.md
│   ├── 01_git_push.md
│   ├── dev_refactoring.md
│   ├── dev_review.md
│   ├── dev_security.md
│   ├── dev_testing.md
│   ├── doc_letter.md
│   ├── doc_note.md
│   ├── doc_note_and_commit.md
│   ├── git_commit.md
│   ├── help.md
│   └── start_init_rule.md
├── letters/
│   ├── README.md
│   └── TEMPLATE.md
├── notes/
│   ├── README.md
│   └── TEMPLATE.md
└── tasks/
    ├── README.md
    └── TEMPLATE.md
```

## 学び

- `npx degit` + `install.js` の組み合わせで既存ファイルを上書きせず安全にインストールできる
- `docs/actions/` 配下のアクション指示書がそのままAIへの指示書として機能する構造になっている
- `doc_note_and_commit.md` のような指示書で、ノート化→コミットの流れが標準化される

## 今後の予定

- `setup-securecheck` の導入（Step 2）

## 関連ドキュメント

- [kit-my-basic-start](https://github.com/1ft-seabass/my-ai-collaboration-patterns/patterns/kit-my-basic-start)
- [docs-structure パターン](https://github.com/1ft-seabass/my-ai-collaboration-patterns/patterns/docs-structure)

---

**最終更新**: 2026-09-30
**作成者**: Bob (AI)
