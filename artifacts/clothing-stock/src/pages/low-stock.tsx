import { useState } from "react";
import { Link } from "wouter";
import {
  useListLowStockArticles,
  useGetSettings,
} from "@workspace/api-client-react";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Plus } from "lucide-react";

export default function LowStock() {
  const { data: articles, isLoading } = useListLowStockArticles();
  const { data: settings } = useGetSettings();
  const currency = settings?.currency ?? "PKR";
  const threshold = settings?.lowStockThreshold ?? 3;

  const lowOnly = articles?.filter((a: any) => a.stockStatus === "low_stock") ?? [];
  const outOnly = articles?.filter((a: any) => a.stockStatus === "out_of_stock") ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Low Stock</h1>
          <p className="text-muted-foreground mt-1">
            Articles with total quantity at or below {threshold} pieces.
          </p>
        </div>
        <Link href="/add-article">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Article
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
          <h3 className="text-lg font-medium mb-1">All stocked up</h3>
          <p className="text-sm text-muted-foreground">
            No articles with low or zero stock right now.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {outOnly.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h2 className="font-semibold text-red-600">Out of Stock ({outOnly.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {outOnly.map((article: any) => (
                  <ArticleCard key={article.id} article={article} currency={currency} />
                ))}
              </div>
            </section>
          )}

          {lowOnly.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="font-semibold text-amber-600">Low Stock ({lowOnly.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {lowOnly.map((article: any) => (
                  <ArticleCard key={article.id} article={article} currency={currency} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
