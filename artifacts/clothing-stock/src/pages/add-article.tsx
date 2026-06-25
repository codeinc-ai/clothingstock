import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useCreateArticle,
  useGetSettings,
  getListArticlesQueryKey,
  getGetDashboardStatsQueryKey,
  getListLowStockArticlesQueryKey,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { ArrowLeft, Image as ImageIcon, Upload, AlertTriangle, X } from "lucide-react";
import { Link } from "wouter";

const FABRIC_TYPES = [
  "Cotton", "Polyester", "Cotton Blend", "Linen", "Denim",
  "Leather", "Wool", "Silk", "Rayon or Viscose", "Nylon",
  "Fleece", "Spandex or Elastane", "Jersey", "Velvet",
  "Chinese or Imported Fabric", "Other",
];

const SIZES = ["S", "M", "L", "XL", "XXL"] as const;

const DEFAULT_SIZES = SIZES.map((size) => ({
  size,
  isAvailable: false,
  quantity: 0,
}));

interface SizeRow {
  size: typeof SIZES[number];
  isAvailable: boolean;
  quantity: number;
}

export default function AddArticle() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createArticle = useCreateArticle();
  const { data: settings } = useGetSettings();
  const currency = settings?.currency ?? "PKR";

  const { uploadFile, isUploading, progress } = useUpload();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [fabricType, setFabricType] = useState("");
  const [customFabricName, setCustomFabricName] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sizes, setSizes] = useState<SizeRow[]>(DEFAULT_SIZES.map((s) => ({ ...s })));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cost = parseFloat(costPrice) || 0;
  const sale = parseFloat(salePrice) || 0;
  const priceMismatch = sale > 0 && cost > 0 && sale < cost;
  const activeSizes = sizes.filter((s) => s.isAvailable);
  const totalPieces = activeSizes.reduce((acc, s) => acc + s.quantity, 0);
  const totalCost = activeSizes.reduce((acc, s) => acc + s.quantity * cost, 0);
  const totalRevenue = activeSizes.reduce((acc, s) => acc + s.quantity * sale, 0);
  const totalProfit = totalRevenue - totalCost;
  const profitPerPiece = totalPieces > 0 ? totalProfit / totalPieces : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  function updateSize(index: number, field: keyof SizeRow, value: any) {
    setSizes((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (field === "isAvailable" && !value) return { ...s, isAvailable: false, quantity: 0 };
        return { ...s, [field]: value };
      })
    );
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG, and WEBP images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    const result = await uploadFile(file);
    if (result) {
      setImageUrl(result.objectPath);
      toast.success("Image uploaded");
    } else {
      setImagePreview(null);
      toast.error("Image upload failed");
    }
  }

  function removeImage() {
    setImageUrl(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Article name is required");
      return;
    }
    if (!fabricType) {
      toast.error("Please select a fabric type");
      return;
    }
    if (!activeSizes.length) {
      toast.error("Select at least one size");
      return;
    }

    createArticle.mutate(
      {
        data: {
          name: name.trim(),
          sku: sku.trim() || null,
          imageUrl,
          costPrice: cost,
          salePrice: sale,
          fabricType,
          customFabricName: fabricType === "Other" ? customFabricName.trim() || null : null,
          notes: notes.trim() || null,
          sizes: sizes.map((s) => ({
            size: s.size,
            isAvailable: s.isAvailable,
            quantity: s.isAvailable ? s.quantity : 0,
          })),
        },
      },
      {
        onSuccess: (article: any) => {
          toast.success("Article created successfully");
          queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLowStockArticlesQueryKey() });
          setLocation(`/articles/${article.id}`);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Failed to create article";
          toast.error(msg);
        },
      }
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/all-stock">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Article</h1>
          <p className="text-muted-foreground mt-1">Add a new clothing article to your inventory.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Article Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="e.g., Classic White Shirt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU <span className="text-muted-foreground text-xs">(auto-generated if empty)</span></Label>
                  <Input
                    id="sku"
                    placeholder="e.g., ART-001234"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fabric">Fabric Type <span className="text-destructive">*</span></Label>
                  <Select value={fabricType} onValueChange={setFabricType} required>
                    <SelectTrigger id="fabric">
                      <SelectValue placeholder="Select fabric" />
                    </SelectTrigger>
                    <SelectContent>
                      {FABRIC_TYPES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {fabricType === "Other" && (
                <div className="space-y-2">
                  <Label htmlFor="customFabric">Custom Fabric Name</Label>
                  <Input
                    id="customFabric"
                    placeholder="e.g., Bamboo Cotton"
                    value={customFabricName}
                    onChange={(e) => setCustomFabricName(e.target.value)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost Price ({currency})</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale">Sale Price ({currency})</Label>
                  <Input
                    id="sale"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                  />
                </div>
              </div>

              {priceMismatch && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-2 rounded-md">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Sale price is lower than cost price.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sizes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sizes & Quantities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sizes.map((s, i) => (
                  <div key={s.size} className="flex items-center gap-4">
                    <div className="flex items-center gap-3 w-28">
                      <Switch
                        checked={s.isAvailable}
                        onCheckedChange={(v) => updateSize(i, "isAvailable", v)}
                        id={`size-${s.size}`}
                      />
                      <Label htmlFor={`size-${s.size}`} className="font-medium text-sm cursor-pointer">
                        {s.size}
                      </Label>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={s.quantity}
                      disabled={!s.isAvailable}
                      onChange={(e) => updateSize(i, "quantity", parseInt(e.target.value) || 0)}
                      className="w-28"
                    />
                    {s.isAvailable && (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(s.quantity * cost, currency)} cost
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!activeSizes.length && (
                <p className="text-xs text-destructive mt-3">At least one size must be selected.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Article Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-colors"
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <div className="relative aspect-square">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(); }}
                      className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-background"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white text-sm gap-2">
                        <Upload className="h-6 w-6 animate-bounce" />
                        Uploading... {progress}%
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <ImageIcon className="h-10 w-10 opacity-30" />
                    <p className="text-xs text-center px-4">
                      Click to upload<br />JPG, PNG, WEBP — max 5MB
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </CardContent>
          </Card>

          {/* Calc */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Pieces</span>
                <span className="font-medium">{totalPieces}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Stock Cost</span>
                <span className="font-medium">{formatCurrency(totalCost, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potential Revenue</span>
                <span className="font-medium">{formatCurrency(totalRevenue, currency)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-muted-foreground">Gross Profit</span>
                <span className={`font-semibold ${totalProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(totalProfit, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per Piece</span>
                <span className="font-medium">{formatCurrency(profitPerPiece, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margin</span>
                <Badge variant={profitMargin >= 20 ? "default" : profitMargin >= 0 ? "secondary" : "destructive"}>
                  {profitMargin.toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={createArticle.isPending || isUploading || !activeSizes.length}
          >
            {createArticle.isPending ? "Saving..." : "Save Article"}
          </Button>
        </div>
      </form>
    </div>
  );
}
