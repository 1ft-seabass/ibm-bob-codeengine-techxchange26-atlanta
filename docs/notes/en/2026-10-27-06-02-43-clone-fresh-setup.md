---
tags: [ibmcloud, code-engine, gitleaks, setup, windows]
---

> **⚠️ Confidentiality Rule**
>
> Regarding information recorded in this note:
> - API keys, passwords, and tokens must always be written as placeholders (e.g. `YOUR_API_KEY`)
> - Never include actual sensitive information
> - Do not copy the contents of .env or config files verbatim

**Date**: 2026-10-27
**Related Task**: ibmcloud CLI and gitleaks setup on a freshly cloned environment

## Problem

On a new machine (or a re-setup environment), three things were not ready right after cloning:

1. The `ibmcloud` command was not in the PowerShell PATH
2. The `code-engine` plugin was not installed
3. `gitleaks` was not installed (pre-commit hook was blocking commits)

## Attempts

### ① ibmcloud PATH Issue

**Error**:
```
ibmcloud : The term 'ibmcloud' is not recognized...
```

**Cause**: The ibmcloud CLI was installed at `C:\Program Files\IBM\Cloud\bin\ibmcloud.exe`, but it was not included in PowerShell's PATH. It was expected to be available after a restart, but Bob's internal PowerShell session did not reflect the updated PATH.

**Resolution**: Used the full path `& "C:\Program Files\IBM\Cloud\bin\ibmcloud.exe"`.
After the user restarted, the PATH was confirmed and `ibmcloud` became available.

---

### ② code-engine Plugin Not Installed

**Error**:
```
FAILED
'ce' is not a registered command.
```

**Cause**: The ibmcloud CLI itself was installed, but the `code-engine` plugin requires a separate installation.

**Tried (failed)**: Ran `ibmcloud plugin install code-engine` via Bob tools.
An 80 MB download was triggered and was cancelled after exceeding the 270-second timeout limit (attempted 3 times).

**Resolution**: User ran directly in a terminal:
```powershell
ibmcloud plugin install code-engine -f
```

**Lesson**: Commands involving large downloads cannot be run via Bob tools. Delegate to the user from the start.

---

### ③ gitleaks Not Installed (Pre-commit Block)

**Error**: On `git commit`, the pre-commit hook output the following and blocked the commit:
```
❌ gitleaks not found — blocking commit per fail-closed policy
```

**Cause**: This repository uses the setup-securecheck pattern, which blocks commits when gitleaks is not installed — a "fail-closed" design.

**Resolution**: Installed gitleaks automatically with:
```powershell
node .security-check/cli.js install-gitleaks
```

Output:
```
✅ gitleaks installed: 8.30.0
```

After installation, pre-commit checks passed normally:
```
=== gitleaks ===
  ✅ gitleaks canary correctly detected
✅ All checks passed
```

## Solution (First-Time Setup After Clone)

```powershell
# 1. npm install (dependencies other than gitleaks)
npm install

# 2. Install gitleaks
node .security-check/cli.js install-gitleaks

# 3. Verify ibmcloud CLI PATH
ibmcloud target
# → If it fails, try the full path
& "C:\Program Files\IBM\Cloud\bin\ibmcloud.exe" target

# 4. Check / install code-engine plugin
ibmcloud plugin list
# → If code-engine is missing (run directly in a terminal):
ibmcloud plugin install code-engine -f

# 5. Configure ibmcloud session
ibmcloud login --sso
ibmcloud target -g default
ibmcloud ce project select -n ce-project-7c
```

## Lessons Learned

- **gitleaks installs in one command**: `node .security-check/cli.js install-gitleaks` — worth adding to README.
- **code-engine plugin is 80 MB**: On slow connections it takes time. Running it directly in a terminal is more reliable.
- **ibmcloud PATH is effective after restart, but not in Bob's tool environment**: When running ibmcloud via Bob, use the full path to be safe.

## Future Improvements

- Add post-clone setup steps to README.md
- Automate gitleaks installation with an `npm run setup` script

## Related Documents

- [Code Engine Initial Setup Note](./2026-09-30-16-00-03-codeengine-initial-setup.md)
- [setup-securecheck Introduction Note](./2026-09-30-15-40-58-setup-securecheck-introduction.md)
- [Bob Coin Cost Analysis Note](./2026-10-27-06-02-43-bob-coin-cost-analysis.md)

---

**Last updated**: 2026-10-27
**Author**: AI
