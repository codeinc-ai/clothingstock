import { useState, useEffect } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Settings as SettingsIcon } from "lucide-react";

const CURRENCIES = [
  { code: "PKR", name: "Pakistani Rupee (PKR)" },
  { code: "USD", name: "US Dollar (USD)" },
  { code: "EUR", name: "Euro (EUR)" },
  { code: "GBP", name: "British Pound (GBP)" },
  { code: "AED", name: "UAE Dirham (AED)" },
  { code: "SAR", name: "Saudi Riyal (SAR)" },
  { code: "CAD", name: "Canadian Dollar (CAD)" },
  { code: "AUD", name: "Australian Dollar (AUD)" },
  { code: "INR", name: "Indian Rupee (INR)" },
  { code: "TRY", name: "Turkish Lira (TRY)" },
  { code: "CNY", name: "Chinese Yuan (CNY)" },
];

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();

  const [brandName, setBrandName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [lowStockThreshold, setLowStockThreshold] = useState("3");

  useEffect(() => {
    if (settings) {
      setBrandName(settings.brandName ?? "");
      setCurrency(settings.currency ?? "PKR");
      setLowStockThreshold(String(settings.lowStockThreshold ?? 3));
    }
  }, [settings]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const threshold = parseInt(lowStockThreshold, 10);
    if (isNaN(threshold) || threshold < 1) {
      toast.error("Low stock threshold must be at least 1");
      return;
    }
    updateSettings.mutate(
      {
        data: {
          brandName: brandName.trim() || undefined,
          currency,
          lowStockThreshold: threshold,
        },
      },
      {
        onSuccess: () => {
          toast.success("Settings saved");
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        },
        onError: () => toast.error("Failed to save settings"),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your inventory preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            These settings apply across your entire inventory dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                placeholder="My Clothing Brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown in the sidebar and page headings.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for displaying all prices across the app.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                step="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Articles with total quantity at or below this value are flagged as low stock.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
