---
tags: [code-engine, deploy, ibmcloud, websocket, mqtt]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-10-23
**Related Task**: Deploying MQTT topic externalization, WebSocket, and Babylon.js UI improvements to production

## Problem

- The MQTT IoT topic externalization, endpoint rename, WebSocket clock broadcast, and Babylon.js UI improvements needed to be deployed to production Code Engine
- The `env:update` → `build` workflow was followed, but two errors occurred

## Attempts

### Error ①: No Resource Group Targeted

**Command**: `npm run env:update`

**Error message**:
```
FAILED
No resource group is targeted.
Use 'ibmcloud target -g RESOURCE_GROUP_NAME'.
```

**Cause**: The resource group was not set in the ibmcloud CLI session.

**Resolution**:
```bash
ibmcloud resource groups          # list available groups
ibmcloud target -g default        # target the default group
```

---

### Error ②: Configuration Refresh Token Invalid

**Command**: `npm run build:update_app` (`build:image_build` had already succeeded)

**Error message**:
```
FAILED
The configuration refresh token is invalid.
Run 'ibmcloud ce project select -n <project>' and try again.
```

**Cause**: The Code Engine project token had expired.

**Resolution**:
```bash
ibmcloud ce project list                    # list projects
ibmcloud ce project select -n ce-project-7c # re-select project to refresh token
npm run build:update_app                    # resume from this step
```

## Solution

### Execution Order

```bash
# 1. Target the resource group
ibmcloud target -g default

# 2. Apply new environment variables to the Secret
npm run env:update

# 3. Image build (clone from GitHub → build container image)
npm run build:image_build

# 4. If the project token expired, re-select
ibmcloud ce project select -n ce-project-7c

# 5. Update the app (deploy new image)
npm run build:update_app

# 6. Clean up untagged digests
npm run build:cleanup
```

Or, if `build:image_build` already succeeded:
```bash
npm run build:update_app && npm run build:cleanup
```

## Lessons Learned

- **`ibmcloud target -g` can reset** when opening a new terminal after authentication or after some time has passed. Make it a habit to run `ibmcloud target` before `npm run env:*` or `npm run build:*`.
- **Expired project token** is resolved simply by re-running `ibmcloud ce project select`. If `build:image_build` has already succeeded, resuming from `build:update_app` avoids a redundant build.
- **Resuming after partial failure**: `npm run build` chains three steps with `&&`, so if one fails, run only the remaining steps individually to avoid unnecessary rebuilds.

## Future Improvements

- Consider adding a preflight script that checks `ibmcloud target` for resource group and project selection state before `npm run build`

## Related Documents

- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [MQTT IoT Topics Refactor Note](./2026-10-23-11-27-21-mqtt-iot-topics-refactor.md)
- [Babylon.js UI Improvements Note](./2026-10-23-11-27-21-babylon-ui-improvements.md)

---

**Last updated**: 2026-10-23
**Author**: AI
