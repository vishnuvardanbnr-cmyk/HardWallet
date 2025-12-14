import { CryptoAsset, FALLBACK_TOP_ASSETS } from "@shared/schema";

const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  BNB: "binancecoin",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  ARB: "arbitrum",
  BTC: "bitcoin",
};

const COINCAP_IDS: Record<string, string> = {
  ETH: "ethereum",
  BNB: "binance-coin",
  MATIC: "polygon",
  AVAX: "avalanche",
  ARB: "arbitrum",
  BTC: "bitcoin",
};

const FALLBACK_PRICES: Record<string, number> = {
  ETH: 3500,
  BNB: 600,
  MATIC: 0.85,
  AVAX: 35,
  ARB: 1.2,
  BTC: 100000,
};

export interface PriceData {
  [symbol: string]: number;
}

let cachedPrices: PriceData = {};
let lastFetchTime = 0;
const CACHE_DURATION = 5000;

async function fetchFromCoinGecko(): Promise<PriceData | null> {
  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) {
      console.warn("CoinGecko request failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    
    const prices: PriceData = {};
    for (const [symbol, coinId] of Object.entries(COINGECKO_IDS)) {
      if (data[coinId]?.usd) {
        prices[symbol] = data[coinId].usd;
      }
    }
    
    return Object.keys(prices).length > 0 ? prices : null;
  } catch (error) {
    console.warn("CoinGecko fetch error:", error);
    return null;
  }
}

async function fetchFromCoinCap(): Promise<PriceData | null> {
  try {
    const ids = Object.values(COINCAP_IDS).join(",");
    const response = await fetch(
      `https://api.coincap.io/v2/assets?ids=${ids}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) {
      console.warn("CoinCap request failed:", response.status);
      return null;
    }
    
    const data = await response.json();
    
    const prices: PriceData = {};
    if (data.data && Array.isArray(data.data)) {
      for (const asset of data.data) {
        for (const [symbol, coinCapId] of Object.entries(COINCAP_IDS)) {
          if (asset.id === coinCapId && asset.priceUsd) {
            prices[symbol] = parseFloat(asset.priceUsd);
          }
        }
      }
    }
    
    return Object.keys(prices).length > 0 ? prices : null;
  } catch (error) {
    console.warn("CoinCap fetch error:", error);
    return null;
  }
}

export async function fetchPrices(): Promise<PriceData> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION && Object.keys(cachedPrices).length > 0) {
    return cachedPrices;
  }

  let prices = await fetchFromCoinGecko();
  
  if (!prices) {
    console.log("Falling back to CoinCap...");
    prices = await fetchFromCoinCap();
  }
  
  if (!prices) {
    console.log("Using fallback static prices");
    if (Object.keys(cachedPrices).length > 0) {
      return cachedPrices;
    }
    return { ...FALLBACK_PRICES };
  }
  
  cachedPrices = prices;
  lastFetchTime = now;
  return prices;
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

// Top assets functionality
export interface TopAsset extends CryptoAsset {
  currentPrice: number;
  priceChangePercentage24h: number;
  image: string;
}

let cachedTopAssets: TopAsset[] = [];
let lastTopAssetsFetchTime = 0;
const TOP_ASSETS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchTopAssets(limit: number = 20): Promise<TopAsset[]> {
  const now = Date.now();
  if (now - lastTopAssetsFetchTime < TOP_ASSETS_CACHE_DURATION && cachedTopAssets.length > 0) {
    return cachedTopAssets.slice(0, limit);
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      console.warn("CoinGecko markets request failed:", response.status);
      return getFallbackTopAssets(limit);
    }

    const data = await response.json();
    
    const assets: TopAsset[] = data.map((coin: any) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      image: coin.image || "",
      currentPrice: coin.current_price || 0,
      marketCap: coin.market_cap || 0,
      marketCapRank: coin.market_cap_rank || 0,
      priceChangePercentage24h: coin.price_change_percentage_24h || 0,
    }));

    cachedTopAssets = assets;
    lastTopAssetsFetchTime = now;
    return assets;
  } catch (error) {
    console.warn("CoinGecko markets fetch error:", error);
    return getFallbackTopAssets(limit);
  }
}

function getFallbackTopAssets(limit: number): TopAsset[] {
  // Return cached if available
  if (cachedTopAssets.length > 0) {
    return cachedTopAssets.slice(0, limit);
  }
  
  // Convert fallback list to TopAsset format with estimated prices
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
