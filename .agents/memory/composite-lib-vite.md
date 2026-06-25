---
name: Composite libs and import.meta.env
description: Composite libs cannot use Vite-specific types like import.meta.env
---

## Rule
Composite libs (lib/* packages with emitDeclarationOnly) must NOT reference `import.meta.env` or add `"vite/client"` to tsconfig types.

**Why:** Composite libs build with plain `tsc --build` which doesn't have vite/client in scope. Adding it to `types` causes TS2688 "Cannot find type definition file for vite/client" because vite is not installed as a dep of lib packages.

**How to apply:** Replace `import.meta.env.BASE_URL` with `"/"` or pass the base URL as a parameter. The consuming Vite app handles the env; the lib should be framework-agnostic.
