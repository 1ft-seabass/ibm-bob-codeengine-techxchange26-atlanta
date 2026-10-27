---
tags: [mqtt, code-engine, deploy, env, node]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-10-27
**Related Task**: Adding MQTT_IOT_CONTROL_LED2, improving startup env check, deploying to Code Engine

## Problem

Three things needed to be addressed:

1. A second LED device (AtomS3 MAC: `30EDA0CA4718`) was added and needs to be controlled simultaneously via `/api/device/on|off`
2. There was no mechanism to detect missing or sample-value environment variables at startup
3. Implement the above and deploy to production Code Engine

## Attempts

### Env Check: Garbled Japanese Messages

**Tried**: Implemented `console.warn` with Japanese text and emoji:
```js
console.warn(`[env] ⚠ ${key} が未設定です`);
console.log(`[env] ✓ ${key}`);
```

**Result**: Garbled output in Windows PowerShell (reported by user via screenshot)

**Resolution**: Changed messages to ASCII only:
```js
console.warn(`[env] WARN: ${key} is not set`);
console.log(`[env] OK: ${key}`);
```

---

### Env Check: Handling Optional Variables

**Problem**: `MQTT_IOT_CONTROL_LED2` is an optional variable for a future device. Showing a warning when it is not set is confusing.

**Tried**: Write it as a commented-out line in `.env.example` and have the parser recognize `# KEY=value` format as optional.

**Result**: Adopted

**How it works**:
- Commented out in `.env.example` → treated as optional (only shows `OK (optional, not set)` when not set)
- Active line in `.env.example` → treated as required (`WARN` if not set or still the sample value)

```js
const required = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
if (required) { requiredVars[required[1]] = required[2].trim(); return; }
const optional = line.match(/^#\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
if (optional) { optionalVars[optional[1]] = optional[2].trim(); }
```

## Solution

### Adding MQTT_IOT_CONTROL_LED2

**Implementation location**: `server.js`, `.env.example`

Read the env var without a fallback; check for its existence with `if (MQTT_IOT_CONTROL_LED2)` before adding to `Promise.all`:

```js
const MQTT_IOT_CONTROL_LED2 = process.env.MQTT_IOT_CONTROL_LED2;

// inside /api/device/on|off
const publishes = [
  publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })),
  publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ direction: 'cw', speed: 3 })),
];
if (MQTT_IOT_CONTROL_LED2) {
  publishes.push(publishAsync(MQTT_IOT_CONTROL_LED2, JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })));
}
await Promise.all(publishes);
```

`.env.example` entry (commented out = optional):
```
# LED2 (AtomS3, MAC 30EDA0CA4718) [optional]
# ON payload : {"type":"led","r":255,"g":255,"b":255}
# OFF payload: {"type":"led","r":0,"g":0,"b":0}
# MQTT_IOT_CONTROL_LED2=atoms3/30EDA0CA4718/control/led
```

### Startup Env Check Function

**Implementation location**: `server.js` top (IIFE)

Example startup log (all vars OK):
```
[env] OK: MQTT_HOST
[env] OK: MQTT_PORT
...
[env] OK (optional): MQTT_IOT_CONTROL_LED2
[env] all env vars are configured
```

### Deploy Steps

This deployment was Secret update → app restart only (code changes were already committed):

```powershell
# 1. Add MQTT_IOT_CONTROL_LED2 to .env.production

# 2. Update the Secret
npm run env:update

# 3. Restart the app (no image change — just to apply the new Secret)
npm run build:update_app
```

`build:image_build` (image build) was not needed. `build:update_app` alone swaps in a container with the new Secret.

## Lessons Learned

- **Express optional variables as commented-out lines**: The design of `.env.example` commented-out → parser treats as optional is simple and clear.
- **Updating the Secret alone does not restart the app**: Code Engine keeps the existing container running after `env:update`. The new Secret is only applied when `build:update_app` switches to a new revision.
- **No code change? `build:update_app` only**: `build:image_build` is unnecessary. For Secret or config-only changes, `env:update` + `build:update_app` is all that is needed.

## Future Improvements

- If LED devices increase, decide whether to increment numbering (`MQTT_IOT_CONTROL_LED3`) or use an array format (`MQTT_IOT_CONTROL_LEDS=topic1,topic2`)
- Consider adding a shortcut npm script like `npm run deploy:secret` for `build:update_app`-only deploys

## Related Documents

- [MQTT IoT Topics Refactor Note](./2026-10-23-11-27-21-mqtt-iot-topics-refactor.md)
- [Code Engine Deploy Troubleshoot Note](./2026-10-23-13-13-29-deploy-to-code-engine.md)
- [Clone Fresh Setup Note](./2026-10-27-06-02-43-clone-fresh-setup.md)

---

**Last updated**: 2026-10-27
**Author**: AI
