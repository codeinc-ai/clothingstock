import { useState } from "react";
import { Link } from "wouter";
import {
  useListArticles,
  useDeleteArticle,
  useGetSettings,
  getListArticlesQueryKey,
  getGetDashboardStatsQueryKey,
  getListLowStockArticlesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArticleCard } from "@/components/article-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Package } from "lucide-react";
import { toast } from "sonner";

const FABRIC_TYPES = [
  "Cotton", "Polyester", "Cotton Blend", "Linen", "Denim",
  "Leather", "Wool", "Silk", "Rayon or Viscose", "Nylon",
  "Fleece", "Spandex or Elastane", "Jersey", "Velvet",
  "Chinese or Imported Fabric", "Other",
];

const SIZES = ["S", "M", "L", "XL", "XXL"];

export default function AllStock() {
  const [search, setSearch] = useState("");
  const [fabric, setFabric] = useState("all");
  const [size, setSize] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const queryClient = useQueryClient();
  const deleteMutation = useDeleteArticle();

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (fabric !== "all") params.fabric = fabric;
  if (size !== "all") params.size = size;
  if (status !== "all") params.status = status;
  if (sort) params.sort = sort;

  const { data: articles, isLoading } = useListArticles(
    Object.keys(params).length > 0 ? params : undefined
  );
  const { data: settings } = useGetSettings();
  const currency = settings?.currency ?? "PKR";

  function handleDelete(id: number) {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Article deleted");
          queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLowStockArticlesQueryKey() });
        },
        onError: () => toast.error("Failed to delete article"),
      }
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Stock</h1>
          <p className="text-muted-foreground mt-1">Browse and manage your entire inventory.</p>
        </div>
        <Link href="/add-article">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Article
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or SKU..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={fabric} onValueChange={setFabric}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Fabric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Fabrics</SelectItem>
            {FABRIC_TYPES.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={size} onValueChange={setSize}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="alphabetical">Alphabetical</SelectItem>
            <SelectItem value="lowest_stock">Lowest Stock</SelectItem>
            <SelectItem value="highest_stock">Highest Stock</SelectItem>
            <SelectItem value="cost_price_asc">Cost Price (Low–High)</SelectItem>
            <SelectItem value="cost_price_desc">Cost Price (High–Low)</SelectItem>
            <SelectItem value="sale_price_asc">Sale Price (Low–High)</SelectItem>
            <SelectItem value="sale_price_desc">Sale Price (High–Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-1">No articles found</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {search || fabric !== "all" || size !== "all" || status !== "all"
              ? "Try adjusting your filters."
              : "Add your first article to get started."}
          </p>
          {!search && fabric === "all" && size === "all" && status === "all" && (
            <Link href="/add-article">
              <Button>Add Your First Article</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{articles.length} article{articles.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {articles.map((article: any) => (
              <ArticleCard
                key={article.id}
                article={article}
                currency={currency}
                onDelete={() => handleDelete(article.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
