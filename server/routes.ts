import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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

const COINCAP_IDS: Record<string, string> = {
  ETH: "ethereum",
  BNB: "binance-coin",
  MATIC: "polygon",
  AVAX: "avalanche",
  ARB: "arbitrum",
  BTC: "bitcoin",
  SOL: "solana",
  XRP: "xrp",
  DOGE: "dogecoin",
  ADA: "cardano",
  TRX: "tron",
  DOT: "polkadot",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
};

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/prices", async (req, res) => {
    try {
      let prices = await fetchFromCoinGecko();
      if (!prices) {
        prices = await fetchFromCoinCap();
      }
      if (!prices) {
        prices = { ...FALLBACK_PRICES };
      }
      res.json(prices);
    } catch (error) {
      console.error("Price fetch error:", error);
      res.json({ ...FALLBACK_PRICES });
    }
  });

  app.get("/api/top-assets", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (!response.ok) {
        return res.json({ assets: [], fallback: true });
      }
      
      const data = await response.json();
      const assets = data.map((coin: any) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image || "",
        currentPrice: coin.current_price || 0,
        marketCap: coin.market_cap || 0,
        marketCapRank: coin.market_cap_rank || 0,
        priceChangePercentage24h: coin.price_change_percentage_24h || 0,
      }));
      
      res.json({ assets, fallback: false });
    } catch (error) {
      console.error("Top assets fetch error:", error);
      res.json({ assets: [], fallback: true });
    }
  });

  app.get("/api/balance/:chain/:address", async (req, res) => {
    const { chain, address } = req.params;
    try {
      let balance = "0";
      
      switch (chain.toUpperCase()) {
        case 'BTC':
          balance = await getBitcoinBalance(address);
          break;
        case 'SOL':
          balance = await getSolanaBalance(address);
          break;
        case 'XRP':
          balance = await getXrpBalance(address);
          break;
        case 'DOGE':
          balance = await getDogecoinBalance(address);
          break;
        case 'ADA':
          balance = await getCardanoBalance(address);
          break;
        case 'TRX':
          balance = await getTronBalance(address);
          break;
        case 'DOT':
          balance = await getPolkadotBalance(address);
          break;
        case 'LTC':
          balance = await getLitecoinBalance(address);
          break;
        case 'BCH':
          balance = await getBitcoinCashBalance(address);
          break;
        case 'ATOM':
          balance = await getCosmosBalance(address);
          break;
        case 'OSMO':
          balance = await getOsmosisBalance(address);
          break;
        default:
          balance = "0";
      }
      
      res.json({ balance });
    } catch (error) {
      console.error(`Balance fetch error for ${chain}:`, error);
      res.json({ balance: "0" });
    }
  });

  app.get("/api/gas-estimate/:chainId", async (req, res) => {
    const { chainId } = req.params;
    try {
      res.json({ gasPrice: "20000000000", gasLimit: "21000" });
    } catch (error) {
      res.json({ gasPrice: "20000000000", gasLimit: "21000" });
    }
  });

  return httpServer;
}

async function fetchFromCoinGecko(): Promise<Record<string, number> | null> {
  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const prices: Record<string, number> = {};
    
    for (const [symbol, coinId] of Object.entries(COINGECKO_IDS)) {
      if (data[coinId]?.usd) {
        prices[symbol] = data[coinId].usd;
      }
    }
    
    return Object.keys(prices).length > 0 ? prices : null;
  } catch (error) {
    console.error("CoinGecko server fetch error:", error);
    return null;
  }
}

async function fetchFromCoinCap(): Promise<Record<string, number> | null> {
  try {
    const ids = Object.values(COINCAP_IDS).join(",");
    const response = await fetch(
      `https://api.coincap.io/v2/assets?ids=${ids}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const prices: Record<string, number> = {};
    
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
    console.error("CoinCap server fetch error:", error);
    return null;
  }
}

async function getBitcoinBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://blockchain.info/q/addressbalance/${address}?confirmations=1`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const satoshis = await response.text();
    const btc = parseInt(satoshis) / 100000000;
    return btc.toString();
  } catch {
    return "0";
  }
}

async function getSolanaBalance(address: string): Promise<string> {
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.result?.value) {
      const sol = data.result.value / 1000000000;
      return sol.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getXrpBalance(address: string): Promise<string> {
  try {
    const response = await fetch('https://s1.ripple.com:51234', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'account_info',
        params: [{ account: address, ledger_index: 'validated' }]
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.result?.account_data?.Balance) {
      const xrp = parseInt(data.result.account_data.Balance) / 1000000;
      return xrp.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getDogecoinBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://dogechain.info/api/v1/address/balance/${address}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.balance) {
      return data.balance.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getCardanoBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/addresses/${address}`, {
      headers: { 'project_id': 'mainnetpublic' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.amount) {
      const lovelace = data.amount.find((a: any) => a.unit === 'lovelace');
      if (lovelace) {
        const ada = parseInt(lovelace.quantity) / 1000000;
        return ada.toString();
      }
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getTronBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.data?.[0]?.balance) {
      const trx = data.data[0].balance / 1000000;
      return trx.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getPolkadotBalance(address: string): Promise<string> {
  try {
    const response = await fetch('https://polkadot.api.subscan.io/api/v2/scan/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: address }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.data?.account?.balance) {
      return data.data.account.balance.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getLitecoinBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://api.blockcypher.com/v1/ltc/main/addrs/${address}/balance`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.balance !== undefined) {
      const ltc = data.balance / 100000000;
      return ltc.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getBitcoinCashBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://api.blockcypher.com/v1/bch/main/addrs/${address}/balance`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    if (data.balance !== undefined) {
      const bch = data.balance / 100000000;
      return bch.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getCosmosBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://rest.cosmos.directory/cosmoshub/cosmos/bank/v1beta1/balances/${address}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    const uatom = data.balances?.find((b: any) => b.denom === 'uatom');
    if (uatom) {
      const atom = parseInt(uatom.amount) / 1000000;
      return atom.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getOsmosisBalance(address: string): Promise<string> {
  try {
    const response = await fetch(`https://rest.cosmos.directory/osmosis/cosmos/bank/v1beta1/balances/${address}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return "0";
    const data = await response.json();
    const uosmo = data.balances?.find((b: any) => b.denom === 'uosmo');
    if (uosmo) {
      const osmo = parseInt(uosmo.amount) / 1000000;
      return osmo.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}
