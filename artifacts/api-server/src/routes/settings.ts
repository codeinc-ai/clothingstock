import { Router } from "express";
import { db } from "@workspace/db";
import { appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

async function getOrCreateSettings() {
  const [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    const [created] = await db
      .insert(appSettingsTable)
      .values({ currency: "PKR", lowStockThreshold: 3, brandName: "My Clothing Brand" })
      .returning();
    return created;
  }
  return settings;
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

    const updateData: Partial<typeof appSettingsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.lowStockThreshold !== undefined) updateData.lowStockThreshold = body.lowStockThreshold;
    if (body.brandName !== undefined) updateData.brandName = body.brandName;

    const [updated] = await db
      .update(appSettingsTable)
      .set(updateData)
      .where(eq(appSettingsTable.id, existing.id))
      .returning();

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
