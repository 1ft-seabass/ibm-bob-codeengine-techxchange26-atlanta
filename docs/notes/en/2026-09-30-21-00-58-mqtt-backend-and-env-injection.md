---
tags: [mqtt, hono, code-engine, dotenv, backend]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-09-30
**Related Task**: `tmp/03-env.md` — MQTT backend implementation + Code Engine environment variable injection

## Problem

- The `/api/led/on` / `/api/led/off` endpoints from `02-frontend.md` were not yet implemented
- A mechanism was needed to safely inject MQTT broker credentials into both local development and Code Engine production
- `scripts/ce-run.js` only handled fixed commands and could not be used for `ibmcloud ce secret` commands

## Attempts

### Build before push causes mqtt to not be installed

**Tried**: Running `npm run build` locally after modifying `server.js` and `package.json`. The build succeeded and the deployment completed, but calling `/api/led/on` on the production URL returned `404`.

**Cause**: Code Engine builds by cloning the GitHub repository. Because the build was triggered before committing and pushing the local changes, GitHub still had the old `package.json` (without `mqtt`/`dotenv`). As a result, `npm install --omit=dev` did not install `mqtt`/`dotenv`, and `require('mqtt')` in `server.js` failed at startup, causing the server to not start and returning 404.

**Lesson**: Always follow the order: **commit → push → build**.

---

### `$VAR` expansion in `scripts/ce-run.js`

**Background**: The `env:attach` script needed `--name $CE_APP_NAME` style variable references. On Windows PowerShell/cmd, the shell does not expand `$VAR`, so `ce-run.js` needed to handle the substitution.

**Solution**: Added a `substituteVars()` function to `ce-run.js` that replaces `$VAR` references with values from `.env.ce` on the Node.js side before passing the command to `execSync`.

## Solution

### MQTT Implementation in `server.js`

```js
// Only connect if MQTT_HOST / MQTT_PORT / MQTT_PROTOCOL are all set
if (MQTT_HOST && MQTT_PORT && MQTT_PROTOCOL) {
  const url = `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`;
  mqttClient = mqtt.connect(url, { username: MQTT_USERNAME, password: MQTT_PASSWORD });
  // register connect / reconnect / offline / error event handlers
} else {
  console.warn('[mqtt] not configured. MQTT client will not start.');
}
```

**Key points**:
- Always register `client.on('error', ...)`. Without it, a connection error causes an unhandled exception that crashes the process
- Call `client.end()` on `SIGTERM` for a clean shutdown (Code Engine sends this when stopping a container)
- On connection, publish `{"type":"connected"}` to `codeengine/connected` for external startup verification

### publish Helper (Disconnect Check + Timeout)

```js
function publishAsync(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      return reject(new Error('mqtt not connected')); // fail immediately, no hang
    }
    const timer = setTimeout(() => reject(new Error('mqtt publish timeout')), 5000);
    mqttClient.publish(topic, payload, { qos: 0, retain: false }, (err) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve();
    });
  });
}
```

### API Endpoints

| Endpoint | Topic | Payload |
|---|---|---|
| `POST /api/led/on` | `codeengine/3d/click/on` | `{"type":"click","value":"on"}` |
| `POST /api/led/off` | `codeengine/3d/click/off` | `{"type":"click","value":"off"}` |

- Success: `{ ok: true }` HTTP 200
- Failure: `{ ok: false, error: "..." }` **HTTP 500** (must return 500 since the frontend judges by `res.ok`)

### Environment Variable File Roles

| File | Role | Git-tracked? |
|---|---|---|
| `.env` | Read by `dotenv` when running locally | No |
| `.env.production` | Input file for creating the Secret | No |
| `.env.ce` | Exclusively for deploy scripts (`npm run build:*`) | No |
| `.env.example` | Key names as a sample (no actual values) | **Yes** |

### Code Engine Environment Variable Injection Flow (First Time)

```bash
cp .env.example .env.production
# Fill .env.production with production broker info

npm run env:create   # ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production
npm run env:attach   # ibmcloud ce application update --name <APP_NAME> --env-from-secret mqtt-secret
```

Second time and beyond (when values change):

```bash
npm run env:update   # ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production
```

### Generalizing `scripts/ce-run.js`

Extended to run any `ibmcloud` command with `$VAR` substitution from `.env.ce`:

```js
// Usage: node scripts/ce-run.js ibmcloud ce application update --name $CE_APP_NAME ...
} else if (subcommand === 'ibmcloud') {
  const rawArgs = process.argv.slice(2).join(' ');
  cmd = substituteVars(rawArgs); // replace $CE_APP_NAME with actual value
}
```

## Lessons Learned

- **Never build before pushing**: Code Engine builds from a GitHub clone, so local changes must be pushed before building. This is especially important when `server.js` and `package.json` change together.
- **`client.on('error')` is required**: Node.js EventEmitter throws an unhandled exception if no listener is registered for the `error` event, crashing the process. MQTT clients are no exception.
- **Always return HTTP 500 on failure**: When the frontend judges success/failure by `res.ok` (2xx check), returning `{ ok: false }` with HTTP 200 is incorrectly treated as success.

## Future Improvements

- Consider adding a pre-build check script to ensure there are no unpushed commits before running `npm run build`
- Consider automatically falling back to `env:update` when `env:create` fails because the secret already exists

## Related Documents

- Setup guide: `tmp/03-env.md`
- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [Babylon.js Frontend Setup Note](./2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md)

---

**Last updated**: 2026-09-30
**Author**: AI
