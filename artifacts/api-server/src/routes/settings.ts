import { Router } from "express";
import { settingsCollection, nextId, type AppSettings } from "@workspace/db";
import { z } from "zod";

const router = Router();

async function getOrCreateSettings(): Promise<AppSettings> {
  const col = await settingsCollection();
  const existing = await col.findOne({}, { projection: { _id: 0 } });
  if (existing) return existing;
  const created: AppSettings = {
    id: await nextId("settings"),
    currency: "PKR",
    lowStockThreshold: 3,
    brandName: "My Clothing Brand",
    updatedAt: new Date(),
  };
  await col.insertOne(created);
  return created;
}

// GET /api/settings
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const settings = await getOrCreateSettings();
    res.json({
      currency: settings.currency,
      lowStockThreshold: settings.lowStockThreshold,
      brandName: settings.brandName,
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/settings
router.patch("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const bodySchema = z.object({
      currency: z.string().optional(),
      lowStockThreshold: z.number().int().min(1).optional(),
      brandName: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);
    const existing = await getOrCreateSettings();

    const updateData: Partial<AppSettings> = { updatedAt: new Date() };
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.lowStockThreshold !== undefined) updateData.lowStockThreshold = body.lowStockThreshold;
    if (body.brandName !== undefined) updateData.brandName = body.brandName;

    const col = await settingsCollection();
    await col.updateOne({ id: existing.id }, { $set: updateData });
    const updated = await getOrCreateSettings();

    res.json({
      currency: updated.currency,
      lowStockThreshold: updated.lowStockThreshold,
      brandName: updated.brandName,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
