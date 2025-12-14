import { ethers } from "ethers";

const DEFAULT_RPC_ENDPOINTS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
};

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
  ATOM: 6,
  OSMO: 6,
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

async function getBitcoinBalance(address: string): Promise<string> {
  try {
    const response = await fetch(
      `https://blockstream.info/api/address/${address}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) return "0";
    const data = await response.json();
    const funded = data.chain_stats?.funded_txo_sum || 0;
    const spent = data.chain_stats?.spent_txo_sum || 0;
    const balance = (funded - spent) / 100000000;
    return balance.toString();
  } catch {
    return "0";
  }
}

async function getTronBalance(address: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.trongrid.io/v1/accounts/${address}`,
      { signal: AbortSignal.timeout(8000) }
    );
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

async function getCosmosBalance(address: string): Promise<string> {
  try {
    const response = await fetch(
      `https://rest.cosmos.directory/cosmoshub/cosmos/bank/v1beta1/balances/${address}`,
      { signal: AbortSignal.timeout(8000) }
    );
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
    const response = await fetch(
      `https://rest.cosmos.directory/osmosis/cosmos/bank/v1beta1/balances/${address}`,
      { signal: AbortSignal.timeout(8000) }
    );
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

export async function getNonEvmBalance(address: string, chainSymbol: string): Promise<string> {
  switch (chainSymbol.toUpperCase()) {
    case 'BTC':
      return await getBitcoinBalance(address);
    case 'TRX':
      return await getTronBalance(address);
    case 'ATOM':
      return await getCosmosBalance(address);
    case 'OSMO':
      return await getOsmosisBalance(address);
    case 'SOL':
    case 'XRP':
    case 'DOGE':
    case 'ADA':
    case 'DOT':
    case 'LTC':
    case 'BCH':
      return "0";
    default:
      return "0";
  }
}

export async function getUniversalBalance(address: string, chainId: number, chainSymbol: string): Promise<string> {
  if (chainId > 0) {
    return await getBalance(address, chainId);
  } else {
    return await getNonEvmBalance(address, chainSymbol);
  }
}
