---
tags: [code-engine, hono, docker, ibmcloud, deploy]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-09-30
**Related Task**: Initial setup of the Code Engine deploy infrastructure

## Problem

There was no deploy infrastructure to run this repository on IBM Cloud Code Engine.
A workflow was needed to complete redeployment in just two steps: `git push` → `npm run build`.

## Attempts

### `dotenv-cli` + `$VAR` syntax (Failed)

**Tried**: Following the setup guide, using `dotenv-cli` and writing environment variables in `package.json` scripts as `$CE_BUILD_NAME`.

**Result**: Failed

**Reason**: npm on Windows runs scripts via `cmd.exe`, so `$CE_BUILD_NAME` was passed to `ibmcloud` as a literal string instead of being expanded. Switching to `%CE_BUILD_NAME%` also failed because `dotenv-cli` sets environment variables after the child process starts, so the shell's argument expansion happens first.

---

### `scripts/ce-run.js` helper (Succeeded)

**Tried**: A Node.js script that reads `.env.ce` directly and builds the `ibmcloud` command using `child_process.execSync`.

**Result**: Succeeded

**Code example**:
```js
// scripts/ce-run.js (excerpt)
const envVars = {}; // parsed from .env.ce
if (subcommand === 'buildrun') {
  cmd = `ibmcloud ce buildrun submit --build ${envVars.CE_BUILD_NAME} --wait`;
} else if (subcommand === 'update_app') {
  cmd = `ibmcloud ce application update --name ${envVars.CE_APP_NAME} --image ${envVars.CE_BUILD_IMAGE} --wait`;
}
execSync(cmd, { stdio: 'inherit' });
```

## Solution

### File Overview

| File | Role |
|---|---|
| `server.js` | Hono server (static serving + `/api/hello`) |
| `public/index.html` | Static page for verification |
| `Dockerfile` | Based on `icr.io/codeengine/node:22-alpine` |
| `scripts/ce-run.js` | Helper that reads `.env.ce` and runs `ibmcloud` commands |
| `.env.ce` | CE_BUILD_NAME / CE_APP_NAME / CE_BUILD_IMAGE (excluded from Git) |

### `.env.ce` Format (with Placeholders)

```
CE_BUILD_NAME=YOUR_BUILD_NAME
CE_APP_NAME=YOUR_APP_NAME
CE_BUILD_IMAGE=private.YOUR_REGION.icr.io/YOUR_ICR_NAMESPACE/build-YOUR_BUILD_NAME:latest
```

### Deploy Commands (First Time)

```bash
ibmcloud target -g default
ibmcloud ce project select --name YOUR_PROJECT_NAME
ibmcloud ce application create \
  --name YOUR_APP_NAME \
  --build-source https://github.com/YOUR_ORG/YOUR_REPO \
  --build-strategy dockerfile \
  --build-size medium \
  --port 8080 \
  --wait
```

### Day-to-Day Update Workflow

```bash
git push origin main
npm run build
```

What `npm run build` does:
1. `build:image_build` → `ibmcloud ce buildrun submit --build YOUR_BUILD_NAME --wait`
2. `build:update_app` → `ibmcloud ce application update --name YOUR_APP_NAME --image YOUR_BUILD_IMAGE --wait`

### `application create` vs `build create`

- `application create --build-source` does **not** create a build object (it runs buildrun directly)
- To use `buildrun submit` for day-to-day updates, a separate `ibmcloud ce build create` must be run on first setup
- After creating the build, run `ibmcloud ce build get --name YOUR_BUILD_NAME` to find the image output destination and set it in `.env.ce`

### Dockerfile Notes

```dockerfile
FROM icr.io/codeengine/node:22-alpine
COPY package.json .
RUN npm install --omit=dev   # exclude devDependencies to slim the image
RUN mkdir public
COPY public/ public/
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
```

- Code Engine automatically sets the `PORT` environment variable in the container, so `server.js` uses `process.env.PORT || 8080`

## Lessons Learned

- **`dotenv-cli` pitfall on Windows**: Due to the timing difference between shell argument expansion and environment variable injection, `dotenv -e .env -- cmd $VAR` does not work on Windows. Parsing `.env` directly in a Node.js script is more reliable.
- **`application create` does not create a build object**: To use `buildrun submit` in the day-to-day workflow, `ibmcloud ce build create` must be run separately on first setup.
- **Deleting `app-*` images is dangerous**: Deleting a timestamped image that a running app references causes the app to return 404. Keeping only `build-*:latest` is sufficient for future builds.

## Future Improvements

- Since ICR storage is getting tight, consider adding a script to automatically delete old `app-*` tagged images after `npm run build`

## Related Documents

- [ICR Storage Investigation Note](./2026-09-30-16-00-03-icr-storage-investigation.md)
- Setup guide: `tmp/01-first-prompt.md`

---

**Last updated**: 2026-09-30
**Author**: AI
