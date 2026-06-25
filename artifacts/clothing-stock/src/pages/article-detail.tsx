import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetArticle,
  useDeleteArticle,
  useGetSettings,
  getListArticlesQueryKey,
  getGetArticleQueryKey,
  getListLowStockArticlesQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StockAdjustmentModal } from "@/components/stock-adjustment-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  SlidersHorizontal,
  Image as ImageIcon,
  Package,
} from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  if (status === "in_stock") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">In Stock</Badge>;
  if (status === "low_stock") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none">Low Stock</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none">Out of Stock</Badge>;
}

export default function ArticleDetail() {
  const [, params] = useRoute("/articles/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id ?? "0");
  const queryClient = useQueryClient();

  const { data: article, isLoading } = useGetArticle(id, {
    query: { enabled: !!id && !isNaN(id), queryKey: getGetArticleQueryKey(id) },
  });
  const { data: settings } = useGetSettings();
  const deleteArticle = useDeleteArticle();
  const currency = settings?.currency ?? "PKR";

  const [adjustOpen, setAdjustOpen] = useState(false);

  function handleDelete() {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    deleteArticle.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Article deleted");
          queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLowStockArticlesQueryKey() });
          setLocation("/all-stock");
        },
        onError: () => toast.error("Failed to delete article"),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex flex-col items-center py-24 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
          <h3 className="text-lg font-medium">Article not found</h3>
          <Link href="/all-stock">
            <Button variant="link" className="mt-2">Back to All Stock</Button>
          </Link>
        </div>
      </div>
    );
  }

  const cost = typeof article.costPrice === "number" ? article.costPrice : parseFloat(String(article.costPrice));
  const sale = typeof article.salePrice === "number" ? article.salePrice : parseFloat(String(article.salePrice));

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/all-stock">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight truncate">{article.name}</h1>
            <StatusBadge status={(article as any).stockStatus} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">SKU: {article.sku}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setAdjustOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Adjust
          </Button>
          <Link href={`/articles/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteArticle.isPending}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Cost Price</div>
                  <div className="font-semibold">{formatCurrency(cost, currency)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Sale Price</div>
                  <div className="font-semibold">{formatCurrency(sale, currency)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Gross Profit</div>
                  <div className={`font-semibold ${sale - cost >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(sale - cost, currency)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Fabric</div>
                  <div className="font-medium">
                    {(article as any).fabricType === "Other" && (article as any).customFabricName
                      ? (article as any).customFabricName
                      : (article as any).fabricType}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Total Stock</div>
                  <div className="font-semibold">{(article as any).totalQuantity} pieces</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Added</div>
                  <div className="font-medium">{formatDate(article.createdAt as string)}</div>
                </div>
              </div>

              {(article as any).notes && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-muted-foreground text-xs mb-1">Notes</div>
                  <p className="text-sm">{(article as any).notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sizes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock by Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {(article as any).sizes?.map((s: any) => (
                  <div
                    key={s.size}
                    className={`flex flex-col items-center border rounded-lg p-3 min-w-[72px] ${
                      !s.isAvailable
                        ? "opacity-40 bg-muted"
                        : s.quantity === 0
                        ? "border-red-200 bg-red-50"
                        : s.quantity <= (settings?.lowStockThreshold ?? 3)
                        ? "border-amber-200 bg-amber-50"
                        : "bg-background"
                    }`}
                  >
                    <span className="font-bold text-lg">{s.size}</span>
                    <span className="text-2xl font-semibold">{s.quantity}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {!s.isAvailable ? "Disabled" : s.quantity === 0 ? "Out" : "pieces"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Adjustment History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adjustment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!(article as any).adjustments?.length ? (
                <p className="text-sm text-muted-foreground p-6">No adjustments recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>New Qty</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(article as any).adjustments.map((adj: any) => (
                      <TableRow key={adj.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(adj.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{adj.size}</Badge>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{adj.adjustmentType}</TableCell>
                        <TableCell>
                          <span className={adj.quantityChanged >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {adj.quantityChanged >= 0 ? "+" : ""}{adj.quantityChanged}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{adj.newQuantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{adj.reason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: image */}
        <div>
          <Card className="overflow-hidden">
            <div className="aspect-square bg-muted">
              {article.imageUrl ? (
                <img
                  src={`/api/storage${article.imageUrl}`}
                  alt={article.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <ImageIcon className="h-16 w-16 opacity-20" />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <StockAdjustmentModal
        articleId={id}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        sizes={(article as any).sizes?.filter((s: any) => s.isAvailable) ?? []}
      />
    </div>
  );
}
