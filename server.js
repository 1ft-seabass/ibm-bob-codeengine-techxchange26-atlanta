require('dotenv').config();

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');
const mqtt = require('mqtt');

// ─────────────────────────────────────────────
// MQTT クライアント
// ─────────────────────────────────────────────
const MQTT_HOST     = process.env.MQTT_HOST;
const MQTT_PORT     = process.env.MQTT_PORT;
const MQTT_PROTOCOL = process.env.MQTT_PROTOCOL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

let mqttClient = null;

if (MQTT_HOST && MQTT_PORT && MQTT_PROTOCOL) {
  const url = `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`;
  mqttClient = mqtt.connect(url, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
  });

  mqttClient.on('connect', () => {
    console.log('[mqtt] connected');
    mqttClient.publish('codeengine/connected', JSON.stringify({ type: 'connected' }), { qos: 0, retain: false });
  });

  mqttClient.on('reconnect', () => {
    console.log('[mqtt] reconnecting...');
  });

  mqttClient.on('offline', () => {
    console.log('[mqtt] offline');
  });

  mqttClient.on('error', (err) => {
    console.error('[mqtt] error:', err.message);
  });
} else {
  console.warn('[mqtt] MQTT_HOST / MQTT_PORT / MQTT_PROTOCOL が未設定です。MQTT クライアントを起動しません。');
}

// SIGTERM 受信時にクリーンシャットダウン（Code Engine がコンテナ停止時に送る）
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down...');
  if (mqttClient) mqttClient.end();
  process.exit(0);
});

// ─────────────────────────────────────────────
// publish ヘルパー（未接続チェック + タイムアウト）
// ─────────────────────────────────────────────
const PUBLISH_TIMEOUT_MS = 5000;

function publishAsync(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      return reject(new Error('mqtt not connected'));
    }

    const timer = setTimeout(() => {
      reject(new Error('mqtt publish timeout'));
    }, PUBLISH_TIMEOUT_MS);

    mqttClient.publish(topic, payload, { qos: 0, retain: false }, (err) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve();
    });
  });
}

// ─────────────────────────────────────────────
// Hono アプリ
// ─────────────────────────────────────────────
const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

app.post('/api/led/on', async (c) => {
  try {
    await publishAsync('codeengine/3d/click/on', JSON.stringify({ type: 'click', value: 'on' }));
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/api/led/off', async (c) => {
  try {
    await publishAsync('codeengine/3d/click/off', JSON.stringify({ type: 'click', value: 'off' }));
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// IBM Code Engine はコンテナに PORT 環境変数を自動設定するため、必ず process.env.PORT を優先すること
const port = process.env.PORT || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});
