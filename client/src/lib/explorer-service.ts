import { ethers } from "ethers";

export interface ExplorerTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  blockNumber: string;
  gasUsed: string;
}

export interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

export interface ParsedTransaction {
  id: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  timestamp: string;
  type: "send" | "receive";
  status: "confirmed" | "failed";
  chainId: string;
  tokenSymbol: string;
  walletId: string;
  isTokenTransfer?: boolean;
  contractAddress?: string;
}

const DEFAULT_EXPLORER_APIS: Record<number, string> = {
  1: "https://api.etherscan.io/api",
  56: "https://api.bscscan.com/api",
  137: "https://api.polygonscan.com/api",
  43114: "https://api.snowtrace.io/api",
  42161: "https://api.arbiscan.io/api",
};

const CHAIN_SYMBOLS: Record<number, string> = {
  1: "ETH",
  56: "BNB",
  137: "MATIC",
  43114: "AVAX",
  42161: "ETH",
};

let fetchCache: Map<string, { data: ParsedTransaction[]; timestamp: number }> = new Map();
const CACHE_DURATION = 30000;

function deriveApiUrl(blockExplorerUrl: string | undefined, chainId: number): string | null {
  if (DEFAULT_EXPLORER_APIS[chainId]) {
    return DEFAULT_EXPLORER_APIS[chainId];
  }
  
  if (!blockExplorerUrl) {
    return null;
  }
  
  try {
    const url = new URL(blockExplorerUrl);
    const apiUrl = `https://api.${url.hostname}/api`;
    return apiUrl;
  } catch {
    return null;
  }
}

export async function fetchTransactionHistory(
  address: string,
  chainId: number,
  walletId: string,
  walletChainId: string,
  chainSymbol: string,
  blockExplorerUrl?: string
): Promise<ParsedTransaction[]> {
  const cacheKey = `native-${address}-${chainId}`;
  const cached = fetchCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const apiUrl = deriveApiUrl(blockExplorerUrl, chainId);
  if (!apiUrl) {
    return [];
  }

  try {
    const url = `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Explorer API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status !== "1" || !Array.isArray(data.result)) {
      return [];
    }

    const transactions: ExplorerTransaction[] = data.result;
    const lowerAddress = address.toLowerCase();
    const symbol = CHAIN_SYMBOLS[chainId] || chainSymbol || "ETH";

    const parsed: ParsedTransaction[] = transactions.map((tx) => {
      const isReceive = tx.to.toLowerCase() === lowerAddress;
      const valueInEth = ethers.formatEther(tx.value || "0");
      
      return {
        id: `explorer-${tx.hash}`,
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: valueInEth,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        type: isReceive ? "receive" : "send",
        status: tx.isError === "0" ? "confirmed" : "failed",
        chainId: walletChainId,
        tokenSymbol: symbol,
        walletId: walletId,
        isTokenTransfer: false,
      };
    });

    fetchCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
    return parsed;
  } catch (error) {
    console.error(`Failed to fetch transactions for chain ${chainId}:`, error);
    return [];
  }
}

export async function fetchTokenTransfers(
  address: string,
  chainId: number,
  walletId: string,
  walletChainId: string,
  blockExplorerUrl?: string
): Promise<ParsedTransaction[]> {
  const cacheKey = `tokens-${address}-${chainId}`;
  const cached = fetchCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const apiUrl = deriveApiUrl(blockExplorerUrl, chainId);
  if (!apiUrl) {
    return [];
  }

  try {
    const url = `${apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Explorer API error for tokens: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data.status !== "1" || !Array.isArray(data.result)) {
      return [];
    }

    const transfers: TokenTransfer[] = data.result;
    const lowerAddress = address.toLowerCase();

    const parsed: ParsedTransaction[] = transfers.map((tx) => {
      const isReceive = tx.to.toLowerCase() === lowerAddress;
      const decimals = parseInt(tx.tokenDecimal) || 18;
      const amount = ethers.formatUnits(tx.value || "0", decimals);
      
      return {
        id: `token-${tx.hash}-${tx.contractAddress}`,
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: amount,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        type: isReceive ? "receive" : "send",
        status: "confirmed",
        chainId: walletChainId,
        tokenSymbol: tx.tokenSymbol || "TOKEN",
        walletId: walletId,
        isTokenTransfer: true,
        contractAddress: tx.contractAddress,
      };
    });

    fetchCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
    return parsed;
  } catch (error) {
    console.error(`Failed to fetch token transfers for chain ${chainId}:`, error);
    return [];
  }
}

export async function fetchAllTransactions(
  wallets: Array<{ 
    id: string; 
    address: string; 
    chainId: string; 
    numericChainId: number;
    chainSymbol: string;
    blockExplorerUrl?: string;
  }>
): Promise<ParsedTransaction[]> {
  const allTransactions: ParsedTransaction[] = [];
  
  const results = await Promise.all(
    wallets.flatMap((wallet) => {
      if (wallet.numericChainId === 0) return [Promise.resolve([])];
      return [
        fetchTransactionHistory(
          wallet.address, 
          wallet.numericChainId, 
          wallet.id, 
          wallet.chainId,
          wallet.chainSymbol,
          wallet.blockExplorerUrl
        ),
        fetchTokenTransfers(
          wallet.address,
          wallet.numericChainId,
          wallet.id,
          wallet.chainId,
          wallet.blockExplorerUrl
        ),
      ];
    })
  );
  
  for (const txs of results) {
    allTransactions.push(...txs);
  }
  
  const uniqueTxs = new Map<string, ParsedTransaction>();
  for (const tx of allTransactions) {
    uniqueTxs.set(tx.id, tx);
  }
  
  const sortedTxs = Array.from(uniqueTxs.values()).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return sortedTxs;
}

export function clearExplorerCache() {
  fetchCache.clear();
}
