// Vercel catch-all serverless function for the API.
// Every request to /api/* is handled by the Express app. Using a catch-all
// route ([...path]) ensures the full original URL (including the /api prefix)
// is preserved so Express can route it correctly.
import app from "../artifacts/api-server/src/vercel";

export default app;
