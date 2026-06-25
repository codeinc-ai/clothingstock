import { Router } from "express";
import {
  articlesCollection,
  sizesCollection,
  adjustmentsCollection,
  settingsCollection,
  nextId,
  type Article,
  type ArticleSizeStock,
  type AppSettings,
  type Size,
} from "@workspace/db";
import { z } from "zod";

const router = Router();

const SIZES: Size[] = ["S", "M", "L", "XL", "XXL"];
const SIZE_ORDER: Record<string, number> = { S: 1, M: 2, L: 3, XL: 4, XXL: 5 };

function generateSKU(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let sku = "ART-";
  for (let i = 0; i < 6; i++) {
    sku += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sku;
}

async function getSettings(): Promise<AppSettings> {
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

async function getSizesForArticle(articleId: number): Promise<ArticleSizeStock[]> {
  const col = await sizesCollection();
  const sizes = await col
    .find({ articleId }, { projection: { _id: 0 } })
    .toArray();
  sizes.sort(
    (a, b) => (SIZE_ORDER[a.size] ?? 6) - (SIZE_ORDER[b.size] ?? 6),
  );
  return sizes;
}

async function buildArticleResponse(article: Article, lowStockThreshold: number) {
  const sizes = await getSizesForArticle(article.id);
  const totalQuantity = sizes
    .filter((s) => s.isAvailable)
    .reduce((acc, s) => acc + s.quantity, 0);
  const stockStatus = computeStockStatus(sizes, lowStockThreshold);
  return {
    id: article.id,
    name: article.name,
    sku: article.sku,
    imageUrl: article.imageUrl,
    costPrice: article.costPrice,
    salePrice: article.salePrice,
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

    const col = await articlesCollection();
    let articles = await col.find({}, { projection: { _id: 0 } }).toArray();

    if (search) {
      const q = search.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.name.toLowerCase().includes(q) || a.sku.toLowerCase().includes(q),
      );
    }
    if (fabric) {
      articles = articles.filter((a) => a.fabricType === fabric);
    }

    const responses = await Promise.all(
      articles.map((a) => buildArticleResponse(a, settings.lowStockThreshold)),
    );

    let filtered = responses;

    if (size) {
      filtered = filtered.filter((a) =>
        a.sizes.some((s) => s.size === size && s.isAvailable && s.quantity > 0),
      );
    }
    if (status) {
      filtered = filtered.filter((a) => a.stockStatus === status);
    }

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

    const hasSizeSelected = body.sizes.some((s) => s.isAvailable);
    if (!hasSizeSelected) {
      res.status(400).json({ error: "At least one size must be selected" });
      return;
    }

    const col = await articlesCollection();

    let sku = body.sku?.trim() || "";
    if (!sku) {
      sku = generateSKU();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await col.findOne({ sku });
        if (!existing) break;
        sku = generateSKU();
        attempts++;
      }
    } else {
      const existing = await col.findOne({ sku });
      if (existing) {
        res.status(409).json({ error: `SKU "${sku}" already exists` });
        return;
      }
    }

    const now = new Date();
    const article: Article = {
      id: await nextId("articles"),
      name: body.name,
      sku,
      imageUrl: body.imageUrl ?? null,
      costPrice: body.costPrice,
      salePrice: body.salePrice,
      fabricType: body.fabricType,
      customFabricName: body.customFabricName ?? null,
      notes: body.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne(article);

    const sizesCol = await sizesCollection();
    const sizeDocs: ArticleSizeStock[] = [];
    for (const size of SIZES) {
      const sizeData = body.sizes.find((s) => s.size === size);
      sizeDocs.push({
        id: await nextId("sizes"),
        articleId: article.id,
        size,
        isAvailable: sizeData?.isAvailable ?? false,
        quantity: sizeData?.isAvailable ? sizeData.quantity ?? 0 : 0,
        updatedAt: now,
      });
    }
    await sizesCol.insertMany(sizeDocs);

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
    const col = await articlesCollection();
    const articles = await col.find({}, { projection: { _id: 0 } }).toArray();
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
    const col = await articlesCollection();
    const article = await col.findOne({ id }, { projection: { _id: 0 } });
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    const settings = await getSettings();
    const baseResponse = await buildArticleResponse(article, settings.lowStockThreshold);
    const adjustmentsCol = await adjustmentsCollection();
    const adjustments = await adjustmentsCol
      .find({ articleId: id }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
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
    const col = await articlesCollection();
    const existing = await col.findOne({ id }, { projection: { _id: 0 } });
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

    if (body.sku !== undefined && body.sku !== null) {
      const dup = await col.findOne({ sku: body.sku });
      if (dup && dup.id !== id) {
        res.status(409).json({ error: `SKU "${body.sku}" already exists` });
        return;
      }
    }

    const updateData: Partial<Article> = { updatedAt: new Date() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.sku !== undefined) updateData.sku = body.sku ?? existing.sku;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl ?? null;
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice;
    if (body.salePrice !== undefined) updateData.salePrice = body.salePrice;
    if (body.fabricType !== undefined) updateData.fabricType = body.fabricType;
    if (body.customFabricName !== undefined) updateData.customFabricName = body.customFabricName ?? null;
    if (body.notes !== undefined) updateData.notes = body.notes ?? null;

    await col.updateOne({ id }, { $set: updateData });

    if (body.sizes) {
      const sizesCol = await sizesCollection();
      for (const sizeInput of body.sizes) {
        await sizesCol.updateOne(
          { articleId: id, size: sizeInput.size },
          {
            $set: {
              isAvailable: sizeInput.isAvailable,
              quantity: sizeInput.isAvailable ? sizeInput.quantity : 0,
              updatedAt: new Date(),
            },
          },
        );
      }
    }

    const updated = await col.findOne({ id }, { projection: { _id: 0 } });
    const settings = await getSettings();
    const response = await buildArticleResponse(updated!, settings.lowStockThreshold);
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
    const col = await articlesCollection();
    const existing = await col.findOne({ id });
    if (!existing) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    await col.deleteOne({ id });
    const sizesCol = await sizesCollection();
    await sizesCol.deleteMany({ articleId: id });
    const adjustmentsCol = await adjustmentsCollection();
    await adjustmentsCol.deleteMany({ articleId: id });
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
    const col = await articlesCollection();
    const article = await col.findOne({ id: articleId });
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

    const sizesCol = await sizesCollection();
    const sizeRow = await sizesCol.findOne({ articleId, size: body.size });

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
      newQuantity = body.quantity;
      quantityChanged = body.quantity - previousQuantity;
    }

    const now = new Date();
    if (sizeRow) {
      await sizesCol.updateOne(
        { id: sizeRow.id },
        { $set: { quantity: newQuantity, updatedAt: now } },
      );
    } else {
      await sizesCol.insertOne({
        id: await nextId("sizes"),
        articleId,
        size: body.size,
        isAvailable: true,
        quantity: newQuantity,
        updatedAt: now,
      });
    }

    await col.updateOne({ id: articleId }, { $set: { updatedAt: now } });

    const userId = req.isAuthenticated() ? req.user.id : null;
    const adjustment = {
      id: await nextId("adjustments"),
      articleId,
      size: body.size,
      adjustmentType: body.adjustmentType,
      previousQuantity,
      quantityChanged,
      newQuantity,
      reason: body.reason ?? null,
      userId,
      createdAt: now,
    };
    const adjustmentsCol = await adjustmentsCollection();
    await adjustmentsCol.insertOne(adjustment);

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
    const adjustmentsCol = await adjustmentsCollection();
    const adjustments = await adjustmentsCol
      .find({ articleId }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(adjustments);
  } catch (err) {
    req.log.error({ err }, "Failed to list adjustments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
