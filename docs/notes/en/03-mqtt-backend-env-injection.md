# MQTT Backend + Code Engine Environment Variable Injection — Setup Guide

This file is a standalone setup guide for adding MQTT publish functionality (LED ON/OFF control API) to a Hono server, and injecting the connection settings (MQTT broker info and credentials) into both local development and IBM Code Engine production environments.
It is written to be self-contained — no other documents need to be referenced.

The frontend (Babylon.js + Vue 3 UI) is covered in `02-frontend.md`.
This file covers only the backend (`server.js`), environment variables, and deployment operations.
It assumes `01` (`first-prompt.md` = Code Engine deploy infrastructure) has already been completed.

## API Endpoints to Add

| Endpoint | Topic | Payload |
|---|---|---|
| `POST /api/led/on` | `codeengine/3d/click/on` | `{"type":"click","value":"on"}` |
| `POST /api/led/off` | `codeengine/3d/click/off` | `{"type":"click","value":"off"}` |

- No request body is required (the method and path alone carry the full meaning).
- On successful publish, return `{ ok: true }` with HTTP 200. On failure, return `{ ok: false, error: "..." }` with **HTTP 500**.
  - The `02-frontend.md` implementation judges success/failure by `res.ok` (whether the HTTP status is 2xx), so returning `ok: false` with a 200 status would be incorrectly treated as success. Express failure through both the status code and the response body.

## Dependencies

```bash
npm install mqtt dotenv
```

## MQTT Client Design (`server.js`)

- Start the connection when the server starts. However, only attempt to connect if `MQTT_HOST`, `MQTT_PORT`, and `MQTT_PROTOCOL` are all set; if any are missing, log a warning and skip starting the MQTT client (the server itself should start normally).
- Build the connection URL as `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`. Setting `MQTT_PROTOCOL` to `mqtts` (raw MQTT over TLS, typically port 8883) or `wss` (MQTT over WebSocket over TLS, typically port 8884) covers different broker types.
- Pass credentials (`MQTT_USERNAME` / `MQTT_PASSWORD`) to `mqtt.connect(url, { username, password })`.
- Always register `client.on('error', ...)`. **Without it, an unhandled exception will crash the entire Node.js process.** Keep the handler to logging only.
- Also log `client.on('connect', ...)`, `client.on('reconnect', ...)`, and `client.on('offline', ...)` for easier operational monitoring.
- On the `connect` event, publish `{"type":"connected"}` to the `codeengine/connected` topic (QoS 0, no retain) as a connectivity check. Subscribing to this topic on the broker side lets you confirm externally that the server has started and the MQTT connection succeeded.
- On `SIGTERM`, call `client.end()` for a clean shutdown (Code Engine sends this when stopping a container).

### Wrapping publish (Handling Disconnects and Timeouts)

- If `client.connected === false`, do not attempt to publish — immediately return an error (`mqtt not connected`). This prevents API calls from hanging indefinitely when the broker is not connected.
- Set a ~5-second timeout on the `client.publish()` callback; if there is no response within that time, return a timeout error.
- Default to QoS 0 and no retain (for demo purposes; use these defaults unless there are specific requirements).

## Environment Variable File Roles (Critical)

This repository uses multiple environment variable files — they serve different purposes, so don't mix them up.

| File | Role | Read by the running app? |
|---|---|---|
| `.env.ce` | Exclusively for deploy scripts (`npm run build:*` / `ibmcloud ce ...`) | No |
| `.env` (local, new) | Read by `dotenv` when running `node server.js` locally | Local only |
| `.env.production` (production, new) | Input file for creating the Code Engine Secret. Once the Secret is created, its job is done | No (becomes Code Engine env vars via the Secret) |

All of these should be excluded from Git (added to `.gitignore`). Keep a `.env.example` under Git with only key names and descriptions as a sample.

### `.env.example` (Local Sample)

```
# MQTT broker hostname (e.g. xxxxx.s1.eu.hivemq.cloud)
MQTT_HOST=xxxxx.s1.eu.hivemq.cloud

# MQTT broker port (typically 8883 for mqtts, 8884 for wss)
MQTT_PORT=8883

# Connection protocol: mqtts (raw MQTT over TLS) or wss (MQTT over WebSocket over TLS)
MQTT_PROTOCOL=mqtts

# MQTT credentials
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password
```

Call `require('dotenv').config()` at the top of `server.js` to load `.env` at startup.
If `.env` does not exist (e.g. in the production container), `dotenv` silently ignores it — no changes needed.

## Local Verification

- Copy `.env.example` to `.env` and fill in your actual MQTT broker info. For testing, you can run `mosquitto` locally via Docker, or create a free HiveMQ Cloud instance as a test broker.
- Start the server with `npm start`, and subscribe to `codeengine/3d/click/on` and `codeengine/3d/click/off` using `mosquitto_sub` or MQTT Explorer.
- Click the cube in the browser and confirm that messages arrive on the subscriber side.
- Confirm that starting the server without the MQTT environment variables set still starts normally, and that calling `/api/led/on|off` returns `{ ok: false, error: 'mqtt not connected' }` (i.e. no crash).
- **Start and restart the server process from a human-operated terminal.** If the AI agent starts the process in the background via `execute_command` and then `.env` is changed, the old process will not pick up the changes, making "MQTT not connected" errors confusing to debug.

## Code Engine (Production) Environment Variable Injection

Containers on Code Engine do not read the repository's `.env` or `.env.ce` files at all.
Environment variables must be set on the application itself as Secrets.

### 1. Prepare the Production File

```bash
cp .env.example .env.production
# Edit .env.production with your production broker info (.gitignore target)
```

Do not reuse the local verification broker info in the production Secret. Keep them in separate files.

### 2. Create the Secret and Attach It to the App (First Time Only)

```bash
ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production
ibmcloud ce application update --name <APP_NAME> --env-from-secret mqtt-secret
```

The `--from-env-file` flag converts a `.env`-format file directly into a Secret.

### 3. Updating the Secret (Second Time and Beyond)

```bash
ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production
```

Note: updating the Secret alone does not immediately apply the change to the app.
When the app references the Secret as environment variables, Code Engine may require a new revision to start.
Verify with `ibmcloud ce application get --name <APP_NAME>`.

### 4. Adding Shortcuts to `package.json` (Recommended)

Reusing the same region/project selection as the `dotenv-cli`-based deploy scripts (`build:target_region` etc.) introduced in `01` (`first-prompt.md`), add these scripts for easier operation:

```json
{
  "scripts": {
    "build:env_create": "node scripts/ce-run.js ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production",
    "build:env_update": "node scripts/ce-run.js ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production",
    "build:env_attach": "node scripts/ce-run.js ibmcloud ce application update --name $CE_APP_NAME --env-from-secret mqtt-secret",
    "env:create": "npm run build:target_region && npm run build:target_group && npm run build:select_project && npm run build:env_create",
    "env:update": "npm run build:target_region && npm run build:target_group && npm run build:select_project && npm run build:env_update",
    "env:attach": "npm run build:target_region && npm run build:target_group && npm run build:select_project && npm run build:env_attach"
  }
}
```

Operational flow (first time):

```bash
npm run env:create   # Create mqtt-secret from .env.production
npm run env:attach   # Attach mqtt-secret to the app
```

Second time and beyond (when values change):

```bash
npm run env:update
```

> When running commands containing `$VAR` via `npm run` on Windows PowerShell, `$VAR` is interpreted as a shell variable and not expanded as expected. A helper script (`scripts/ce-run.js`) that reads the env file with the `dotenv` package and substitutes `$VAR` arguments on the Node.js side before calling `spawnSync` makes the same `npm run` commands work on both bash and PowerShell.
> Also note that `dotenv-cli` changed its syntax in v11 (`-e` → `dotenv run -f`), so behavior can vary by version. To avoid this, unifying on a custom `ce-run.js` instead of using `dotenv-cli` directly is a valid approach.

## Verification Checklist

- [ ] Added the `mqtt` and `dotenv` packages
- [ ] `/api/led/on` and `/api/led/off` publish to MQTT with the correct topic and payload
- [ ] On publish failure, HTTP 500 is returned with `{ ok: false, error: "..." }` (not 200 with `ok: false`)
- [ ] `client.on('error', ...)` is registered; an MQTT connection error does not crash the process
- [ ] On MQTT connection, `{"type":"connected"}` is published to `codeengine/connected`
- [ ] Calling the API while MQTT is disconnected returns an immediate error response (no hang)
- [ ] The server starts normally even without MQTT environment variables set
- [ ] `client.end()` is called on `SIGTERM`
- [ ] `.env.example` is under Git (no actual values)
- [ ] `.env` and `.env.production` are in `.gitignore`
- [ ] `mqtt-secret` has been created and attached to the Code Engine app
- [ ] Local and production environment variable setup steps are documented in README etc.

## Completion Criteria

- With `.env` configured locally, running `npm start` and clicking the cube results in a successful MQTT publish.
- Without `.env` set, the server still starts and the API returns an error response (no crash).
- With `mqtt-secret` attached to the Code Engine production app, clicking the cube at the production URL also results in a successful MQTT publish.
