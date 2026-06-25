import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { createUploadTarget } from "../lib/objectStorage";

const router: IRouter = Router();

/**
 * POST /api/storage/uploads/request-url
 *
 * Request a presigned URL for a file upload (Backblaze B2, S3-compatible).
 * The client sends JSON metadata (name, size, contentType) — NOT the file —
 * then PUTs the file directly to the returned presigned URL. The returned
 * `objectPath` is the public URL the file is served from.
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
      const { uploadURL, publicUrl } = await createUploadTarget(name);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath: publicUrl,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

export default router;
