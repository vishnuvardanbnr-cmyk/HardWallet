import { ethers } from "ethers";

const DEFAULT_RPC_ENDPOINTS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  42161: "https://arb1.arbitrum.io/rpc",
};

// Chain symbol to decimals mapping for non-EVM chains
const NON_EVM_DECIMALS: Record<string, number> = {
  BTC: 8,
  SOL: 9,
  XRP: 6,
  DOGE: 8,
  ADA: 6,
  TRX: 6,
  DOT: 10,
  LTC: 8,
  BCH: 8,
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export interface BroadcastResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface TokenBalance {
  balance: string;
  balanceFormatted: string;
  symbol: string;
  decimals: number;
}

export async function getProvider(chainId: number, customRpcUrl?: string): Promise<ethers.JsonRpcProvider | null> {
  const rpcUrl = customRpcUrl || DEFAULT_RPC_ENDPOINTS[chainId];
  if (!rpcUrl) {
    return null;
  }
  return new ethers.JsonRpcProvider(rpcUrl, chainId);
}

export async function getProviderByRpcUrl(rpcUrl: string, chainId: number): Promise<ethers.JsonRpcProvider | null> {
  if (!rpcUrl) {
    return null;
  }
  return new ethers.JsonRpcProvider(rpcUrl, chainId);
}

export async function broadcastTransaction(
  signedTx: string,
  chainId: number
): Promise<BroadcastResult> {
  try {
    const provider = await getProvider(chainId);
    if (!provider) {
      return { success: false, error: `No RPC endpoint for chain ${chainId}` };
    }

    const txResponse = await provider.broadcastTransaction(signedTx);
    return { success: true, txHash: txResponse.hash };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to broadcast transaction" };
  }
}

export async function getBalance(address: string, chainId: number): Promise<string> {
  try {
    const provider = await getProvider(chainId);
    if (!provider) return "0";
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch {
    return "0";
  }
}

export async function getGasPrice(chainId: number): Promise<bigint | null> {
  try {
    const provider = await getProvider(chainId);
    if (!provider) return null;
    const feeData = await provider.getFeeData();
    return feeData.gasPrice;
  } catch {
    return null;
  }
}

export async function getNonce(address: string, chainId: number): Promise<number | null> {
  try {
    const provider = await getProvider(chainId);
    if (!provider) return null;
    return await provider.getTransactionCount(address);
  } catch {
    return null;
  }
}

export async function estimateGas(
  tx: ethers.TransactionRequest,
  chainId: number
): Promise<bigint | null> {
  try {
    const provider = await getProvider(chainId);
    if (!provider) return null;
    return await provider.estimateGas(tx);
  } catch {
    return null;
  }
}

export async function getTokenBalance(
  address: string,
  contractAddress: string,
  rpcUrl: string,
  chainId: number
): Promise<TokenBalance | null> {
  try {
    const provider = await getProviderByRpcUrl(rpcUrl, chainId);
    if (!provider) return null;
    
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    
    const [balance, decimals, symbol] = await Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
      contract.symbol(),
    ]);
    
    const balanceFormatted = ethers.formatUnits(balance, decimals);
    
    return {
      balance: balance.toString(),
      balanceFormatted,
      symbol,
      decimals: Number(decimals),
    };
  } catch (error) {
    console.error("Failed to get token balance:", error);
    return null;
  }
}

export async function getTokenInfo(
  contractAddress: string,
  rpcUrl: string,
  chainId: number
): Promise<{ name: string; symbol: string; decimals: number } | null> {
  try {
    const provider = await getProviderByRpcUrl(rpcUrl, chainId);
    if (!provider) return null;
    
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider);
    
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
    ]);
    
    return {
      name,
      symbol,
      decimals: Number(decimals),
    };
  } catch (error) {
    console.error("Failed to get token info:", error);
    return null;
  }
}

export async function broadcastTransactionWithRpc(
  signedTx: string,
  rpcUrl: string,
  chainId: number
): Promise<BroadcastResult> {
  try {
    const provider = await getProviderByRpcUrl(rpcUrl, chainId);
    if (!provider) {
      return { success: false, error: "No RPC endpoint available" };
    }

    const txResponse = await provider.broadcastTransaction(signedTx);
    return { success: true, txHash: txResponse.hash };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to broadcast transaction" };
  }
}

// Multi-chain balance fetching for non-EVM chains via server proxy
export async function getNonEvmBalance(address: string, chainSymbol: string): Promise<string> {
  try {
    const response = await fetch(`/api/balance/${chainSymbol}/${address}`, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) return "0";
    
    const data = await response.json();
    return data.balance || "0";
  } catch (error) {
    console.error(`Failed to get ${chainSymbol} balance:`, error);
    return "0";
  }
}

// Universal balance getter that works for both EVM and non-EVM chains
export async function getUniversalBalance(address: string, chainId: number, chainSymbol: string): Promise<string> {
  if (chainId > 0) {
    return await getBalance(address, chainId);
  } else {
    return await getNonEvmBalance(address, chainSymbol);
  }
}
