import pino from "pino";

// Plain JSON logging (no worker-thread transports) so the server bundles
// cleanly into a Vercel serverless function.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
});
