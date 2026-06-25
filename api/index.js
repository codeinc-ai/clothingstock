// Vercel serverless function for the API.
// Loads the pre-bundled Express app (built during `vercel-build`). Using a
// plain .js loader keeps Vercel's function builder from TypeScript-compiling
// our source. All /api/* requests are routed here via an explicit rewrite in
// vercel.json, and Express receives the original /api/* URL.
const mod = require("../artifacts/api-server/dist/vercel.cjs");

module.exports = mod.default || mod;
