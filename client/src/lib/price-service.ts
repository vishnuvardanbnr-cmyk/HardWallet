import { CryptoAsset, FALLBACK_TOP_ASSETS } from "@shared/schema";

const FALLBACK_PRICES: Record<string, number> = {
  ETH: 3500,
  BNB: 600,
  MATIC: 0.85,
  AVAX: 35,
  ARB: 1.2,
  BTC: 100000,
  SOL: 180,
  XRP: 2.2,
  DOGE: 0.35,
  ADA: 0.95,
  TRX: 0.25,
  DOT: 7.5,
  LTC: 105,
  BCH: 450,
};

export interface PriceData {
  [symbol: string]: number;
}

let cachedPrices: PriceData = {};
let lastFetchTime = 0;
const CACHE_DURATION = 5000;

export async function fetchPrices(): Promise<PriceData> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION && Object.keys(cachedPrices).length > 0) {
    return cachedPrices;
  }

  try {
    const response = await fetch('/api/prices', {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.warn("Server price request failed:", response.status);
      return Object.keys(cachedPrices).length > 0 ? cachedPrices : { ...FALLBACK_PRICES };
    }
    
    const prices = await response.json();
    
    if (Object.keys(prices).length > 0) {
      cachedPrices = prices;
      lastFetchTime = now;
      return prices;
    }
  } catch (error) {
    console.warn("Price fetch error:", error);
  }
  
  return Object.keys(cachedPrices).length > 0 ? cachedPrices : { ...FALLBACK_PRICES };
}

export function formatUSD(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`;
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(2)}`;
  }
  if (amount > 0) {
    return `$${amount.toFixed(4)}`;
  }
  return "$0.00";
}

export function calculateUSDValue(balance: string, symbol: string, prices: PriceData): number {
  const numBalance = parseFloat(balance);
  if (isNaN(numBalance) || !prices[symbol]) {
    return 0;
  }
  return numBalance * prices[symbol];
}

export interface TopAsset extends CryptoAsset {
  currentPrice: number;
  priceChangePercentage24h: number;
  image: string;
}

let cachedTopAssets: TopAsset[] = [];
let lastTopAssetsFetchTime = 0;
const TOP_ASSETS_CACHE_DURATION = 5 * 60 * 1000;

export async function fetchTopAssets(limit: number = 20): Promise<TopAsset[]> {
  const now = Date.now();
  if (now - lastTopAssetsFetchTime < TOP_ASSETS_CACHE_DURATION && cachedTopAssets.length > 0) {
    return cachedTopAssets.slice(0, limit);
  }

  try {
    const response = await fetch(`/api/top-assets?limit=${limit}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.warn("Server top assets request failed:", response.status);
      return getFallbackTopAssets(limit);
    }

    const data = await response.json();
    
    if (data.fallback || !data.assets || data.assets.length === 0) {
      return getFallbackTopAssets(limit);
    }
    
    cachedTopAssets = data.assets;
    lastTopAssetsFetchTime = now;
    return data.assets;
  } catch (error) {
    console.warn("Top assets fetch error:", error);
    return getFallbackTopAssets(limit);
  }
}

function getFallbackTopAssets(limit: number): TopAsset[] {
  if (cachedTopAssets.length > 0) {
    return cachedTopAssets.slice(0, limit);
  }
  
  const fallbackPrices: Record<string, number> = {
    BTC: 100000,
    ETH: 3500,
    USDT: 1,
    BNB: 600,
    SOL: 180,
    USDC: 1,
    XRP: 2.2,
    STETH: 3500,
    DOGE: 0.35,
    ADA: 0.95,
    TRX: 0.25,
    AVAX: 35,
    SHIB: 0.000025,
    LINK: 22,
    WBTC: 100000,
    DOT: 7.5,
    BCH: 450,
    MATIC: 0.85,
    LTC: 105,
    UNI: 13,
  };

  return FALLBACK_TOP_ASSETS.slice(0, limit).map((asset) => ({
    ...asset,
    currentPrice: fallbackPrices[asset.symbol] || 0,
    priceChangePercentage24h: 0,
    image: "",
  }));
}
