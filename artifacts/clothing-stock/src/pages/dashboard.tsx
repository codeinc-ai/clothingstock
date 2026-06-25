import { useGetDashboardStats, useGetRecentArticles, useGetStockBySize, useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, Package, TrendingUp, DollarSign, Tags, Boxes, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArticleCard } from "@/components/article-card";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentArticles, isLoading: recentLoading } = useGetRecentArticles();
  const { data: stockBySize, isLoading: sizeLoading } = useGetStockBySize();
  const { data: settings } = useGetSettings();

  const currency = settings?.currency || "PKR";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your inventory and stock levels.</p>
        </div>
        <Link href="/add-article">
          <Button>Add New Article</Button>
        </Link>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Articles</CardTitle>
              <Tags className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalArticles}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Pieces</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPieces}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventory Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalInventoryCost, currency)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Potential Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.potentialRevenue, currency)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Est. Profit: {formatCurrency(stats.potentialGrossProfit, currency)}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Articles</h2>
            <Link href="/all-stock">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {recentLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
            </div>
          ) : recentArticles?.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-6">
                <Package className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
                <h3 className="font-semibold text-lg">No articles yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Start building your inventory by adding your first article.</p>
                <Link href="/add-article">
                  <Button>Add Your First Article</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recentArticles?.map((article) => (
                <ArticleCard key={article.id} article={article} currency={currency} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className={(stats?.lowStockArticles || 0) > 0 || (stats?.outOfStockArticles || 0) > 0 ? "border-amber-200" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className={(stats?.lowStockArticles || 0) > 0 ? "text-amber-500" : "text-muted-foreground"} h-5 w-5 />
                Attention Needed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-100">
                <span className="font-medium text-sm">Low Stock Items</span>
                <span className="font-bold">{stats?.lowStockArticles || 0}</span>
              </div>
              <div className="flex items-center justify-between bg-red-50 text-red-900 p-3 rounded-lg border border-red-100">
                <span className="font-medium text-sm">Out of Stock</span>
                <span className="font-bold">{stats?.outOfStockArticles || 0}</span>
              </div>
              <Link href="/low-stock" className="block mt-2">
                <Button variant="outline" className="w-full">Review Low Stock</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Stock by Size</CardTitle>
            </CardHeader>
            <CardContent>
              {sizeLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : stockBySize ? (
                <div className="space-y-3">
                  {Object.entries(stockBySize).map(([size, count]) => (
                    <div key={size} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 font-medium text-sm text-center bg-secondary py-1 rounded">{size}</div>
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ 
                              width: `${Math.min(100, Math.max(2, (Number(count) / (stats?.totalPieces || 1)) * 100))}%` 
                            }} 
                          />
                        </div>
                        <div className="w-10 text-right text-sm text-muted-foreground">{String(count)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
