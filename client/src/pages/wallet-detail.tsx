import { useState, useEffect } from "react";
import { useParams, Link, useSearch } from "wouter";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Plus,
  Grid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { ChainIcon } from "@/components/chain-icon";
import { fetchPrices, formatUSD, calculateUSDValue, type PriceData } from "@/lib/price-service";

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

const COINGECKO_ID_BY_SYMBOL: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'BNB': 'binancecoin',
  'SOL': 'solana',
  'USDC': 'usd-coin',
  'XRP': 'ripple',
  'DOGE': 'dogecoin',
  'ADA': 'cardano',
  'TRX': 'tron',
  'AVAX': 'avalanche-2',
  'SHIB': 'shiba-inu',
  'LINK': 'chainlink',
  'DOT': 'polkadot',
  'BCH': 'bitcoin-cash',
  'MATIC': 'matic-network',
  'LTC': 'litecoin',
  'ATOM': 'cosmos',
};

const TOKEN_PARENT_CHAIN: Record<string, string> = {
  'tether': 'Ethereum',
  'usd-coin': 'Ethereum',
  'staked-ether': 'Ethereum',
  'chainlink': 'Ethereum',
  'wrapped-bitcoin': 'Ethereum',
  'uniswap': 'Ethereum',
  'shiba-inu': 'Ethereum',
};

const TOKENS_BY_CHAIN_SYMBOL: Record<string, string[]> = {
  'BTC': ['bitcoin'],
  'ETH': ['ethereum', 'tether', 'usd-coin', 'staked-ether', 'chainlink', 'wrapped-bitcoin', 'uniswap', 'shiba-inu'],
  'BNB': ['binancecoin', 'tether', 'usd-coin'],
  'SOL': ['solana'],
  'XRP': ['ripple'],
  'DOGE': ['dogecoin'],
  'ADA': ['cardano'],
  'TRX': ['tron', 'tether', 'usd-coin'],
  'AVAX': ['avalanche-2'],
  'DOT': ['polkadot'],
  'BCH': ['bitcoin-cash'],
  'MATIC': ['matic-network', 'tether', 'usd-coin'],
  'LTC': ['litecoin'],
  'ATOM': ['cosmos'],
  'ARB': ['ethereum'],
  'OSMO': ['osmosis'],
};

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  if (num === 0) return "0";
  return num.toFixed(4);
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface TokenRowProps {
  assetId: string;
  symbol: string;
  name: string;
  image?: string;
  price: number;
  priceChange24h: number;
  balance: string;
  usdValue: number;
  chainSymbol: string;
}

function TokenRow({ assetId, symbol, name, image, price, priceChange24h, balance, usdValue, chainSymbol }: TokenRowProps) {
  const isPositive = priceChange24h >= 0;
  
  return (
    <div className="flex items-center justify-between py-3 px-2 hover:bg-muted/30 transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        {image ? (
          <img 
            src={image} 
            alt={name}
            className="h-10 w-10 rounded-full bg-muted"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <ChainIcon symbol={symbol} size="md" />
        )}
        <div>
          <p className="font-medium text-foreground">{name}</p>
          <p className="text-sm text-muted-foreground">
            {formatUSD(price)}{' '}
            <span className={isPositive ? "text-green-500" : "text-red-500"}>
              {isPositive ? "+" : ""}{priceChange24h.toFixed(2)}%
            </span>
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-foreground">{formatBalance(balance)}</p>
        <p className="text-sm text-muted-foreground">{formatUSD(usdValue)}</p>
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
  
  const { chains, visibleWallets, topAssets, enabledAssetIds, refreshBalances } = useWallet();
  const { toast } = useToast();
  const [prices, setPrices] = useState<PriceData>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("assets");

  const chain = chains.find(c => c.id === chainId);
  const wallet = visibleWallets.find(w => w.chainId === chainId);
  
  const walletLabel = wallet?.label || `${chain?.symbol || 'Wallet'}-HD`;

  useEffect(() => {
    fetchPrices().then(setPrices);
    const interval = setInterval(() => {
      fetchPrices().then(setPrices);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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
        fetchPrices().then(setPrices)
      ]);
      toast({ title: "Refreshed", description: "Balance updated" });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!chain || !wallet) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Wallet Not Found</h1>
        </div>
        <div className="text-center text-muted-foreground py-8">
          <p>This wallet could not be found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const chainTokenIds = TOKENS_BY_CHAIN_SYMBOL[chain.symbol] || [COINGECKO_ID_BY_SYMBOL[chain.symbol]];
  
  const chainTokens = chainTokenIds
    .map(tokenId => {
      const assetInfo = ASSET_INFO[tokenId];
      const topAsset = topAssets.find(a => a.id === tokenId);
      if (!assetInfo) return null;
      
      const isNativeToken = tokenId === COINGECKO_ID_BY_SYMBOL[chain.symbol];
      const balance = isNativeToken ? wallet.balance : "0";
      const price = prices[assetInfo.symbol] || topAsset?.currentPrice || 0;
      const usdValue = parseFloat(balance || "0") * price;
      const priceChange = topAsset?.priceChangePercentage24h || 0;
      
      return {
        id: tokenId,
        symbol: assetInfo.symbol,
        name: assetInfo.name,
        image: assetInfo.image,
        price,
        priceChange24h: priceChange,
        balance,
        usdValue,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      symbol: string;
      name: string;
      image?: string;
      price: number;
      priceChange24h: number;
      balance: string;
      usdValue: number;
    }>;

  const filteredTokens = chainTokens.filter(token => 
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUsdValue = chainTokens.reduce((sum, token) => sum + token.usdValue, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCcw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mx-4 rounded-2xl bg-blue-600 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{walletLabel}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/10"
              onClick={copyAddress}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">
            {showBalance ? formatUSD(totalUsdValue) : "****"}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 mb-6">
        <Link href={`/transfer?type=send&chain=${chainId}`}>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-xs text-foreground">Send</span>
          </div>
        </Link>
        <Link href={`/transfer?type=receive&chain=${chainId}`}>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <ArrowDownLeft className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-xs text-foreground">Receive</span>
          </div>
        </Link>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer opacity-50">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <RefreshCcw className="h-5 w-5 text-foreground" />
          </div>
          <span className="text-xs text-foreground">Swap</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer opacity-50">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Grid className="h-5 w-5 text-foreground" />
          </div>
          <span className="text-xs text-foreground">More</span>
        </div>
      </div>

      <div className="px-4 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between">
            <TabsList className="bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="assets" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground px-0 mr-6 pb-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                Assets
              </TabsTrigger>
              <TabsTrigger 
                value="nft" 
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground text-muted-foreground px-0 pb-2 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
              >
                NFT
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Search className="h-4 w-4" />
              </Button>
              <Link href="/manage-crypto">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Tabs>
      </div>

      <div className="px-2">
        {activeTab === "assets" && (
          <div className="divide-y divide-border">
            {filteredTokens.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>No tokens found</p>
              </div>
            ) : (
              filteredTokens.map(token => (
                <TokenRow
                  key={token.id}
                  assetId={token.id}
                  symbol={token.symbol}
                  name={token.name}
                  image={token.image}
                  price={token.price}
                  priceChange24h={token.priceChange24h}
                  balance={token.balance}
                  usdValue={token.usdValue}
                  chainSymbol={chain.symbol}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === "nft" && (
          <div className="py-12 text-center text-muted-foreground">
            <p>No NFTs found</p>
            <p className="text-sm mt-1">NFTs for this wallet will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
