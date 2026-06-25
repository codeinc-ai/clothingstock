import { Link } from "wouter";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Edit2, SlidersHorizontal, Image as ImageIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { StockAdjustmentModal } from "./stock-adjustment-modal";

interface ArticleCardProps {
  article: any;
  currency: string;
  onDelete?: () => void;
}

export function ArticleCard({ article, currency, onDelete }: ArticleCardProps) {
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_stock":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">In Stock</Badge>;
      case "low_stock":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none">Low Stock</Badge>;
      case "out_of_stock":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none">Out of Stock</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Card className="overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {article.imageUrl ? (
            <img
              src={article.imageUrl}
              alt={article.name}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              <ImageIcon className="h-10 w-10 opacity-20" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            {getStatusBadge(article.stockStatus)}
          </div>
        </div>
        
        <CardContent className="p-4 flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-lg leading-tight line-clamp-1">{article.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{article.sku}</p>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm font-medium">
              {formatCurrency(article.salePrice, currency)}
            </div>
            <div className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {article.totalQuantity} in stock
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-1">
            {article.sizes?.map((size: any) => (
              <div 
                key={size.size} 
                className={`text-[10px] px-1.5 py-0.5 border rounded-sm ${
                  !size.isAvailable ? 'opacity-30 line-through bg-muted' : 
                  size.quantity === 0 ? 'border-red-200 text-red-600 bg-red-50' : 
                  'bg-background'
                }`}
                title={`${size.quantity} pieces`}
              >
                {size.size}: {size.quantity}
              </div>
            ))}
          </div>
        </CardContent>
        
        <CardFooter className="p-3 border-t bg-muted/20 gap-2">
          <Link href={`/articles/${article.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs h-8">View</Button>
          </Link>
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1 text-xs h-8"
            onClick={() => setIsAdjustModalOpen(true)}
          >
            Adjust
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardFooter>
      </Card>

      <StockAdjustmentModal
        articleId={article.id}
        open={isAdjustModalOpen}
        onOpenChange={setIsAdjustModalOpen}
        sizes={article.sizes?.filter((s: any) => s.isAvailable) || []}
      />
    </>
  );
}
