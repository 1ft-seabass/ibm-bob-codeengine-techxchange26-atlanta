require('dotenv').config();

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');
const { WebSocketServer } = require('ws');
const mqtt = require('mqtt');

// ─────────────────────────────────────────────
// MQTT クライアント
// ─────────────────────────────────────────────
const MQTT_HOST              = process.env.MQTT_HOST;
const MQTT_PORT              = process.env.MQTT_PORT;
const MQTT_PROTOCOL          = process.env.MQTT_PROTOCOL;
const MQTT_USERNAME          = process.env.MQTT_USERNAME;
const MQTT_PASSWORD          = process.env.MQTT_PASSWORD;
const MQTT_IOT_CONTROL_LED   = process.env.MQTT_IOT_CONTROL_LED;
const MQTT_IOT_CONTROL_SERVO = process.env.MQTT_IOT_CONTROL_SERVO;

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

app.post('/api/device/on', async (c) => {
  try {
    await Promise.all([
      publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })),
      publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ direction: 'cw', speed: 3 })),
    ]);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/api/device/off', async (c) => {
  try {
    await Promise.all([
      publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 0, g: 0, b: 0 })),
      publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ command: 'stop' })),
    ]);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ─────────────────────────────────────────────
// HTTP サーバー + WebSocket サーバー
// ─────────────────────────────────────────────
// IBM Code Engine はコンテナに PORT 環境変数を自動設定するため、必ず process.env.PORT を優先すること
const port = process.env.PORT || 8080;

// serve() は http.Server 互換オブジェクトを返すので、
// そのまま WebSocketServer にアタッチする。
const httpServer = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});

const wss = new WebSocketServer({ server: httpServer });

// サーバー時刻を全クライアントへ 1 秒ごとに push
setInterval(() => {
  const payload = JSON.stringify({ type: 'clock', time: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(payload);
  });
}, 1000);

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  ws.on('close', () => console.log('[ws] client disconnected'));
});
