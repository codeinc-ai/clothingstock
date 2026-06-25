// Vercel catch-all serverless function for the API.
// Loads the pre-bundled Express app (built during `vercel-build`). Using a
// plain .js loader keeps Vercel's function builder from TypeScript-compiling
// our source, and the catch-all filename preserves the full /api/* request URL.
const mod = require("../artifacts/api-server/dist/vercel.cjs");

module.exports = mod.default || mod;
