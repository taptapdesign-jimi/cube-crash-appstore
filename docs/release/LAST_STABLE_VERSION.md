# Last stable version

Single source of truth for **which release is considered stable** in this repo.
When you ask Cursor to restore the last stable version, it should read the flags below.

## Search flags (do not rename)

```txt
__CC_LAST_STABLE_VERSION__=608
__CC_LAST_STABLE_GIT_COMMIT__=0b02aa234301cd11993ae38089e4dfd7622efff3
__CC_LAST_STABLE_GIT_COMMIT_SHORT__=0b02aa2
__CC_LAST_STABLE_LABEL__=v608-IGRAJ
```

## Human summary

| Field | Value |
|-------|-------|
| Stable label | **v608-IGRAJ** |
| Stable commit | `0b02aa2` — IGRAJ CTA, bundled Stack to Six iPhone wrapper, current web build parity |
| Date marked stable | 2026-07-10 |

## How to update (when a new version becomes stable)

1. Edit the four `__CC_LAST_STABLE_*__` flags above.
2. Set `__CC_LAST_STABLE_VERSION__` to the new number (e.g. `606`).
3. Set `__CC_LAST_STABLE_GIT_COMMIT__` to the full hash of the stable commit on `main`.
4. Set `__CC_LAST_STABLE_GIT_COMMIT_SHORT__` to the short hash (7 chars).
5. Set `__CC_LAST_STABLE_LABEL__` to `v###` (e.g. `v606`).
6. Update the human summary table.

## Restore commands (reference)

```bash
# Inspect stable commit
git show __CC_LAST_STABLE_GIT_COMMIT_SHORT__

# Checkout stable state (detached HEAD — for testing only)
git checkout __CC_LAST_STABLE_GIT_COMMIT__

# Create a branch from stable
git checkout -b restore-stable-v608-igraj __CC_LAST_STABLE_GIT_COMMIT__
```
