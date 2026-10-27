---
tags: [ibmcloud, code-engine, gitleaks, setup, windows]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-27
**関連タスク**: clone したて環境での ibmcloud CLI・gitleaks セットアップ

## 問題

新しいマシン（または再セットアップ環境）で clone 直後に作業しようとしたところ、以下の3つの環境が未整備だった：

1. `ibmcloud` コマンドが PowerShell のパスに通っていない
2. `code-engine` プラグインが未インストール
3. `gitleaks` が未インストール（pre-commit フックがブロック）

## 試行錯誤

### ① ibmcloud のパス問題

**発生エラー**:
```
ibmcloud : コマンド 'ibmcloud' は...認識されません
```

**原因**: ibmcloud CLI は `C:\Program Files\IBM\Cloud\bin\ibmcloud.exe` にインストール済みだったが、PowerShell の PATH に含まれていなかった。再起動後にパスが通る想定だったが、Bob のツール実行環境（内部 PowerShell セッション）では反映されていなかった。

**解決**: フルパス `& "C:\Program Files\IBM\Cloud\bin\ibmcloud.exe"` で実行。
ユーザーが再起動後に PATH が通っていることを確認してから `ibmcloud` コマンドで実行可能になった。

---

### ② code-engine プラグイン未インストール

**発生エラー**:
```
失敗
'ce' は登録済みコマンドではありません。
```

**原因**: ibmcloud CLI 本体はインストール済みだが、`code-engine` プラグインが別途インストールが必要。

**試したこと（失敗）**: Bob ツール経由で `ibmcloud plugin install code-engine` を実行。
80MB のダウンロードが発生し、270秒のタイムアウト上限を超えてキャンセルされた（3回試行）。

**解決**: ユーザーがターミナルで直接実行:
```powershell
ibmcloud plugin install code-engine -f
```

**教訓**: 大容量ダウンロードを伴うコマンドは Bob ツール経由では実行できない。最初からユーザーへ委譲すべき。

---

### ③ gitleaks 未インストール（pre-commit ブロック）

**発生エラー**: git commit 時に pre-commit フックが以下を出力してブロック:
```
❌ gitleaks が見つかりません — フェイルクローズ方針によりコミットをブロックします
```

**原因**: このリポジトリは setup-securecheck パターンを採用しており、gitleaks が未インストールの場合はコミットをブロックする「フェイルクローズ」設計になっている。

**解決**: 以下のコマンドで gitleaks を自動インストール:
```powershell
node .security-check/cli.js install-gitleaks
```

出力:
```
✅ gitleaks installed: 8.30.0
```

インストール後は pre-commit チェックが正常に通過:
```
=== gitleaks ===
  ✅ gitleaks 自動自己検証 — カナリアを正しく検出
✅ All checks passed
```

## 解決策（clone 後の初回セットアップ手順）

```powershell
# 1. npm install（gitleaks 以外の依存関係）
npm install

# 2. gitleaks インストール
node .security-check/cli.js install-gitleaks

# 3. ibmcloud CLI のパス確認
ibmcloud target
# → 失敗する場合はフルパスで確認
& "C:\Program Files\IBM\Cloud\bin\ibmcloud.exe" target

# 4. code-engine プラグイン確認・インストール
ibmcloud plugin list
# → code-engine がなければ（ターミナルで直接実行）
ibmcloud plugin install code-engine -f

# 5. ibmcloud セッション設定
ibmcloud login --sso
ibmcloud target -g default
ibmcloud ce project select -n ce-project-7c
```

## 学び

- **gitleaks は `node .security-check/cli.js install-gitleaks` で一発インストール可能**: README に記載しておくとよい。
- **code-engine プラグインは 80MB**: ダウンロードが遅い環境では時間がかかる。ターミナルで直接実行するほうが確実。
- **ibmcloud PATH は再起動後に有効になるが Bob ツール環境には反映されない**: Bob 経由で ibmcloud を実行する場合はフルパス指定が確実。

## 今後の改善案

- README.md に clone 後のセットアップ手順を追記する
- `npm run setup` のようなスクリプトで gitleaks インストールまで自動化する

## 関連ドキュメント

- [Code Engine初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [setup-securecheck導入ノート](./2026-09-30-15-40-58-setup-securecheck-introduction.md)
- [Bob Coinコスト分析ノート](./2026-10-27-06-02-43-bob-coin-cost-analysis.md)

---

**最終更新**: 2026-10-27
**作成者**: AI
