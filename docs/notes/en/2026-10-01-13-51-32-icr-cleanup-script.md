---
tags: [icr, code-engine, cleanup, maintenance, storage]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-10-01
**Related Task**: ICR storage exceeding 80% — automated cleanup setup

## Problem

Repeated `npm run build` runs cause untagged digests to accumulate in ICR, consuming storage toward the 512 MB limit.

- `ibmcloud cr images` **only shows tagged images**
- Deleting a tag leaves the actual digest (layers) behind
- Untagged digests are only visible with `ibmcloud cr image-digests`

Investigation revealed that the majority of the 424 MB usage was caused by these leftover untagged digests.

## Solution

### `scripts/ce-cleanup.js`

A cleanup script that runs automatically at the end of `npm run build`.

**How it works**:
1. Reads the ICR region, namespace, and repository from `CE_BUILD_IMAGE` in `.env.ce`
2. Gets a list of untagged digests via `ibmcloud cr image-digests`
3. **Skips** any digest with the `latest` tag (must not be deleted)
4. Deletes only untagged digests via `ibmcloud cr image-rm`

**Implementation location**: `scripts/ce-cleanup.js`

### Integration into `package.json`

```json
"build:cleanup": "node scripts/ce-cleanup.js",
"build": "npm run build:image_build && npm run build:update_app && npm run build:cleanup"
```

`npm run build` flow:
1. `build:image_build` → push new `latest` to ICR
2. `build:update_app` → update the Code Engine app
3. `build:cleanup` → automatically delete old untagged digests

### Tags vs Digests in ICR

| Command | What It Shows |
|---|---|
| `ibmcloud cr images` | Tagged images only |
| `ibmcloud cr image-digests` | Tagged + **untagged** (all digests) |

Deleting a tag alone does not free storage — the actual digest (layers) remains. Storage is only freed when the digest itself is deleted.

## Lessons Learned

- **`ibmcloud cr images` alone is not enough**: Untagged digests are only visible with `image-digests`. If storage isn't decreasing, check with `image-digests`.
- **GC timing is non-deterministic**: Usage may not be reflected immediately after deletion. Wait and recheck.
- **Never delete a digest with the `latest` tag**: The running app references it — always confirm tag status before deleting.

## Future Improvements

- Consider adding a step to display `ibmcloud cr quota` after cleanup to verify usage

## Related Documents

- [ICR Storage Investigation Note](./2026-09-30-16-00-03-icr-storage-investigation.md)
- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)

---

**Last updated**: 2026-10-01
**Author**: AI
