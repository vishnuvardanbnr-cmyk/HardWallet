import { useState, useMemo } from "react";
import { useWallet } from "@/lib/wallet-context";
import { formatUSD } from "@/lib/price-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, RefreshCw, CheckSquare, Square } from "lucide-react";

export default function ManageCrypto() {
  const { 
    topAssets, 
    enabledAssetIds, 
    isLoadingAssets, 
    toggleAssetEnabled, 
    refreshTopAssets,
    enableAllAssets,
    disableAllAssets,
  } = useWallet();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return topAssets;
    const query = searchQuery.toLowerCase();
    return topAssets.filter(
      (asset) =>
        asset.name.toLowerCase().includes(query) ||
        asset.symbol.toLowerCase().includes(query)
    );
  }, [topAssets, searchQuery]);

  const enabledCount = enabledAssetIds.size;
  const totalCount = topAssets.length;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Manage Crypto
          </h1>
          <p className="text-muted-foreground">
            Choose which cryptocurrencies to display on your dashboard. Enable or disable assets to customize your view.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Top Cryptocurrencies</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {enabledCount}/{totalCount} enabled
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={enableAllAssets}
                  data-testid="button-enable-all"
                >
                  <CheckSquare className="mr-1 h-4 w-4" />
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disableAllAssets}
                  data-testid="button-disable-all"
                >
                  <Square className="mr-1 h-4 w-4" />
                  Disable All
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={refreshTopAssets}
                  disabled={isLoadingAssets}
                  data-testid="button-refresh-assets"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingAssets ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-assets"
              />
            </div>

            {isLoadingAssets && topAssets.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No assets found matching "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map((asset) => {
                  const isEnabled = enabledAssetIds.has(asset.id);
                  const priceChange = asset.priceChangePercentage24h || 0;
                  const isPositive = priceChange >= 0;

                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-md border p-3 hover-elevate"
                      data-testid={`asset-row-${asset.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {asset.image ? (
                          <img
                            src={asset.image}
                            alt={asset.name}
                            className="h-8 w-8 rounded-full"
                            data-testid={`img-asset-${asset.id}`}
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {asset.symbol.slice(0, 2)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium" data-testid={`text-asset-name-${asset.id}`}>
                            {asset.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {asset.symbol}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="font-medium" data-testid={`text-asset-price-${asset.id}`}>
                            {formatUSD(asset.currentPrice)}
                          </span>
                          <span
                            className={`flex items-center text-sm ${
                              isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            }`}
                            data-testid={`text-asset-change-${asset.id}`}
                          >
                            {isPositive ? (
                              <TrendingUp className="mr-1 h-3 w-3" />
                            ) : (
                              <TrendingDown className="mr-1 h-3 w-3" />
                            )}
                            {isPositive ? "+" : ""}
                            {priceChange.toFixed(2)}%
                          </span>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => toggleAssetEnabled(asset.id, checked)}
                          data-testid={`switch-asset-${asset.id}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
