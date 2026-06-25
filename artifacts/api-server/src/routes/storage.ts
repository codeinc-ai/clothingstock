import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { createUploadTarget, createDownloadUrl } from "../lib/objectStorage";

const router: IRouter = Router();

/**
 * POST /api/storage/uploads/request-url
 *
 * Request a presigned URL for a file upload (Backblaze B2, S3-compatible).
 * The client sends JSON metadata (name, size, contentType) — NOT the file —
 * then PUTs the file directly to the returned presigned URL. The returned
 * `objectPath` is a stable app URL that serves the (private) object via a
 * presigned GET redirect.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const { uploadURL, key } = await createUploadTarget(name);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath: `/api/storage/objects/${key}`,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /api/storage/objects/*key
 *
 * Serve a private object by redirecting to a short-lived presigned GET URL.
 * The browser's <img> request carries the session cookie (same-origin), so the
 * route stays behind authentication. Redirects are followed automatically by
 * the image element, and image GETs are not subject to CORS.
 */
router.get("/storage/objects/*key", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const raw = (req.params as Record<string, unknown>).key;
  const key = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
  if (!key) {
    res.status(400).json({ error: "Missing object key" });
    return;
  }

  try {
    const url = await createDownloadUrl(key);
    // Don't let the redirect itself get cached; the underlying object URL is
    // short-lived and rotates on each request.
    res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    res.redirect(302, url);
  } catch (error) {
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
