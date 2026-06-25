import { MongoClient, type Db, type Collection } from "mongodb";

// ---------------------------------------------------------------------------
// Connection (serverless-safe, cached across invocations)
// ---------------------------------------------------------------------------

interface MongoCache {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
}

const globalForMongo = globalThis as unknown as {
  __mongoCache?: MongoCache;
};

const cache: MongoCache =
  globalForMongo.__mongoCache ?? (globalForMongo.__mongoCache = { client: null, promise: null });

function getUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI must be set. Provide your MongoDB Atlas connection string.",
    );
  }
  return uri;
}

export async function getClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;
  if (!cache.promise) {
    const client = new MongoClient(getUri(), {
      maxPoolSize: 10,
    });
    cache.promise = client.connect();
  }
  cache.client = await cache.promise;
  return cache.client;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  // Database name can be embedded in the URI; fall back to MONGODB_DB or a default.
  const dbName = process.env.MONGODB_DB || undefined;
  return client.db(dbName);
}

// ---------------------------------------------------------------------------
// Collection names & typed accessors
// ---------------------------------------------------------------------------

export const COLLECTIONS = {
  articles: "articles",
  sizes: "article_size_stock",
  adjustments: "stock_adjustments",
  settings: "app_settings",
  counters: "counters",
} as const;

export async function articlesCollection(): Promise<Collection<Article>> {
  return (await getDb()).collection<Article>(COLLECTIONS.articles);
}

export async function sizesCollection(): Promise<Collection<ArticleSizeStock>> {
  return (await getDb()).collection<ArticleSizeStock>(COLLECTIONS.sizes);
}

export async function adjustmentsCollection(): Promise<Collection<StockAdjustment>> {
  return (await getDb()).collection<StockAdjustment>(COLLECTIONS.adjustments);
}

export async function settingsCollection(): Promise<Collection<AppSettings>> {
  return (await getDb()).collection<AppSettings>(COLLECTIONS.settings);
}

// ---------------------------------------------------------------------------
// Auto-increment numeric IDs (preserves the existing API contract that uses
// integer ids instead of MongoDB ObjectIds).
// ---------------------------------------------------------------------------

export async function nextId(name: keyof typeof COLLECTIONS | string): Promise<number> {
  const db = await getDb();
  const result = await db.collection<{ _id: string; seq: number }>(COLLECTIONS.counters).findOneAndUpdate(
    { _id: name as string },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  // mongodb v6 returns the document directly; older returns { value }.
  const doc = (result as unknown as { value?: { seq: number }; seq?: number });
  const seq = doc?.seq ?? doc?.value?.seq;
  if (typeof seq !== "number") {
    throw new Error(`Failed to generate id for "${name}"`);
  }
  return seq;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type Size = "S" | "M" | "L" | "XL" | "XXL";

export interface Article {
  id: number;
  name: string;
  sku: string;
  imageUrl: string | null;
  costPrice: number;
  salePrice: number;
  fabricType: string;
  customFabricName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleSizeStock {
  id: number;
  articleId: number;
  size: Size;
  isAvailable: boolean;
  quantity: number;
  updatedAt: Date;
}

export interface StockAdjustment {
  id: number;
  articleId: number;
  size: Size;
  adjustmentType: "add" | "remove" | "replace";
  previousQuantity: number;
  quantityChanged: number;
  newQuantity: number;
  reason: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface AppSettings {
  id: number;
  currency: string;
  lowStockThreshold: number;
  brandName: string;
  updatedAt: Date | null;
}
