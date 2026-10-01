#!/usr/bin/env node
/**
 * ICR の build-hono-app-build リポジトリから
 * タグなし（untagged）のダイジェストを削除するクリーンアップスクリプト。
 *
 * - latest タグが付いているダイジェストは削除しない
 * - npm run build の後に自動実行される
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// .env.ce から ICR namespace と build 名を取得
const envFile = path.resolve(__dirname, '../.env.ce');
const envVars = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key) envVars[key] = val;
  });
}

// CE_BUILD_IMAGE から ICR region と namespace を取得
// 例: private.jp.icr.io/<namespace>/build-hono-app-build:latest
const buildImage = envVars.CE_BUILD_IMAGE || '';
const match = buildImage.match(/private\.([\w-]+\.icr\.io)\/([\w-]+)\/([\w-]+):latest/);
if (!match) {
  console.error('[cleanup] CE_BUILD_IMAGE のパースに失敗しました:', buildImage);
  process.exit(1);
}
const icrRegion   = match[1];               // jp.icr.io
const namespace   = match[2];               // ICR namespace
const repository  = match[3];               // build-hono-app-build
const publicRepo  = `jp.${icrRegion.replace(/^jp\./, '')}`;  // jp.icr.io
const fullRepo    = `${publicRepo}/${namespace}/${repository}`;

console.log(`[cleanup] リポジトリ: ${fullRepo}`);

// タグなしダイジェストを一覧取得
let digests;
try {
  const output = execSync(
    `ibmcloud cr image-digests --restrict ${namespace} --output json`,
    { encoding: 'utf8' }
  );
  const all = JSON.parse(output);
  // タグなし（tags が空配列）かつ対象リポジトリのものだけ抽出
  digests = all.filter((d) => {
    return d.repoDigest && d.repoDigest.startsWith(fullRepo + '@') && (!d.tags || d.tags.length === 0);
  });
} catch (err) {
  console.error('[cleanup] ダイジェスト一覧の取得に失敗しました:', err.message);
  process.exit(1);
}

if (digests.length === 0) {
  console.log('[cleanup] 削除対象のタグなしダイジェストはありません。');
  process.exit(0);
}

console.log(`[cleanup] ${digests.length} 件のタグなしダイジェストを削除します...`);
let failed = 0;
for (const d of digests) {
  const ref = d.repoDigest;
  try {
    execSync(`ibmcloud cr image-rm "${ref}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`[cleanup] 削除失敗: ${ref}`);
    failed++;
  }
}

if (failed > 0) {
  console.warn(`[cleanup] ${failed} 件の削除に失敗しました。`);
} else {
  console.log('[cleanup] クリーンアップ完了。');
}
