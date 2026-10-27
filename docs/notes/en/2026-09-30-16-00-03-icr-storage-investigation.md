---
tags: [icr, code-engine, storage, maintenance, ibmcloud]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-09-30
**Related Task**: Investigation of ICR storage exceeding 80% of quota

## Problem

The following warning appeared during `npm run build`:

```
IBM Container Registry storage usage has exceeded 80% of the quota.
```

Since reaching the storage limit would cause builds and deployments to fail, the current situation was investigated.

## Investigation

### Checking Storage Usage

```bash
ibmcloud cr quota
```

**Result**:

| Item | Limit | Used |
|---|---|---|
| Pull traffic | 5.0 GB | 0 B |
| Storage | 512 MB | 422 MB (~82%) |

About 90 MB remaining. Since a single build consumes roughly 60–70 MB, the limit could be reached in 1–2 more builds.

### Current Image List

```bash
ibmcloud cr images
```

**Result (project `YOUR_PROJECT_NAME` / namespace `YOUR_ICR_NAMESPACE`)**:

| Image | Tag | Size | Safe to Delete? |
|---|---|---|---|
| `app-hono-app` | `TIMESTAMP` | 62 MB | ❌ Referenced by running app |
| `app-ibm-bob-codeengine-sample-02` | `TIMESTAMP` | 62 MB | ❌ Referenced by running app |
| `build-bob-codeengine-sample-build` | `latest` | 67 MB | ❌ Needed for next build |
| `build-hono-app-build` | `latest` | 62 MB | ❌ Needed for next build |
| `build-ibm-bob-codeengine-sample-02-build` | `latest` | 69 MB | ❌ Needed for next build |

**Conclusion**: No images can be safely deleted at this point. All are either referenced by a running app or needed for the next build.

### Image Types and Roles

Code Engine creates two types of images in ICR:

| Type | Naming Pattern | When Generated | Role |
|---|---|---|---|
| `app-*` | `app-{APP_NAME}:{timestamp}` | On `application create` / `application update` | The image the app actually references |
| `build-*` | `build-{BUILD_NAME}:latest` | On `buildrun submit` | Build artifact (specified in `application update --image`) |

- `app-*` tags accumulate with a new timestamp on each `application update` (old ones are not removed)
- `build-*:latest` is overwritten each time, so it does not accumulate

## Solution

### Ongoing Maintenance

Each `npm run build` adds one `app-*` tag. Old `app-*` tags need to be deleted periodically.

**Safe to delete**:
- `app-{APP_NAME}:{old timestamp}` — any that are not currently referenced by the running app

**Do NOT delete**:
- `app-{APP_NAME}:{current timestamp}` — verify with `ibmcloud ce application get --name YOUR_APP_NAME`
- `build-{BUILD_NAME}:latest` — output destination for the next `buildrun submit`

### Checking the Currently Referenced Image

```bash
ibmcloud ce application get --name YOUR_APP_NAME
# → The tag shown in the "Image:" field must not be deleted
```

### Deleting Old `app-*` Tags

```bash
ibmcloud cr image-rm YOUR_ICR_REGION/YOUR_ICR_NAMESPACE/app-YOUR_APP_NAME:OLD_TIMESTAMP
```

### Checking Storage Usage

```bash
ibmcloud cr quota
```

## Lessons Learned

- **`app-*` images accumulate on every `application update`**: Unlike `build-*:latest`, `app-*` images stack up with timestamps. On the Lite plan's 512 MB limit, a few deployments can fill it up quickly.
- **Always check the currently referenced image before deleting**: Deleting without checking via `application get` can make the app unreachable (404).
- **`build-*:latest` does not need to be deleted**: It is always overwritten, so it does not accumulate. Deleting it will actually cause the next `buildrun submit` to fail.

## Future Improvements

- Consider adding a script (e.g. `scripts/ce-cleanup.js`) to automatically delete old `app-*` tags after `npm run build`
- Consider automatically displaying storage usage after a build

## Related Documents

- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)

---

**Last updated**: 2026-09-30
**Author**: AI
