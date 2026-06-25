---
name: pnpm overrides for React peer deps
description: How to set React version overrides when workspace root has no direct React dep
---

## Rule
Use literal version strings in `pnpm.overrides` (e.g. `"react": "19.1.0"`) instead of `"$react"`.

**Why:** The `$react` syntax resolves from the workspace root's own dependencies. The root package.json has no `react` dep (it's a tooling root), so pnpm fails with "Cannot resolve version $react in overrides".

**How to apply:** Check the catalog for the pinned version (`grep "^  react:" pnpm-workspace.yaml`) and use that literal version in overrides.
