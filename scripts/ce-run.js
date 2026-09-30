#!/usr/bin/env node
/**
 * .env.ce の環境変数を読み込んで ibmcloud コマンドを実行するヘルパー
 * Usage: node scripts/ce-run.js <subcommand> <args...>
 *   subcommand: "buildrun" | "update_app"
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// .env.ce を読み込む
const envFile = path.resolve(__dirname, '../.env.ce');
const envVars = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=');
    if (key && key.trim()) {
      envVars[key.trim()] = rest.join('=').trim();
    }
  });
}

const subcommand = process.argv[2];
let cmd;

if (subcommand === 'buildrun') {
  cmd = `ibmcloud ce buildrun submit --build ${envVars.CE_BUILD_NAME} --wait`;
} else if (subcommand === 'update_app') {
  cmd = `ibmcloud ce application update --name ${envVars.CE_APP_NAME} --image ${envVars.CE_BUILD_IMAGE} --wait`;
} else {
  console.error(`Unknown subcommand: ${subcommand}`);
  process.exit(1);
}

console.log(`Running: ${cmd}`);
execSync(cmd, { stdio: 'inherit' });
