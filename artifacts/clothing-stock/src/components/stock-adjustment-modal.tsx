import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAdjustStock, getGetArticleQueryKey, getListArticlesQueryKey, getListLowStockArticlesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import type { ArticleSizeStockSize, StockAdjustmentInputAdjustmentType } from "@workspace/api-client-react";

interface StockAdjustmentModalProps {
  articleId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sizes: { size: string; quantity: number }[];
}

export function StockAdjustmentModal({
  articleId,
  open,
  onOpenChange,
  sizes,
}: StockAdjustmentModalProps) {
  const queryClient = useQueryClient();
  const adjustStock = useAdjustStock();

  const [size, setSize] = useState<string>("");
  const [adjustmentType, setAdjustmentType] = useState<string>("add");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!size || !adjustmentType || !quantity) return;

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 0) {
      toast.error("Quantity must be a positive number");
      return;
    }

    const currentQty = sizes.find((s) => s.size === size)?.quantity || 0;
    if (adjustmentType === "remove" && qtyNum > currentQty) {
      toast.error(`Cannot remove ${qtyNum}. Only ${currentQty} in stock.`);
      return;
    }

    adjustStock.mutate(
      {
        id: articleId,
        data: {
          size: size as ArticleSizeStockSize,
          adjustmentType: adjustmentType as StockAdjustmentInputAdjustmentType,
          quantity: qtyNum,
          reason: reason || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Stock adjusted successfully");
          queryClient.invalidateQueries({ queryKey: getGetArticleQueryKey(articleId) });
          queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLowStockArticlesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          onOpenChange(false);
          setSize("");
          setAdjustmentType("add");
          setQuantity("");
          setReason("");
        },
        onError: () => {
          toast.error("Failed to adjust stock");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Add, remove, or replace inventory for a specific size.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={setSize} required>
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((s) => (
                  <SelectItem key={s.size} value={s.size}>
                    {s.size} (Current: {s.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={setAdjustmentType} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add Stock</SelectItem>
                <SelectItem value="remove">Remove Stock</SelectItem>
                <SelectItem value="replace">Set Exact Quantity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="0"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g., 5"
            />
          </div>

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New Stock">New Stock</SelectItem>
                <SelectItem value="Damaged">Damaged</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
                <SelectItem value="Correction">Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={adjustStock.isPending}>
              {adjustStock.isPending ? "Saving..." : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
