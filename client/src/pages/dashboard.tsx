import { useState, useEffect } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  ExternalLink,
  RefreshCw,
  Settings,
  Wallet,
  Search,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { ChainIcon } from "@/components/chain-icon";
import { HardwareStatusCard, WalletModeSelector } from "@/components/hardware-status";
import { fetchPrices, formatUSD, calculateUSDValue, type PriceData } from "@/lib/price-service";
import type { Chain, Wallet as WalletType } from "@shared/schema";
import type { TopAsset } from "@/lib/price-service";
import { Link, useLocation } from "wouter";
import { getTokenBalanceForAsset, isTokenAsset, getCustomTokenBalance } from "@/lib/blockchain";
import { clientStorage, type CustomToken } from "@/lib/client-storage";

function formatBalance(balance: string, decimals: number = 18): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0.00";
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toFixed(decimals > 8 ? 4 : 2);
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const COINGECKO_ID_TO_CHAIN_SYMBOL: Record<string, string> = {
  // Native chain coins - EVM
  'ethereum': 'ETH',
  'matic-network': 'MATIC',
  'binancecoin': 'BNB',
  'avalanche-2': 'AVAX',
  'arbitrum': 'ARB',
  // Native chain coins - Non-EVM
  'bitcoin': 'BTC',
  'solana': 'SOL',
  'ripple': 'XRP',
  'dogecoin': 'DOGE',
  'cardano': 'ADA',
  'tron': 'TRX',
  'polkadot': 'DOT',
  'litecoin': 'LTC',
  'bitcoin-cash': 'BCH',
  // Cosmos ecosystem
  'cosmos': 'ATOM',
  'osmosis': 'OSMO',
  // ERC-20 tokens on Ethereum
  'tether': 'ETH',
  'tether-bsc': 'BNB',
  'tether-tron': 'TRX',
  'usd-coin': 'ETH',
  'usd-coin-bsc': 'BNB',
  'usd-coin-tron': 'TRX',
  'staked-ether': 'ETH',
  'chainlink': 'ETH',
  'wrapped-bitcoin': 'ETH',
  'uniswap': 'ETH',
  'shiba-inu': 'ETH',
  'aave': 'ETH',
  'maker': 'ETH',
  'the-graph': 'ETH',
  'compound-governance-token': 'ETH',
  'yearn-finance': 'ETH',
  'sushi': 'ETH',
  'curve-dao-token': 'ETH',
  '1inch': 'ETH',
  'ens': 'ETH',
  'lido-dao': 'ETH',
  'rocket-pool': 'ETH',
  'frax': 'ETH',
  'dai': 'ETH',
  'gemini-dollar': 'ETH',
  'paxos-standard': 'ETH',
  'true-usd': 'ETH',
  // BNB Chain tokens
  'pancakeswap-token': 'BNB',
  'venus': 'BNB',
  'baby-doge-coin': 'BNB',
  'safemoon-2': 'BNB',
  'bakerytoken': 'BNB',
  'trust-wallet-token': 'BNB',
  'alpaca-finance': 'BNB',
  'biswap': 'BNB',
  // Polygon tokens
  'quickswap': 'MATIC',
  'aavegotchi': 'MATIC',
  'polycat-finance': 'MATIC',
  // Solana tokens
  'raydium': 'SOL',
  'serum': 'SOL',
  'marinade': 'SOL',
  'orca': 'SOL',
  'step-finance': 'SOL',
  'saber': 'SOL',
  'mango-markets': 'SOL',
  'star-atlas': 'SOL',
  'audius': 'SOL',
  'render-token': 'SOL',
  'helium': 'SOL',
  'bonk': 'SOL',
  'jupiter-exchange-solana': 'SOL',
  'jito-governance-token': 'SOL',
  // Avalanche tokens
  'trader-joe': 'AVAX',
  'benqi': 'AVAX',
  'pangolin': 'AVAX',
  'platypus-finance': 'AVAX',
  // Arbitrum tokens
  'gmx': 'ARB',
  'magic': 'ARB',
  'dopex': 'ARB',
  'radiant-capital': 'ARB',
  'camelot-token': 'ARB',
  // Optimism tokens
  'velodrome-finance': 'OP',
  'synthetix-network-token': 'OP',
  'optimism': 'OP',
  // TRON tokens
  'just': 'TRX',
  'sun-token': 'TRX',
  'bittorrent': 'TRX',
  // Cardano tokens
  'minswap': 'ADA',
  'sundaeswap': 'ADA',
  'jpg-store': 'ADA',
};

const TOKEN_PARENT_CHAIN: Record<string, string> = {
  'tether': 'Ethereum',
  'tether-bsc': 'BNB Chain',
  'tether-tron': 'TRON',
  'usd-coin': 'Ethereum',
  'usd-coin-bsc': 'BNB Chain',
  'usd-coin-tron': 'TRON',
  'staked-ether': 'Ethereum',
  'chainlink': 'Ethereum',
  'wrapped-bitcoin': 'Ethereum',
  'uniswap': 'Ethereum',
  'shiba-inu': 'Ethereum',
  'aave': 'Ethereum',
  'maker': 'Ethereum',
  'the-graph': 'Ethereum',
  'compound-governance-token': 'Ethereum',
  'yearn-finance': 'Ethereum',
  'sushi': 'Ethereum',
  'curve-dao-token': 'Ethereum',
  '1inch': 'Ethereum',
  'ens': 'Ethereum',
  'lido-dao': 'Ethereum',
  'rocket-pool': 'Ethereum',
  'frax': 'Ethereum',
  'dai': 'Ethereum',
  'gemini-dollar': 'Ethereum',
  'paxos-standard': 'Ethereum',
  'true-usd': 'Ethereum',
  'pancakeswap-token': 'BNB Chain',
  'venus': 'BNB Chain',
  'baby-doge-coin': 'BNB Chain',
  'safemoon-2': 'BNB Chain',
  'bakerytoken': 'BNB Chain',
  'trust-wallet-token': 'BNB Chain',
  'alpaca-finance': 'BNB Chain',
  'biswap': 'BNB Chain',
  'quickswap': 'Polygon',
  'aavegotchi': 'Polygon',
  'polycat-finance': 'Polygon',
  'raydium': 'Solana',
  'serum': 'Solana',
  'marinade': 'Solana',
  'orca': 'Solana',
  'step-finance': 'Solana',
  'saber': 'Solana',
  'mango-markets': 'Solana',
  'star-atlas': 'Solana',
  'audius': 'Solana',
  'render-token': 'Solana',
  'helium': 'Solana',
  'bonk': 'Solana',
  'jupiter-exchange-solana': 'Solana',
  'jito-governance-token': 'Solana',
  'trader-joe': 'Avalanche',
  'benqi': 'Avalanche',
  'pangolin': 'Avalanche',
  'platypus-finance': 'Avalanche',
  'gmx': 'Arbitrum',
  'magic': 'Arbitrum',
  'dopex': 'Arbitrum',
  'radiant-capital': 'Arbitrum',
  'camelot-token': 'Arbitrum',
  'velodrome-finance': 'Optimism',
  'synthetix-network-token': 'Optimism',
  'optimism': 'Optimism',
  'just': 'TRON',
  'sun-token': 'TRON',
  'bittorrent': 'TRON',
  'minswap': 'Cardano',
  'sundaeswap': 'Cardano',
  'jpg-store': 'Cardano',
};

const JSDELIVR_CDN = 'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.16.1/128/color';
const COINGECKO_CDN = 'https://assets.coingecko.com/coins/images';

const CRYPTO_ICONS: Record<string, string> = {
  'bitcoin': `${JSDELIVR_CDN}/btc.png`,
  'ethereum': `${JSDELIVR_CDN}/eth.png`,
  'tether': `${JSDELIVR_CDN}/usdt.png`,
  'binancecoin': `${JSDELIVR_CDN}/bnb.png`,
  'solana': `${COINGECKO_CDN}/4128/small/solana.png`,
  'usd-coin': `${JSDELIVR_CDN}/usdc.png`,
  'ripple': `${JSDELIVR_CDN}/xrp.png`,
  'staked-ether': `${COINGECKO_CDN}/13442/small/steth_logo.png`,
  'dogecoin': `${JSDELIVR_CDN}/doge.png`,
  'cardano': `${JSDELIVR_CDN}/ada.png`,
  'tron': `${JSDELIVR_CDN}/trx.png`,
  'avalanche-2': `${COINGECKO_CDN}/12559/small/Avalanche_Circle_RedWhite_Trans.png`,
  'shiba-inu': `${COINGECKO_CDN}/11939/small/shiba.png`,
  'chainlink': `${COINGECKO_CDN}/877/small/chainlink-new-logo.png`,
  'wrapped-bitcoin': `${COINGECKO_CDN}/7598/small/wrapped_bitcoin_wbtc.png`,
  'polkadot': `${COINGECKO_CDN}/12171/small/polkadot.png`,
  'bitcoin-cash': `${JSDELIVR_CDN}/bch.png`,
  'matic-network': `${JSDELIVR_CDN}/matic.png`,
  'litecoin': `${JSDELIVR_CDN}/ltc.png`,
  'uniswap': `${COINGECKO_CDN}/12504/small/uniswap.png`,
  'cosmos': `${JSDELIVR_CDN}/atom.png`,
  'osmosis': `${COINGECKO_CDN}/16724/small/osmo.png`,
};

interface CombinedAssetCardProps {
  asset: TopAsset;
  wallet?: WalletType;
  chain?: Chain;
  prices: PriceData;
  tokenBalance?: string;
}

function CombinedAssetCard({ asset, wallet, chain, prices, tokenBalance }: CombinedAssetCardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const hasWallet = wallet && chain;
  
  const parentChain = TOKEN_PARENT_CHAIN[asset.id];
  const isToken = !!parentChain;
  const displaySymbol = isToken ? asset.symbol.toUpperCase() : chain?.symbol || asset.symbol.toUpperCase();
  
  const effectiveBalance = isToken && tokenBalance ? tokenBalance : (hasWallet ? wallet.balance : "0");
  const balance = parseFloat(effectiveBalance);
  const usdValue = balance * (asset.currentPrice || 0);

  const copyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
    }
  };

  const openExplorer = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (chain && wallet) {
      window.open(`${chain.blockExplorer}/address/${wallet.address}`, "_blank");
    }
  };

  const cardContent = (
    <Card className="hover-elevate cursor-pointer transition-all h-full" data-testid={`card-asset-${asset.id}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col h-full">
        {/* Mobile: Compact single-row layout */}
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {(asset.image || CRYPTO_ICONS[asset.id]) ? (
              <img
                src={asset.image || CRYPTO_ICONS[asset.id] || ''}
                alt={asset.name}
                className="h-8 w-8 rounded-full bg-muted shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : chain ? (
              <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="sm" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate text-sm">{asset.name}</h3>
                <span
                  className={`text-xs font-medium shrink-0 ${
                    asset.priceChangePercentage24h >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {asset.priceChangePercentage24h >= 0 ? "+" : ""}{asset.priceChangePercentage24h.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {asset.symbol.toUpperCase()}
                {parentChain && <span className="ml-1 opacity-70">on {parentChain}</span>}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            {hasWallet ? (
              <>
                <p className="font-semibold text-sm" data-testid={`text-value-${asset.id}`}>{formatUSD(usdValue)}</p>
                <p className="text-xs text-muted-foreground">{formatBalance(effectiveBalance)} {displaySymbol}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{formatUSD(asset.currentPrice)}</p>
            )}
          </div>
        </div>

        {/* Desktop: Full expanded layout */}
        <div className="hidden sm:block">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              {(asset.image || CRYPTO_ICONS[asset.id]) ? (
                <img
                  src={asset.image || CRYPTO_ICONS[asset.id] || ''}
                  alt={asset.name}
                  className="h-8 w-8 rounded-full bg-muted"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : chain ? (
                <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="md" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{asset.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {asset.symbol.toUpperCase()}
                  {parentChain && <span className="ml-1 opacity-70">on {parentChain}</span>}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge variant="secondary" className="text-xs">
                #{asset.marketCapRank}
              </Badge>
              <span
                className={`text-xs font-medium ${
                  asset.priceChangePercentage24h >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
                data-testid={`text-change-${asset.id}`}
              >
                {asset.priceChangePercentage24h >= 0 ? "+" : ""}
                {asset.priceChangePercentage24h.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="mt-4 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-sm font-medium">{formatUSD(asset.currentPrice)}</p>
            </div>
            
            {hasWallet ? (
              <>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-lg font-bold">
                    {formatBalance(effectiveBalance)} <span className="text-sm font-normal text-muted-foreground">{displaySymbol}</span>
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">Value</p>
                  <p className="text-base font-semibold text-foreground">
                    {formatUSD(usdValue)}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <p className="text-sm">No wallet</p>
              </div>
            )}
          </div>

          {hasWallet && (
            <>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 p-2">
                <code className="text-xs font-mono text-muted-foreground">
                  {truncateAddress(wallet.address)}
                </code>
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7"
                    onClick={copyAddress}
                    data-testid={`button-copy-${asset.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {chain.blockExplorer && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={openExplorer}
                      data-testid={`button-explorer-${asset.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/transfer?type=send&chain=${chain.id}`);
                  }}
                >
                  <ArrowUpRight className="mr-1.5 h-4 w-4" />
                  Send
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/transfer?type=receive&chain=${chain.id}`);
                  }}
                >
                  <ArrowDownLeft className="mr-1.5 h-4 w-4" />
                  Receive
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (hasWallet) {
    return (
      <Link href={`/wallet/${chain.id}?asset=${asset.id}`}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-12 w-48" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="h-4 w-24 mt-4" />
              <Skeleton className="h-6 w-32 mt-2" />
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isConnected, isUnlocked, chains, wallets, refreshBalances, topAssets, enabledAssetIds, isLoadingAssets, refreshTopAssets, createAdditionalWallet, createWalletWithNewSeed, walletMode, isLoading, selectedAccountIndex, setSelectedAccountIndex, availableAccounts, visibleWallets, customTokens, balanceCacheStatus } = useWallet();
  const { toast } = useToast();
  const [prices, setPrices] = useState<PriceData>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [showCreateWalletDialog, setShowCreateWalletDialog] = useState(false);
  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [walletCreationType, setWalletCreationType] = useState<"derive" | "new-seed">("derive");
  const [seedPinInput, setSeedPinInput] = useState("");
  const [showSeedRevealDialog, setShowSeedRevealDialog] = useState(false);
  const [newSeedPhrase, setNewSeedPhrase] = useState("");
  const [seedConfirmed, setSeedConfirmed] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [customTokenBalances, setCustomTokenBalances] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPrices().then(setPrices);
    const priceInterval = setInterval(() => {
      fetchPrices().then(setPrices);
    }, 5000);
    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    if (wallets.length === 0) return;
    
    const walletAddresses: Record<string, string> = {};
    wallets.forEach(w => {
      const chain = chains.find(c => c.id === w.chainId);
      if (chain) {
        walletAddresses[chain.symbol] = w.address;
      }
    });

    const fetchTokenBalances = async () => {
      const tokenAssetIds = topAssets
        .filter(a => enabledAssetIds.has(a.id) && isTokenAsset(a.id))
        .map(a => a.id);
      
      const balancePromises = tokenAssetIds.map(async (assetId) => {
        try {
          const balance = await getTokenBalanceForAsset(assetId, walletAddresses);
          return [assetId, balance] as [string, string];
        } catch {
          return [assetId, "0"] as [string, string];
        }
      });
      
      const results = await Promise.all(balancePromises);
      const newBalances: Record<string, string> = {};
      results.forEach(([id, bal]) => {
        newBalances[id] = bal;
      });
      setTokenBalances(newBalances);
    };

    fetchTokenBalances();
    const tokenBalanceInterval = setInterval(fetchTokenBalances, 30000);
    return () => clearInterval(tokenBalanceInterval);
  }, [wallets.length, topAssets.length, enabledAssetIds.size, chains]);

  useEffect(() => {
    if (wallets.length === 0 || customTokens.length === 0) return;
    
    const walletAddresses: Record<string, string> = {};
    wallets.forEach(w => {
      const chain = chains.find(c => c.id === w.chainId);
      if (chain) {
        walletAddresses[chain.symbol] = w.address;
      }
    });

    const fetchCustomTokenBalances = async () => {
      const balancePromises = customTokens.map(async (token) => {
        const walletAddress = walletAddresses[token.chainId];
        if (!walletAddress) return [token.id, "0"] as [string, string];
        
        try {
          const balance = await getCustomTokenBalance(
            walletAddress,
            token.contractAddress,
            token.chainType,
            token.evmChainId || 0,
            token.rpcUrl || "",
            token.decimals
          );
          return [token.id, balance] as [string, string];
        } catch {
          return [token.id, "0"] as [string, string];
        }
      });
      
      const results = await Promise.all(balancePromises);
      const newBalances: Record<string, string> = {};
      results.forEach(([id, bal]) => {
        newBalances[id] = bal;
      });
      setCustomTokenBalances(newBalances);
    };

    fetchCustomTokenBalances();
    const customTokenBalanceInterval = setInterval(fetchCustomTokenBalances, 30000);
    return () => clearInterval(customTokenBalanceInterval);
  }, [wallets.length, customTokens.length, chains]);

  useEffect(() => {
    if (wallets.length === 0) return;
    const balanceInterval = setInterval(() => {
      refreshBalances();
    }, 5000);
    return () => clearInterval(balanceInterval);
  }, [wallets.length, refreshBalances]);
  
  const displayChains = chains;
  const displayWallets = visibleWallets;

  const enabledAssets = topAssets.filter(asset => enabledAssetIds.has(asset.id));

  const getWalletForAsset = (asset: TopAsset): { wallet?: WalletType; chain?: Chain } => {
    const chainSymbol = COINGECKO_ID_TO_CHAIN_SYMBOL[asset.id];
    if (!chainSymbol) return {};
    
    const chain = displayChains.find(c => c.symbol === chainSymbol);
    if (!chain) return {};
    
    const wallet = displayWallets.find(w => w.chainId === chain.id);
    return { wallet, chain };
  };

  // Filter and sort enabled assets
  const filteredAssets = enabledAssets.filter(asset => {
    if (!assetSearch.trim()) return true;
    const searchLower = assetSearch.toLowerCase();
    return (
      asset.name.toLowerCase().includes(searchLower) ||
      asset.symbol.toLowerCase().includes(searchLower)
    );
  });

  // Sort enabled assets by USD value (highest first)
  const sortedEnabledAssets = [...filteredAssets].sort((a, b) => {
    const aData = getWalletForAsset(a);
    const bData = getWalletForAsset(b);
    
    // For token assets, use tokenBalances; for native coins, use wallet balance
    const aIsToken = isTokenAsset(a.id);
    const bIsToken = isTokenAsset(b.id);
    
    const aValue = aIsToken && tokenBalances[a.id]
      ? parseFloat(tokenBalances[a.id]) * (a.currentPrice || 0)
      : (aData.wallet && aData.chain 
        ? calculateUSDValue(aData.wallet.balance, aData.chain.symbol, prices) 
        : 0);
    const bValue = bIsToken && tokenBalances[b.id]
      ? parseFloat(tokenBalances[b.id]) * (b.currentPrice || 0)
      : (bData.wallet && bData.chain 
        ? calculateUSDValue(bData.wallet.balance, bData.chain.symbol, prices) 
        : 0);
    
    // Sort by USD value descending, then by market cap rank for assets with 0 value
    if (bValue !== aValue) {
      return bValue - aValue;
    }
    return (a.marketCapRank || 999) - (b.marketCapRank || 999);
  });

  // Calculate total value from native coin wallets
  const nativeUSDValue = displayWallets.reduce((sum, w) => {
    const chain = displayChains.find(c => c.id === w.chainId);
    if (!chain) return sum;
    return sum + calculateUSDValue(w.balance, chain.symbol, prices);
  }, 0);

  // Calculate total value from token balances
  const tokenUSDValue = Object.entries(tokenBalances).reduce((sum, [assetId, balance]) => {
    const asset = topAssets.find(a => a.id === assetId);
    if (!asset) return sum;
    return sum + (parseFloat(balance) * (asset.currentPrice || 0));
  }, 0);

  const totalUSDValue = nativeUSDValue + tokenUSDValue;

  const hasWallets = displayWallets.length > 0;
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshBalances(),
        refreshTopAssets(),
        fetchPrices().then(setPrices)
      ]);
      toast({ title: "Refreshed", description: "Balances and prices updated" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateWallet = async () => {
    try {
      if (walletCreationType === "derive") {
        await createAdditionalWallet(newWalletLabel || undefined);
        setShowCreateWalletDialog(false);
        setNewWalletLabel("");
        setWalletCreationType("derive");
        toast({ title: "Wallet Created", description: "New wallet has been created successfully" });
      } else {
        if (!seedPinInput || seedPinInput.length < 4) {
          toast({ title: "Error", description: "Please enter a PIN with at least 4 characters", variant: "destructive" });
          return;
        }
        const result = await createWalletWithNewSeed(newWalletLabel || undefined, seedPinInput);
        setNewSeedPhrase(result.seedPhrase);
        setShowCreateWalletDialog(false);
        setShowSeedRevealDialog(true);
        setNewWalletLabel("");
        setSeedPinInput("");
        setWalletCreationType("derive");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create new wallet", variant: "destructive" });
    }
  };
  
  if (!hasWallets) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="mb-4 md:mb-6 text-2xl md:text-3xl font-bold">Dashboard</h1>
        <HardwareStatusCard />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          {availableAccounts.length > 1 && (
            <Select
              value={selectedAccountIndex.toString()}
              onValueChange={(val) => setSelectedAccountIndex(parseInt(val, 10))}
            >
              <SelectTrigger className="w-40" data-testid="select-account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableAccounts.map(acc => (
                  <SelectItem key={acc.index} value={acc.index.toString()} data-testid={`select-account-option-${acc.index}`}>
                    {acc.label || `Account ${acc.index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <WalletModeSelector />
        </div>
      </div>

      <Card className="mb-4 md:mb-6">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-xs md:text-sm text-muted-foreground">
                {walletMode === "soft_wallet" ? "Soft Wallet" : "Hard Wallet"} Portfolio
              </p>
            </div>
            <div className="flex items-center gap-2">
              {balanceCacheStatus.isStale && balanceCacheStatus.lastUpdated && (
                <span className="text-xs text-muted-foreground">
                  Updated {clientStorage.getCacheAge(balanceCacheStatus.lastUpdated)}
                </span>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleRefresh}
                disabled={isRefreshing || balanceCacheStatus.isRefreshing}
                data-testid="button-refresh-portfolio"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing || balanceCacheStatus.isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <h2 className="text-2xl md:text-4xl font-bold" data-testid="text-portfolio-value">
              {formatUSD(totalUSDValue)}
            </h2>
            {balanceCacheStatus.isRefreshing && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Refreshing...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Your Assets</h2>
            <Dialog open={showCreateWalletDialog} onOpenChange={setShowCreateWalletDialog}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-create-wallet">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Wallet</DialogTitle>
                  <DialogDescription>
                    Create an additional wallet for your portfolio.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="wallet-label">Wallet Label (optional)</Label>
                    <Input
                      id="wallet-label"
                      placeholder="e.g., Savings, Trading, DeFi"
                      value={newWalletLabel}
                      onChange={(e) => setNewWalletLabel(e.target.value)}
                      className="mt-2"
                      data-testid="input-wallet-label"
                    />
                  </div>
                  
                  {walletMode === "soft_wallet" && (
                    <div className="space-y-3">
                      <Label>Wallet Type</Label>
                      <RadioGroup 
                        value={walletCreationType} 
                        onValueChange={(val) => setWalletCreationType(val as "derive" | "new-seed")}
                        className="space-y-2"
                      >
                        <div className="flex items-start gap-3 p-3 rounded-md border">
                          <RadioGroupItem value="derive" id="derive" className="mt-0.5" data-testid="radio-derive" />
                          <div className="flex-1">
                            <Label htmlFor="derive" className="font-medium cursor-pointer">Derive from existing seed</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Uses your main seed phrase with a new account index. Same recovery phrase backs up all derived wallets.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-md border">
                          <RadioGroupItem value="new-seed" id="new-seed" className="mt-0.5" data-testid="radio-new-seed" />
                          <div className="flex-1">
                            <Label htmlFor="new-seed" className="font-medium cursor-pointer">Generate new seed phrase</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Creates a completely independent wallet with its own seed phrase. Requires a separate PIN to unlock.
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                      
                      {walletCreationType === "new-seed" && (
                        <div className="pt-2">
                          <Label htmlFor="seed-pin">PIN for new seed (min 4 characters)</Label>
                          <Input
                            id="seed-pin"
                            type="password"
                            placeholder="Enter PIN to encrypt new seed"
                            value={seedPinInput}
                            onChange={(e) => setSeedPinInput(e.target.value)}
                            className="mt-2"
                            data-testid="input-seed-pin"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowCreateWalletDialog(false);
                    setWalletCreationType("derive");
                    setSeedPinInput("");
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateWallet} disabled={isLoading} data-testid="button-confirm-create-wallet">
                    {isLoading ? "Creating..." : "Create Wallet"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showSeedRevealDialog} onOpenChange={(open) => {
              if (!open && !seedConfirmed) return;
              setShowSeedRevealDialog(open);
              if (!open) {
                setNewSeedPhrase("");
                setSeedConfirmed(false);
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Your New Seed Phrase</DialogTitle>
                  <DialogDescription>
                    Write down these 12 words and store them securely. You will need them to recover this wallet.
                  </DialogDescription>
                </DialogHeader>
                <div className="p-4 bg-muted rounded-md font-mono text-sm break-words" data-testid="text-seed-phrase">
                  {newSeedPhrase}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Checkbox 
                    id="seed-confirmed" 
                    checked={seedConfirmed} 
                    onCheckedChange={(checked) => setSeedConfirmed(!!checked)} 
                    data-testid="checkbox-seed-confirmed"
                  />
                  <Label htmlFor="seed-confirmed" className="cursor-pointer">I have written down my seed phrase</Label>
                </div>
                <DialogFooter>
                  <Button disabled={!seedConfirmed} onClick={() => {
                    setShowSeedRevealDialog(false);
                    setNewSeedPhrase("");
                    setSeedConfirmed(false);
                    toast({ title: "Wallet Created", description: "New wallet with independent seed created" });
                  }} data-testid="button-seed-done">
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                className="pl-8 h-8 w-40 sm:w-48"
                data-testid="input-search-assets"
              />
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/manage-crypto">
                <Settings className="mr-1 h-4 w-4" />
                Manage
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/chains">
                View All
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {isLoadingAssets ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-20 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-24 mt-4" />
                  <Skeleton className="h-6 w-32 mt-2" />
                  <Skeleton className="h-10 w-full mt-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedEnabledAssets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Settings className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No assets enabled</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Enable assets to track in Manage Crypto
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/manage-crypto">Manage Crypto</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedEnabledAssets.map((asset) => {
              const { wallet, chain } = getWalletForAsset(asset);
              return (
                <CombinedAssetCard
                  key={asset.id}
                  asset={asset}
                  wallet={wallet}
                  chain={chain}
                  prices={prices}
                  tokenBalance={tokenBalances[asset.id]}
                />
              );
            })}
            {customTokens.map((token) => {
              const balance = customTokenBalances[token.id] || "0";
              const balanceNum = parseFloat(balance);
              return (
                <Card key={token.id} className="hover-elevate transition-all h-full" data-testid={`card-custom-token-${token.id}`}>
                  <CardContent className="p-3 sm:p-4 flex flex-col h-full">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold shrink-0">
                          {token.symbol.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate text-sm">{token.name}</h3>
                            <Badge variant="outline" className="text-xs shrink-0">Custom</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {token.symbol} on {token.chainId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{formatBalance(balance, 4)}</p>
                        <p className="text-xs text-muted-foreground">{token.symbol}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
