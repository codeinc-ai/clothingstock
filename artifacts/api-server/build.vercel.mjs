import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

// Bundle the Express app (without app.listen) into a single self-contained CJS
// file that Vercel's serverless function loads directly. This avoids Vercel's
// @vercel/node TypeScript compilation (which requires explicit import
// extensions our codebase does not use).
async function buildVercel() {
  const outfile = path.resolve(artifactDir, "dist/vercel.cjs");
  await rm(outfile, { force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/vercel.ts")],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    outfile,
    logLevel: "info",
    sourcemap: false,
    // Only optional native add-ons that the bundled libraries (mongodb) load
    // lazily via try/catch. Everything else (express, mongodb core, aws-sdk,
    // jsonwebtoken, zod, workspace packages) is bundled.
    external: [
      "*.node",
      "kerberos",
      "@mongodb-js/zstd",
      "@aws-sdk/credential-providers",
      "gcp-metadata",
      "snappy",
      "socks",
      "aws4",
      "mongodb-client-encryption",
    ],
  });
}

buildVercel().catch((err) => {
  console.error(err);
  process.exit(1);
});
