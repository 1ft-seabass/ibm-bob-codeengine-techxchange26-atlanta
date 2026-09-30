#!/usr/bin/env node
/**
 * .env.ce の環境変数を読み込んで ibmcloud コマンドを実行するヘルパー
 *
 * 使い方1: 固定サブコマンド
 *   node scripts/ce-run.js buildrun
 *   node scripts/ce-run.js update_app
 *
 * 使い方2: 任意の ibmcloud コマンド（$VAR を .env.ce の値で置換して実行）
 *   node scripts/ce-run.js ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production
 *   node scripts/ce-run.js ibmcloud ce application update --name $CE_APP_NAME --env-from-secret mqtt-secret
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// .env.ce を読み込む
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

// $VAR 形式のプレースホルダーを envVars で置換する
function substituteVars(str) {
  return str.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name) => {
    if (!(name in envVars)) {
      console.error(`[ce-run] 警告: 変数 $${name} が .env.ce に見つかりません`);
      return '';
    }
    return envVars[name];
  });
}

const subcommand = process.argv[2];
let cmd;

if (subcommand === 'buildrun') {
  cmd = `ibmcloud ce buildrun submit --build ${envVars.CE_BUILD_NAME} --wait`;
} else if (subcommand === 'update_app') {
  cmd = `ibmcloud ce application update --name ${envVars.CE_APP_NAME} --image ${envVars.CE_BUILD_IMAGE} --wait`;
} else if (subcommand === 'ibmcloud') {
  // 任意の ibmcloud コマンドを $VAR 置換して実行
  const rawArgs = process.argv.slice(2).join(' ');
  cmd = substituteVars(rawArgs);
} else {
  console.error(`[ce-run] 不明なサブコマンド: ${subcommand}`);
  console.error('使い方: node scripts/ce-run.js buildrun|update_app|ibmcloud <args...>');
  process.exit(1);
}

console.log(`Running: ${cmd}`);
execSync(cmd, { stdio: 'inherit' });
