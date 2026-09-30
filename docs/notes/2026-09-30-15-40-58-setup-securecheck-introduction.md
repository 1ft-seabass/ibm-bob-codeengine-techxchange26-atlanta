---
tags: [setup-securecheck, security, gitleaks, secretlint, pre-commit, kit-my-basic-start]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-30
**関連タスク**: kit-my-basic-start を使った docs-structure + setup-securecheck 導入（Step 2）

## 問題

`docs-structure` 導入（Step 1）に続き、シークレット漏洩を防ぐセキュリティチェック体制が未整備だった。
APIキーやトークンが誤ってコミットされるリスクを防ぐため、`setup-securecheck` パターンの導入を決定した。

## 導入経緯

`kit-my-basic-start`（https://github.com/1ft-seabass/my-ai-collaboration-patterns/patterns/kit-my-basic-start）の Step 2 として実施。
`setup-securecheck` の `quickstart.md` に記載された手順に従って進めた。

## 実施手順

### 1. 取得とファイル配置

```bash
npx degit 1ft-seabass/my-ai-collaboration-patterns/patterns/setup-pattern/setup-securecheck ./tmp/security-setup
node ./tmp/security-setup/install.js
```

**結果**: 14ファイル新規作成、gitleaks v8.30.0 をダウンロード・配置

作成されたファイル：
- `.secretlintrc.json`
- `gitleaks.toml`
- `.security-check/` 配下（cli.js、各種 lib、package.json、README.md）

### 2. スキャン実行

```bash
node .security-check/cli.js scan --all
```

**結果**: secretlint・gitleaks ともに 0件検出・問題なし

### 3. package.json マージ

`tmp/security-setup/templates/package.json.example` の内容を既存 `package.json` にマージ。

追加内容：
- `scripts.security`: `node .security-check/cli.js`
- `scripts.postinstall`: `npx simple-git-hooks`
- `simple-git-hooks.pre-commit`: `node .security-check/cli.js pre-commit`
- `devDependencies.simple-git-hooks`: `^2.0.0`

既存の `secretlint` / `@secretlint/...` は `^13.0.6`（新しい方）を維持。

### 4. setup-local 実行

```bash
node .security-check/cli.js setup-local
```

**結果**: 15/15 passed
- フック有効化（`npx simple-git-hooks`）
- `.gitignore` に `.security-check/bin/` と `tmp/` を追記
- フェイルクローズ確認・ネガティブテスト・verify まで完了

### 5. 後始末

```bash
rm -rf tmp/security-setup
```

### 6. npm 経由の最終確認（AI + 人間の両方で実施）

```bash
npm run security -- verify --test-run
```

**結果**: 15/15 passed, 0 failed, 0 warning

## 解決策

pre-commit フックに `node .security-check/cli.js pre-commit` が設定され、コミット時に自動でシークレットスキャンが走る体制が整った。

**配置されたセキュリティ構成：**
- **secretlint**: ファイル内のシークレットパターン検出
- **gitleaks**: git 履歴を含む包括的なシークレット検出
- **pre-commit フック**: コミット前に両ツールが自動実行
- **フェイルクローズ**: gitleaks 不在時もブロック（安全側に倒す設計）

## 学び

- `setup-local` 1コマンドでフック配線・ネガティブテスト・verify まで一括完了する設計が優秀
- 既存の `secretlint` バージョン（`^13.0.6`）が example（`^8.0.0`）より新しい場合は既存を維持する
- quickstart.md の「最終確認だけはAIに終わらせない」という設計思想（人間が自分でコマンド実行）が印象的

## 今後の予定

- `docs-structure` + `setup-securecheck` の2段階導入完了
- 通常の開発作業へ

## 関連ドキュメント

- [kit-my-basic-start](https://github.com/1ft-seabass/my-ai-collaboration-patterns/patterns/kit-my-basic-start)
- [setup-securecheck パターン](https://github.com/1ft-seabass/my-ai-collaboration-patterns/patterns/setup-pattern/setup-securecheck)
- [docs-structure 導入ノート](./2026-09-30-15-35-34-docs-structure-introduction.md)

---

**最終更新**: 2026-09-30
**作成者**: Bob (AI)
