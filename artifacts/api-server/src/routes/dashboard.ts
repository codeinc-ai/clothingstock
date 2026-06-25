import { Router } from "express";
import { db } from "@workspace/db";
import { articlesTable, articleSizeStockTable, appSettingsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

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
  threshold: number,
): "in_stock" | "low_stock" | "out_of_stock" {
  const enabledSizes = sizes.filter((s) => s.isAvailable);
  if (enabledSizes.length === 0) return "out_of_stock";
  const total = enabledSizes.reduce((acc, s) => acc + s.quantity, 0);
  if (total === 0) return "out_of_stock";
  if (total <= threshold) return "low_stock";
  if (enabledSizes.some((s) => s.quantity <= threshold)) return "low_stock";
  return "in_stock";
}

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const settings = await getSettings();
    const articles = await db.select().from(articlesTable);
    const allSizes = await db.select().from(articleSizeStockTable);

    const sizesByArticle = new Map<number, typeof allSizes>();
    for (const s of allSizes) {
      if (!sizesByArticle.has(s.articleId)) sizesByArticle.set(s.articleId, []);
      sizesByArticle.get(s.articleId)!.push(s);
    }

    let totalPieces = 0;
    let totalInventoryCost = 0;
    let potentialRevenue = 0;
    let lowStockArticles = 0;
    let outOfStockArticles = 0;

    for (const article of articles) {
      const sizes = sizesByArticle.get(article.id) ?? [];
      const enabledSizes = sizes.filter((s) => s.isAvailable);
      const qty = enabledSizes.reduce((acc, s) => acc + s.quantity, 0);
      const costPrice = parseFloat(article.costPrice);
      const salePrice = parseFloat(article.salePrice);
      totalPieces += qty;
      totalInventoryCost += qty * costPrice;
      potentialRevenue += qty * salePrice;
      const status = computeStockStatus(sizes, settings.lowStockThreshold);
      if (status === "out_of_stock") outOfStockArticles++;
      else if (status === "low_stock") lowStockArticles++;
    }

    const potentialGrossProfit = potentialRevenue - totalInventoryCost;

    res.json({
      totalArticles: articles.length,
      totalPieces,
      totalInventoryCost,
      potentialRevenue,
      potentialGrossProfit,
      lowStockArticles,
      outOfStockArticles,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/recent-articles
router.get("/recent-articles", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const settings = await getSettings();
    const articles = await db
      .select()
      .from(articlesTable)
      .orderBy(desc(articlesTable.updatedAt))
      .limit(10);
    const allSizes = await db.select().from(articleSizeStockTable);
    const sizesByArticle = new Map<number, typeof allSizes>();
    for (const s of allSizes) {
      if (!sizesByArticle.has(s.articleId)) sizesByArticle.set(s.articleId, []);
      sizesByArticle.get(s.articleId)!.push(s);
    }

    const responses = articles.map((article) => {
      const sizes = sizesByArticle.get(article.id) ?? [];
      const totalQuantity = sizes.filter((s) => s.isAvailable).reduce((acc, s) => acc + s.quantity, 0);
      const stockStatus = computeStockStatus(sizes, settings.lowStockThreshold);
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
    });

    res.json(responses);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent articles");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/stock-by-size
router.get("/stock-by-size", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const allSizes = await db.select().from(articleSizeStockTable);
    const result: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    for (const s of allSizes) {
      if (s.isAvailable && result[s.size] !== undefined) {
        result[s.size] += s.quantity;
      }
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get stock by size");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
