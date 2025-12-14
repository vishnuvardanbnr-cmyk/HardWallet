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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getBitcoinBalance(address: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      `https://blockstream.info/api/address/${address}`,
      {},
      10000
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

async function getSolanaBalance(address: string): Promise<string> {
  const endpoints = [
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com',
    'https://api.mainnet-beta.solana.com',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address]
        }),
      }, 8000);

      if (!response.ok) continue;
      const data = await response.json();
      if (data.result?.value !== undefined) {
        const sol = data.result.value / 1000000000;
        return sol.toString();
      }
    } catch {
      continue;
    }
  }
  return "0";
}

async function getXrpBalance(address: string): Promise<string> {
  const endpoints = [
    'https://xrplcluster.com',
    'https://s1.ripple.com:51234',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'account_info',
          params: [{ account: address, ledger_index: 'validated' }]
        }),
      }, 8000);

      if (!response.ok) continue;
      const data = await response.json();
      if (data.result?.account_data?.Balance) {
        const xrp = parseInt(data.result.account_data.Balance) / 1000000;
        return xrp.toString();
      }
    } catch {
      continue;
    }
  }
  return "0";
}

async function getDogecoinBalance(address: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      `https://dogechain.info/api/v1/address/balance/${address}`,
      {},
      8000
    );
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
    const response = await fetchWithTimeout(
      `https://api.koios.rest/api/v1/address_info?_address=${address}`,
      { headers: { 'Accept': 'application/json' } },
      10000
    );
    if (!response.ok) return "0";
    const data = await response.json();
    if (Array.isArray(data) && data[0]?.balance) {
      const ada = parseInt(data[0].balance) / 1000000;
      return ada.toString();
    }
    return "0";
  } catch {
    return "0";
  }
}

async function getTronBalance(address: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      `https://api.trongrid.io/v1/accounts/${address}`,
      {},
      8000
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

async function getPolkadotBalance(address: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      'https://polkadot.api.subscan.io/api/v2/scan/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: address }),
      },
      8000
    );
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
    const response = await fetchWithTimeout(
      `https://api.blockcypher.com/v1/ltc/main/addrs/${address}/balance`,
      {},
      8000
    );
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
    const response = await fetchWithTimeout(
      `https://api.blockcypher.com/v1/bch/main/addrs/${address}/balance`,
      {},
      8000
    );
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
    const response = await fetchWithTimeout(
      `https://rest.cosmos.directory/cosmoshub/cosmos/bank/v1beta1/balances/${address}`,
      {},
      8000
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
    const response = await fetchWithTimeout(
      `https://rest.cosmos.directory/osmosis/cosmos/bank/v1beta1/balances/${address}`,
      {},
      8000
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
    case 'SOL':
      return await getSolanaBalance(address);
    case 'XRP':
      return await getXrpBalance(address);
    case 'DOGE':
      return await getDogecoinBalance(address);
    case 'ADA':
      return await getCardanoBalance(address);
    case 'TRX':
      return await getTronBalance(address);
    case 'DOT':
      return await getPolkadotBalance(address);
    case 'LTC':
      return await getLitecoinBalance(address);
    case 'BCH':
      return await getBitcoinCashBalance(address);
    case 'ATOM':
      return await getCosmosBalance(address);
    case 'OSMO':
      return await getOsmosisBalance(address);
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
