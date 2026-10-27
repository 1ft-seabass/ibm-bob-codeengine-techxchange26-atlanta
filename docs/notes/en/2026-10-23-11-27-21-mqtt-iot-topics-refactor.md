---
tags: [mqtt, hono, environment-variables, api, refactor]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-10-23
**Related Task**: Externalizing MQTT IoT topics to environment variables and renaming endpoints

## Problem

- Analysis of the Node-RED flow confirmed the publish topics for end devices
- The previous `/api/led/on` / `/api/led/off` endpoints only controlled the LED, but the spec changed to simultaneously control the Servo as well
- Hardcoding topics (which include device MAC addresses) in code makes it difficult to update when devices are replaced

## Attempts

### Hardcoding Fallback Values in Code

**Tried**: Added fallbacks like `|| 'atoms3/xxxx/control/led'` in case environment variables were not set.

**Result**: Not adopted

**Reason**: Fallbacks allow the app to "just work" even when env vars are misconfigured, making it easy to miss setup mistakes. It is more explicit to have no fallback and instead document carefully in `.env.example`.

## Solution

### Adding Environment Variables

**Implementation location**: `.env.example`, `.env`, `.env.production`, `server.js`

Documented ON/OFF payloads as comments in `.env.example` as a reference for device replacement:

```
# LED (AtomS3, MAC XXXXXXXXXXXX)
# ON payload : {"type":"led","r":255,"g":255,"b":255}
# OFF payload: {"type":"led","r":0,"g":0,"b":0}
MQTT_IOT_CONTROL_LED=atoms3/XXXXXXXXXXXX/control/led

# Servo (AtomS3, MAC XXXXXXXXXXXX)
# ON payload : {"direction":"cw","speed":3}
# OFF payload: {"command":"stop"}
MQTT_IOT_CONTROL_SERVO=atoms3/XXXXXXXXXXXX/control/servo
```

### Changes to `server.js`

**Implementation location**: `server.js`

Read env vars without fallbacks:

```js
const MQTT_IOT_CONTROL_LED   = process.env.MQTT_IOT_CONTROL_LED;
const MQTT_IOT_CONTROL_SERVO = process.env.MQTT_IOT_CONTROL_SERVO;
```

### Endpoint Rename and Parallel Publish

Renamed `/api/led/*` → `/api/device/*` to control both LED and Servo.
Used `Promise.all` to publish to LED and Servo in parallel:

```js
app.post('/api/device/on', async (c) => {
  await Promise.all([
    publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 255, g: 255, b: 255 })),
    publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ direction: 'cw', speed: 3 })),
  ]);
  return c.json({ ok: true });
});

app.post('/api/device/off', async (c) => {
  await Promise.all([
    publishAsync(MQTT_IOT_CONTROL_LED,   JSON.stringify({ type: 'led', r: 0, g: 0, b: 0 })),
    publishAsync(MQTT_IOT_CONTROL_SERVO, JSON.stringify({ command: 'stop' })),
  ]);
  return c.json({ ok: true });
});
```

### Frontend Update

**Implementation location**: `public/index.html`

Updated the fetch target to the new endpoint:
```js
const endpoint = nextOn ? '/api/device/on' : '/api/device/off';
```

### End-Device Publish Spec (from Node-RED Flow Analysis)

| Target | Topic | ON Payload | OFF Payload |
|---|---|---|---|
| LED (AtomS3) | `atoms3/XXXX/control/led` | `{"type":"led","r":255,"g":255,"b":255}` | `{"type":"led","r":0,"g":0,"b":0}` |
| Servo (AtomS3) | `atoms3/XXXX/control/servo` | `{"direction":"cw","speed":3}` | `{"command":"stop"}` |

## Lessons Learned

- **No fallback is more explicit**: Missing env var configuration is caught at runtime early. Fallbacks make the app "work anyway" and become a source of production incidents.
- **Document payloads in `.env.example`**: Recording not just topics but also ON/OFF payload specs as comments reduces investigation cost when devices are replaced or specs change.
- **Parallel publish with `Promise.all`**: Sequential publish delays the whole operation if one side is slow. Independent publishes should run in parallel.

## Future Improvements

- Consider adding a startup warning when `MQTT_IOT_CONTROL_LED` / `MQTT_IOT_CONTROL_SERVO` are not set
- If the number of devices grows, consider managing topics as an array or JSON structure

## Related Documents

- [MQTT Backend Implementation Note](./2026-09-30-21-00-58-mqtt-backend-and-env-injection.md)
- [End-to-End Verification Note](./2026-09-30-21-11-40-e2e-verification-complete.md)

---

**Last updated**: 2026-10-23
**Author**: AI
