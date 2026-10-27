---
tags: [code-engine, mqtt, deploy, verification, complete]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-09-30
**Related Task**: All three setup guides completed — `01-first-prompt.md` / `02-frontend.md` / `03-env.md`

## Problem

The full stack built across the three setup guides (deploy infrastructure, frontend, MQTT backend) needed to be verified as working end-to-end on production Code Engine.

## Attempts

### 404 Caused by Building Before Pushing

**Situation**: After implementing `03-env.md`, committed but ran `npm run build` before pushing. The build and deployment succeeded, but `/api/led/on` returned 404 on the production URL.

**Cause**: Code Engine builds by cloning GitHub. Because the build ran before pushing, GitHub still had the old `package.json` (without `mqtt`/`dotenv`), so `mqtt`/`dotenv` were not installed in the container, the server failed to start, and 404 was returned.

**Resolution**: Followed the correct order — commit → push → `npm run build` — and confirmed normal operation.

## Solution (Final Verification Results)

### API Verification on Production URL

```bash
curl -X POST https://YOUR_APP_URL/api/led/on
# → {"ok":true}

curl -X POST https://YOUR_APP_URL/api/led/off
# → {"ok":true}
```

### Frontend Verification

- Opening the production URL in a browser shows the Babylon.js 3D cube spinning
- Clicking the cube triggers `/api/led/on` / `/api/led/off`, and messages reach the MQTT broker
- Drawer open/close, rotation toggle, and reset angle all work correctly

### Summary of What Was Built

| File / Script | Role |
|---|---|
| `server.js` | Hono server (static serving + MQTT publish API) |
| `public/index.html` | Babylon.js + Vue 3 + Bootstrap 5 frontend |
| `Dockerfile` | Based on `icr.io/codeengine/node:22-alpine` |
| `scripts/ce-run.js` | Reads `.env.ce`, substitutes `$VAR`, runs ibmcloud commands |
| `.env.example` | Environment variable key names as a sample (Git-tracked) |
| `.env` | Local MQTT credentials (excluded from Git) |
| `.env.ce` | For deploy scripts (excluded from Git) |
| `.env.production` | Input for creating Code Engine Secret (excluded from Git; job done after Secret is created) |

### Day-to-Day Update Workflow (Established)

```bash
# After making code changes
git add ...
git commit -m "feat: ..."
git push origin main
npm run build        # buildrun → application update
```

### Code Engine Environment Variable Update Workflow (Established)

```bash
# When MQTT credentials need to change
# Edit .env.production, then:
npm run env:update   # overwrite mqtt-secret
npm run build        # redeploy the app
```

## Lessons Learned

- **Always push before building**: Code Engine builds from a GitHub clone, so local changes must be pushed first
- **`app-*` images accumulate on every build**: With ICR's 512 MB limit, old `app-*` tags need to be cleaned up periodically (see ICR Storage Investigation Note for details)

## Future Work

- Optimize MQTT broker connection settings
- Establish a regular ICR storage cleanup routine
- Implement additional frontend features (Vue 3 component refactoring, etc.)

## Related Documents

- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [ICR Storage Investigation Note](./2026-09-30-16-00-03-icr-storage-investigation.md)
- [Babylon.js Frontend Setup Note](./2026-09-30-16-12-22-babylonjs-vue3-frontend-setup.md)
- [MQTT Backend Implementation Note](./2026-09-30-21-00-58-mqtt-backend-and-env-injection.md)

---

**Last updated**: 2026-09-30
**Author**: AI
