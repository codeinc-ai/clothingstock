---
name: Zod v3 in esbuild bundles
description: Why zod/v4 import breaks esbuild bundling and how to fix it
---

## Rule
Import from `"zod"` not `"zod/v4"` in any server code bundled by esbuild.

**Why:** The workspace catalog pins `zod: ^3.25.76` (zod v3). The `zod/v4` subpath export is a zod v4 feature. esbuild cannot resolve it, producing "Could not resolve zod/v4" errors at build time.

**How to apply:** Any route or lib file in artifacts/api-server must use `import { z } from "zod"`. Also ensure `zod: "catalog:"` is in the package's dependencies (not just devDependencies).
