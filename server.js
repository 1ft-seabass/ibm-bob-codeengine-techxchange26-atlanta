const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');

const app = new Hono();

app.use('/*', serveStatic({ root: './public' }));

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

// IBM Code Engine はコンテナに PORT 環境変数を自動設定するため、必ず process.env.PORT を優先すること
const port = process.env.PORT || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});
