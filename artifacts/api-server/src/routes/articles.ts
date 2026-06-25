import { Router } from "express";
import { db } from "@workspace/db";
import {
  articlesTable,
  articleSizeStockTable,
  stockAdjustmentsTable,
  appSettingsTable,
} from "@workspace/db";
import { eq, desc, asc, sql, and, or, ilike, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;

function generateSKU(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let sku = "ART-";
  for (let i = 0; i < 6; i++) {
    sku += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sku;
}

async function getSettings() {
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

function computeStockStatus(
  sizes: { isAvailable: boolean; quantity: number }[],
  lowStockThreshold: number,
): "in_stock" | "low_stock" | "out_of_stock" {
  const enabledSizes = sizes.filter((s) => s.isAvailable);
  if (enabledSizes.length === 0) return "out_of_stock";
  const totalQty = enabledSizes.reduce((acc, s) => acc + s.quantity, 0);
  if (totalQty === 0) return "out_of_stock";
  if (totalQty <= lowStockThreshold) return "low_stock";
  const anyLow = enabledSizes.some((s) => s.quantity <= lowStockThreshold);
  if (anyLow) return "low_stock";
  return "in_stock";
}

async function buildArticleResponse(article: typeof articlesTable.$inferSelect, lowStockThreshold: number) {
  const sizes = await db
    .select()
    .from(articleSizeStockTable)
    .where(eq(articleSizeStockTable.articleId, article.id))
    .orderBy(
      sql`CASE size WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 WHEN 'XL' THEN 4 WHEN 'XXL' THEN 5 ELSE 6 END`,
    );
  const totalQuantity = sizes
    .filter((s) => s.isAvailable)
    .reduce((acc, s) => acc + s.quantity, 0);
  const stockStatus = computeStockStatus(sizes, lowStockThreshold);
  return {
    id: article.id,
    name: article.name,
    sku: article.sku,
    imageUrl: article.imageUrl,
    costPrice: parseFloat(article.costPrice),
    salePrice: parseFloat(article.salePrice),
    fabricType: article.fabricType,
    customFabricName: article.customFabricName,
    notes: article.notes,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    sizes,
    totalQuantity,
    stockStatus,
  };
}

// GET /api/articles
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const settings = await getSettings();
    const { search, fabric, size, status, sort } = req.query as Record<string, string>;

    let articles = await db.select().from(articlesTable);

    // Filter by search
    if (search) {
      articles = articles.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.sku.toLowerCase().includes(search.toLowerCase()),
      );
    }
    // Filter by fabric
    if (fabric) {
      articles = articles.filter((a) => a.fabricType === fabric);
    }

    // Build article responses to apply size/status filters
    const responses = await Promise.all(
      articles.map((a) => buildArticleResponse(a, settings.lowStockThreshold)),
    );

    let filtered = responses;

    // Filter by size
    if (size) {
      filtered = filtered.filter((a) =>
        a.sizes.some((s) => s.size === size && s.isAvailable && s.quantity > 0),
      );
    }
    // Filter by status
    if (status) {
      filtered = filtered.filter((a) => a.stockStatus === status);
    }

    // Sort
    if (sort === "oldest") {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sort === "alphabetical") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "lowest_stock") {
      filtered.sort((a, b) => a.totalQuantity - b.totalQuantity);
    } else if (sort === "highest_stock") {
      filtered.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } else if (sort === "cost_price_asc") {
      filtered.sort((a, b) => a.costPrice - b.costPrice);
    } else if (sort === "cost_price_desc") {
      filtered.sort((a, b) => b.costPrice - a.costPrice);
    } else if (sort === "sale_price_asc") {
      filtered.sort((a, b) => a.salePrice - b.salePrice);
    } else if (sort === "sale_price_desc") {
      filtered.sort((a, b) => b.salePrice - a.salePrice);
    } else {
      // Default: newest first
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "Failed to list articles");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/articles
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const bodySchema = z.object({
      name: z.string().min(1),
      sku: z.string().nullish(),
      imageUrl: z.string().nullish(),
      costPrice: z.number().min(0),
      salePrice: z.number().min(0),
      fabricType: z.string().min(1),
      customFabricName: z.string().nullish(),
      notes: z.string().nullish(),
      sizes: z
        .array(
          z.object({
            size: z.enum(["S", "M", "L", "XL", "XXL"]),
            isAvailable: z.boolean(),
            quantity: z.number().int().min(0),
          }),
        )
        .min(1),
    });
    const body = bodySchema.parse(req.body);

    // Validate at least one size selected
    const hasSizeSelected = body.sizes.some((s) => s.isAvailable);
    if (!hasSizeSelected) {
      res.status(400).json({ error: "At least one size must be selected" });
      return;
    }

    // Generate SKU if not provided
    let sku = body.sku?.trim() || "";
    if (!sku) {
      sku = generateSKU();
      // ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const existing = await db
          .select()
          .from(articlesTable)
          .where(eq(articlesTable.sku, sku))
          .limit(1);
        if (existing.length === 0) break;
        sku = generateSKU();
        attempts++;
      }
    } else {
      // Check for duplicate SKU
      const existing = await db
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.sku, sku))
        .limit(1);
      if (existing.length > 0) {
        res.status(409).json({ error: `SKU "${sku}" already exists` });
        return;
      }
    }

    const [article] = await db
      .insert(articlesTable)
      .values({
        name: body.name,
        sku,
        imageUrl: body.imageUrl ?? null,
        costPrice: String(body.costPrice),
        salePrice: String(body.salePrice),
        fabricType: body.fabricType,
        customFabricName: body.customFabricName ?? null,
        notes: body.notes ?? null,
      })
      .returning();

    // Insert sizes
    await db.insert(articleSizeStockTable).values(
      SIZES.map((size) => {
        const sizeData = body.sizes.find((s) => s.size === size);
        return {
          articleId: article.id,
          size,
          isAvailable: sizeData?.isAvailable ?? false,
          quantity: sizeData?.isAvailable ? (sizeData.quantity ?? 0) : 0,
        };
      }),
    );

    const settings = await getSettings();
    const response = await buildArticleResponse(article, settings.lowStockThreshold);
    res.status(201).json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to create article");
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/articles/low-stock  (must be before /:id)
router.get("/low-stock", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const settings = await getSettings();
    const articles = await db.select().from(articlesTable);
    const responses = await Promise.all(
      articles.map((a) => buildArticleResponse(a, settings.lowStockThreshold)),
    );
    const lowStock = responses.filter(
      (a) => a.stockStatus === "low_stock" || a.stockStatus === "out_of_stock",
    );
    lowStock.sort((a, b) => a.totalQuantity - b.totalQuantity);
    res.json(lowStock);
  } catch (err) {
    req.log.error({ err }, "Failed to list low stock articles");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/articles/:id
router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid article ID" });
      return;
    }
    const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, id)).limit(1);
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    const settings = await getSettings();
    const baseResponse = await buildArticleResponse(article, settings.lowStockThreshold);
    const adjustments = await db
      .select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.articleId, id))
      .orderBy(desc(stockAdjustmentsTable.createdAt));
    res.json({ ...baseResponse, adjustments });
  } catch (err) {
    req.log.error({ err }, "Failed to get article");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/articles/:id
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid article ID" });
      return;
    }
    const [existing] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      sku: z.string().nullish(),
      imageUrl: z.string().nullish(),
      costPrice: z.number().min(0).optional(),
      salePrice: z.number().min(0).optional(),
      fabricType: z.string().min(1).optional(),
      customFabricName: z.string().nullish(),
      notes: z.string().nullish(),
      sizes: z
        .array(
          z.object({
            size: z.enum(["S", "M", "L", "XL", "XXL"]),
            isAvailable: z.boolean(),
            quantity: z.number().int().min(0),
          }),
        )
        .optional(),
    });
    const body = bodySchema.parse(req.body);

    // Check for duplicate SKU if provided
    if (body.sku !== undefined && body.sku !== null) {
      const dupSku = await db
        .select()
        .from(articlesTable)
        .where(eq(articlesTable.sku, body.sku))
        .limit(1);
      if (dupSku.length > 0 && dupSku[0].id !== id) {
        res.status(409).json({ error: `SKU "${body.sku}" already exists` });
        return;
      }
    }

    const updateData: Partial<typeof articlesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.sku !== undefined) updateData.sku = body.sku ?? existing.sku;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.costPrice !== undefined) updateData.costPrice = String(body.costPrice);
    if (body.salePrice !== undefined) updateData.salePrice = String(body.salePrice);
    if (body.fabricType !== undefined) updateData.fabricType = body.fabricType;
    if (body.customFabricName !== undefined) updateData.customFabricName = body.customFabricName;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const [updated] = await db
      .update(articlesTable)
      .set(updateData)
      .where(eq(articlesTable.id, id))
      .returning();

    // Update sizes if provided
    if (body.sizes) {
      for (const sizeInput of body.sizes) {
        await db
          .update(articleSizeStockTable)
          .set({
            isAvailable: sizeInput.isAvailable,
            quantity: sizeInput.isAvailable ? sizeInput.quantity : 0,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(articleSizeStockTable.articleId, id),
              eq(articleSizeStockTable.size, sizeInput.size),
            ),
          );
      }
    }

    const settings = await getSettings();
    const response = await buildArticleResponse(updated, settings.lowStockThreshold);
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to update article");
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/articles/:id
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid article ID" });
      return;
    }
    const [existing] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    await db.delete(articlesTable).where(eq(articlesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete article");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/articles/:id/adjustments
router.post("/:id/adjustments", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const articleId = parseInt(req.params.id);
    if (isNaN(articleId)) {
      res.status(400).json({ error: "Invalid article ID" });
      return;
    }
    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId))
      .limit(1);
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const bodySchema = z.object({
      size: z.enum(["S", "M", "L", "XL", "XXL"]),
      adjustmentType: z.enum(["add", "remove", "replace"]),
      quantity: z.number().int().min(0),
      reason: z.string().nullish(),
    });
    const body = bodySchema.parse(req.body);

    const [sizeRow] = await db
      .select()
      .from(articleSizeStockTable)
      .where(
        and(
          eq(articleSizeStockTable.articleId, articleId),
          eq(articleSizeStockTable.size, body.size),
        ),
      )
      .limit(1);

    const previousQuantity = sizeRow?.quantity ?? 0;
    let newQuantity: number;
    let quantityChanged: number;

    if (body.adjustmentType === "add") {
      newQuantity = previousQuantity + body.quantity;
      quantityChanged = body.quantity;
    } else if (body.adjustmentType === "remove") {
      newQuantity = previousQuantity - body.quantity;
      if (newQuantity < 0) {
        res.status(400).json({ error: "Cannot reduce quantity below zero" });
        return;
      }
      quantityChanged = -body.quantity;
    } else {
      // replace
      newQuantity = body.quantity;
      quantityChanged = body.quantity - previousQuantity;
    }

    // Update size stock
    if (sizeRow) {
      await db
        .update(articleSizeStockTable)
        .set({ quantity: newQuantity, updatedAt: new Date() })
        .where(eq(articleSizeStockTable.id, sizeRow.id));
    } else {
      await db.insert(articleSizeStockTable).values({
        articleId,
        size: body.size,
        isAvailable: true,
        quantity: newQuantity,
      });
    }

    // Update article updatedAt
    await db
      .update(articlesTable)
      .set({ updatedAt: new Date() })
      .where(eq(articlesTable.id, articleId));

    // Save adjustment record
    const userId = req.isAuthenticated() ? req.user.id : null;
    const [adjustment] = await db
      .insert(stockAdjustmentsTable)
      .values({
        articleId,
        size: body.size,
        adjustmentType: body.adjustmentType,
        previousQuantity,
        quantityChanged,
        newQuantity,
        reason: body.reason ?? null,
        userId,
      })
      .returning();

    res.status(201).json(adjustment);
  } catch (err) {
    req.log.error({ err }, "Failed to adjust stock");
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.issues });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/articles/:id/adjustments/list
router.get("/:id/adjustments/list", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const articleId = parseInt(req.params.id);
    if (isNaN(articleId)) {
      res.status(400).json({ error: "Invalid article ID" });
      return;
    }
    const adjustments = await db
      .select()
      .from(stockAdjustmentsTable)
      .where(eq(stockAdjustmentsTable.articleId, articleId))
      .orderBy(desc(stockAdjustmentsTable.createdAt));
    res.json(adjustments);
  } catch (err) {
    req.log.error({ err }, "Failed to list adjustments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
