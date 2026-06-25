import { pgTable, serial, text, numeric, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const articlesTable = pgTable("articles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  imageUrl: text("image_url"),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull(),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull(),
  fabricType: text("fabric_type").notNull(),
  customFabricName: text("custom_fabric_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("articles_sku_idx").on(table.sku),
  index("articles_created_at_idx").on(table.createdAt),
]);

export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;

export const articleSizeStockTable = pgTable("article_size_stock", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articlesTable.id, { onDelete: "cascade" }),
  size: text("size").notNull(), // S, M, L, XL, XXL
  isAvailable: boolean("is_available").notNull().default(false),
  quantity: integer("quantity").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("article_size_stock_article_id_idx").on(table.articleId),
]);

export const insertArticleSizeStockSchema = createInsertSchema(articleSizeStockTable).omit({ id: true, updatedAt: true });
export type InsertArticleSizeStock = z.infer<typeof insertArticleSizeStockSchema>;
export type ArticleSizeStock = typeof articleSizeStockTable.$inferSelect;

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articlesTable.id, { onDelete: "cascade" }),
  size: text("size").notNull(),
  adjustmentType: text("adjustment_type").notNull(), // add, remove, replace
  previousQuantity: integer("previous_quantity").notNull(),
  quantityChanged: integer("quantity_changed").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  reason: text("reason"),
  userId: text("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("stock_adjustments_article_id_idx").on(table.articleId),
]);

export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustmentsTable).omit({ id: true, createdAt: true });
export type InsertStockAdjustment = z.infer<typeof insertStockAdjustmentSchema>;
export type StockAdjustment = typeof stockAdjustmentsTable.$inferSelect;

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  currency: text("currency").notNull().default("PKR"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
  brandName: text("brand_name").notNull().default("My Clothing Brand"),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
