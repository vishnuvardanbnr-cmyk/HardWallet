import { useState, useEffect } from "react";
import { useParams, Link, useSearch } from "wouter";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { ChainIcon } from "@/components/chain-icon";
import { fetchPrices, formatUSD, calculateUSDValue, type PriceData } from "@/lib/price-service";
import type { Transaction } from "@shared/schema";

const ASSET_INFO: Record<string, { name: string; symbol: string; image?: string }> = {
  'bitcoin': { name: 'Bitcoin', symbol: 'BTC', image: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  'ethereum': { name: 'Ethereum', symbol: 'ETH', image: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  'tether': { name: 'Tether', symbol: 'USDT', image: 'https://assets.coingecko.com/coins/images/325/small/Tether.png' },
  'binancecoin': { name: 'BNB', symbol: 'BNB', image: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  'solana': { name: 'Solana', symbol: 'SOL', image: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  'usd-coin': { name: 'USD Coin', symbol: 'USDC', image: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
  'ripple': { name: 'XRP', symbol: 'XRP', image: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png' },
  'staked-ether': { name: 'Lido Staked Ether', symbol: 'stETH', image: 'https://assets.coingecko.com/coins/images/13442/small/steth_logo.png' },
  'dogecoin': { name: 'Dogecoin', symbol: 'DOGE', image: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png' },
  'cardano': { name: 'Cardano', symbol: 'ADA', image: 'https://assets.coingecko.com/coins/images/975/small/cardano.png' },
  'tron': { name: 'TRON', symbol: 'TRX', image: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png' },
  'avalanche-2': { name: 'Avalanche', symbol: 'AVAX', image: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png' },
  'shiba-inu': { name: 'Shiba Inu', symbol: 'SHIB', image: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png' },
  'chainlink': { name: 'Chainlink', symbol: 'LINK', image: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png' },
  'wrapped-bitcoin': { name: 'Wrapped Bitcoin', symbol: 'WBTC', image: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png' },
  'polkadot': { name: 'Polkadot', symbol: 'DOT', image: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png' },
  'bitcoin-cash': { name: 'Bitcoin Cash', symbol: 'BCH', image: 'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png' },
  'matic-network': { name: 'Polygon', symbol: 'MATIC', image: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png' },
  'litecoin': { name: 'Litecoin', symbol: 'LTC', image: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png' },
  'uniswap': { name: 'Uniswap', symbol: 'UNI', image: 'https://assets.coingecko.com/coins/images/12504/small/uniswap.png' },
  'cosmos': { name: 'Cosmos Hub', symbol: 'ATOM', image: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png' },
  'osmosis': { name: 'Osmosis', symbol: 'OSMO', image: 'https://assets.coingecko.com/coins/images/16724/small/osmo.png' },
};

const TOKEN_PARENT_CHAIN: Record<string, string> = {
  'tether': 'Ethereum',
  'usd-coin': 'Ethereum',
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

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0.00";
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toFixed(4);
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function TransactionRow({ transaction, onViewExplorer }: { transaction: Transaction; onViewExplorer?: (hash: string) => void }) {
  const isSend = transaction.type === "send";
  
  return (
    <div 
      className="flex items-center justify-between py-3 border-b border-border last:border-0"
      data-testid={`transaction-row-${transaction.id}`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
          isSend ? "bg-orange-500/10 text-orange-500" : "bg-green-500/10 text-green-500"
        }`}>
          {isSend ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium">{isSend ? "Sent" : "Received"}</p>
          <p className="text-xs text-muted-foreground">
            {truncateAddress(isSend ? transaction.toAddress : transaction.fromAddress)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={`font-medium ${isSend ? "text-orange-500" : "text-green-500"}`}>
            {isSend ? "-" : "+"}{formatBalance(transaction.amount)} {transaction.tokenSymbol}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.timestamp).toLocaleDateString()}
          </p>
        </div>
        {transaction.txHash && onViewExplorer && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onViewExplorer(transaction.txHash!)}
            data-testid={`button-view-tx-${transaction.id}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function WalletDetail() {
  const params = useParams<{ chainId: string }>();
  const chainId = params.chainId;
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const assetId = searchParams.get('asset');
  
  const { chains, visibleWallets, transactions, refreshBalances, refreshTransactions, isLoadingTransactions } = useWallet();
  const { toast } = useToast();
  const [prices, setPrices] = useState<PriceData>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const chain = chains.find(c => c.id === chainId);
  const wallet = visibleWallets.find(w => w.chainId === chainId);
  
  const assetInfo = assetId ? ASSET_INFO[assetId] : null;
  const displayName = assetInfo?.name || chain?.name || '';
  const displaySymbol = assetInfo?.symbol || chain?.symbol || '';
  const displayImage = assetInfo?.image;
  
  const walletTransactions = transactions.filter(tx => tx.chainId === chainId);

  useEffect(() => {
    fetchPrices().then(setPrices);
  }, []);

  useEffect(() => {
    if (wallet) {
      refreshTransactions();
    }
  }, [wallet?.address]);

  const copyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshBalances(),
        refreshTransactions(),
        fetchPrices().then(setPrices)
      ]);
      toast({ title: "Refreshed", description: "Balance and transactions updated" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const openExplorer = (txHash: string) => {
    if (chain?.blockExplorer) {
      window.open(`${chain.blockExplorer}/tx/${txHash}`, "_blank");
    }
  };

  if (!chain || !wallet) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Wallet Not Found</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>This wallet could not be found.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usdValue = calculateUSDValue(wallet.balance, chain.symbol, prices);

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild data-testid="button-back">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={displayName} 
              className="h-12 w-12 rounded-full bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="lg" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">
              {displaySymbol}
              {assetId && TOKEN_PARENT_CHAIN[assetId] && <span className="ml-1 opacity-70">on {TOKEN_PARENT_CHAIN[assetId]}</span>}
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Balance</p>
              <p className="text-3xl font-bold" data-testid="text-wallet-balance">
                {formatBalance(wallet.balance)} <span className="text-lg font-normal text-muted-foreground">{displaySymbol}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatUSD(usdValue)} USD
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <code className="text-sm font-mono text-muted-foreground" data-testid="text-wallet-address">
              {wallet.address}
            </code>
            <div className="flex gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={copyAddress}
                data-testid="button-copy-address"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {chain.blockExplorer && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(`${chain.blockExplorer}/address/${wallet.address}`, "_blank")}
                  data-testid="button-view-explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="default" className="flex-1" asChild>
              <Link href={`/transfer?type=send&chain=${chainId}`}>
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                Send
              </Link>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href={`/transfer?type=receive&chain=${chainId}`}>
                <ArrowDownLeft className="mr-1.5 h-4 w-4" />
                Receive
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-lg">Transaction History</CardTitle>
          {isLoadingTransactions && (
            <Badge variant="secondary" className="text-xs">Loading...</Badge>
          )}
        </CardHeader>
        <CardContent>
          {walletTransactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No transactions yet</p>
              <p className="text-sm mt-1">Transactions for this wallet will appear here</p>
            </div>
          ) : (
            <div>
              {walletTransactions.map((tx) => (
                <TransactionRow 
                  key={tx.id} 
                  transaction={tx} 
                  onViewExplorer={chain.blockExplorer ? openExplorer : undefined}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
