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
  OP: 2.5,
  USDT: 1,
  USDC: 1,
};

const DEFILLAMA_IDS: Record<string, string> = {
  ETH: "coingecko:ethereum",
  BNB: "coingecko:binancecoin",
  MATIC: "coingecko:matic-network",
  AVAX: "coingecko:avalanche-2",
  ARB: "coingecko:arbitrum",
  BTC: "coingecko:bitcoin",
  SOL: "coingecko:solana",
  XRP: "coingecko:ripple",
  DOGE: "coingecko:dogecoin",
  ADA: "coingecko:cardano",
  TRX: "coingecko:tron",
  DOT: "coingecko:polkadot",
  LTC: "coingecko:litecoin",
  BCH: "coingecko:bitcoin-cash",
  OP: "coingecko:optimism",
  USDT: "coingecko:tether",
  USDC: "coingecko:usd-coin",
};

export interface PriceData {
  [symbol: string]: number;
}

let cachedPrices: PriceData = { ...FALLBACK_PRICES };
let lastFetchTime = 0;
const CACHE_DURATION = 30000;

async function fetchFromDefiLlama(): Promise<PriceData | null> {
  try {
    const coins = Object.values(DEFILLAMA_IDS).join(",");
    const response = await fetch(
      `https://coins.llama.fi/prices/current/${coins}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const prices: PriceData = {};

    for (const [symbol, coinId] of Object.entries(DEFILLAMA_IDS)) {
      const coinData = data.coins?.[coinId];
      if (coinData?.price) {
        prices[symbol] = coinData.price;
      }
    }

    return Object.keys(prices).length > 0 ? prices : null;
  } catch (error) {
    console.warn("DefiLlama fetch error:", error);
    return null;
  }
}

async function fetchFromCoinGecko(): Promise<PriceData | null> {
  try {
    const COINGECKO_IDS: Record<string, string> = {
      ETH: "ethereum",
      BNB: "binancecoin",
      MATIC: "matic-network",
      AVAX: "avalanche-2",
      ARB: "arbitrum",
      BTC: "bitcoin",
      SOL: "solana",
      XRP: "ripple",
      DOGE: "dogecoin",
      ADA: "cardano",
      TRX: "tron",
      DOT: "polkadot",
      LTC: "litecoin",
      BCH: "bitcoin-cash",
    };

    const ids = Object.values(COINGECKO_IDS).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) return null;

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

export async function fetchPrices(): Promise<PriceData> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_DURATION && Object.keys(cachedPrices).length > 0) {
    return cachedPrices;
  }

  let prices: PriceData = {};
  
  const defiLlamaPrices = await fetchFromDefiLlama();
  if (defiLlamaPrices) {
    prices = { ...prices, ...defiLlamaPrices };
  }
  
  if (Object.keys(prices).length < 5) {
    const geckoPrice = await fetchFromCoinGecko();
    if (geckoPrice) {
      prices = { ...prices, ...geckoPrice };
    }
  }

  if (Object.keys(prices).length > 0) {
    cachedPrices = { ...FALLBACK_PRICES, ...prices };
    lastFetchTime = now;
    return cachedPrices;
  }

  return cachedPrices;
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
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      return getFallbackTopAssets(limit);
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return getFallbackTopAssets(limit);
    }

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
