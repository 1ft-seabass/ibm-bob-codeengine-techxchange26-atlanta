---
tags: [code-engine, deploy, ibmcloud, websocket, mqtt]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-10-23
**関連タスク**: MQTTトピック環境変数化・WebSocket・BabylonJS UI改修の本番反映

## 問題

- MQTT IoT トピック環境変数化・エンドポイントリネーム・WebSocket 時刻配信・BabylonJS UI改修を本番 Code Engine に反映する必要があった
- `env:update` → `build` の手順で進めたが、2つのエラーが発生した

## 試行錯誤

### エラー①: リソース・グループがターゲットになっていない

**発生コマンド**: `npm run env:update`

**エラーメッセージ**:
```
FAILED
ターゲットになっているリソース・グループがありません。
'ibmcloud target -g RESOURCE_GROUP_NAME' を実行してください。
```

**原因**: ibmcloud CLI のセッションでリソースグループが未設定だった。

**解決**:
```bash
ibmcloud resource groups          # 利用可能なグループを確認
ibmcloud target -g default        # default グループをターゲットに設定
```

---

### エラー②: 構成リフレッシュ・トークンが無効

**発生コマンド**: `npm run build:update_app`（`build:image_build` は成功済み）

**エラーメッセージ**:
```
FAILED
構成リフレッシュ・トークンが無効です。
'ibmcloud ce project select -n <project>' を実行し、やり直してください。
```

**原因**: Code Engine プロジェクトのトークンが期限切れだった。

**解決**:
```bash
ibmcloud ce project list                    # プロジェクト一覧を確認
ibmcloud ce project select -n ce-project-7c # プロジェクトを再選択してトークンを更新
npm run build:update_app                    # 続きから再実行
```

## 解決策

### 実行順序

```bash
# 1. リソースグループをターゲットに設定
ibmcloud target -g default

# 2. Secret に新しい環境変数を反映
npm run env:update

# 3. イメージビルド（GitHub clone → コンテナイメージ作成）
npm run build:image_build

# 4. プロジェクトトークンが切れていた場合は再選択
ibmcloud ce project select -n ce-project-7c

# 5. アプリ更新（新イメージをデプロイ）
npm run build:update_app

# 6. タグなしダイジェストのクリーンアップ
npm run build:cleanup
```

または `build:image_build` が成功していれば:
```bash
npm run build:update_app && npm run build:cleanup
```

## 学び

- **ibmcloud target -g** は認証後に別ターミナルを開いたり、しばらく時間が経つとリセットされることがある。`npm run env:*` や `npm run build:*` を実行する前に `ibmcloud target` で確認する習慣をつけるとよい。
- **プロジェクトトークン切れ** は `ibmcloud ce project select` で再選択するだけで解消できる。`build:image_build` が成功している場合は `build:update_app` から再開すれば二度ビルドしなくて済む。
- **途中失敗時の再開**: `npm run build` は `&&` で3ステップが直列なので、途中で失敗した場合は失敗したステップ以降を個別に実行すれば無駄なビルドを避けられる。

## 今後の改善案

- `npm run build` 前に `ibmcloud target` でリソースグループとプロジェクト選択状態を確認するプリフライトスクリプトを追加してもよい

## 関連ドキュメント

- [Code Engine 初期構築ノート](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [MQTTトピックリファクタリングノート](./2026-10-23-11-27-21-mqtt-iot-topics-refactor.md)
- [BabylonJS UI改修ノート](./2026-10-23-11-27-21-babylon-ui-improvements.md)

---

**最終更新**: 2026-10-23
**作成者**: AI
