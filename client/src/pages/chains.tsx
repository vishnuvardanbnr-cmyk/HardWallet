import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  ExternalLink, 
  Copy,
  Layers,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChainIcon } from "@/components/chain-icon";
import { HardwareStatusCard } from "@/components/hardware-status";
import type { Chain, Token, Wallet } from "@shared/schema";

function ChainCard({ chain, wallet }: { chain: Chain; wallet?: Wallet }) {
  const { toast } = useToast();

  const copyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
    }
  };

  return (
    <Card className="overflow-hidden" data-testid={`card-chain-${chain.symbol}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="lg" />
            <div>
              <h3 className="font-semibold">{chain.name}</h3>
              <p className="text-sm text-muted-foreground">{chain.symbol}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {chain.isDefault && (
              <Badge variant="secondary" className="text-xs">Default</Badge>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Chain ID</span>
            <span className="font-mono">{chain.chainId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Decimals</span>
            <span>{chain.decimals}</span>
          </div>
          {wallet && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Address</span>
              <div className="flex items-center gap-1">
                <code className="text-xs font-mono">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </code>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={copyAddress}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {chain.blockExplorer && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => window.open(chain.blockExplorer, "_blank")}
            data-testid={`button-explorer-${chain.symbol}`}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Block Explorer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AddChainDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    rpcUrl: "",
    chainId: "",
    blockExplorer: "",
    decimals: "18",
  });

  const addChainMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/chains", {
        ...data,
        chainId: parseInt(data.chainId),
        decimals: parseInt(data.decimals),
        iconColor: "#6B7280",
        isDefault: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chains"] });
      toast({
        title: "Network Added",
        description: `${formData.name} has been added successfully.`,
      });
      setOpen(false);
      setFormData({
        name: "",
        symbol: "",
        rpcUrl: "",
        chainId: "",
        blockExplorer: "",
        decimals: "18",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add network. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addChainMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-chain">
          <Plus className="mr-2 h-4 w-4" />
          Add Network
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Network</DialogTitle>
          <DialogDescription>
            Add a new blockchain network to your wallet
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Network Name</Label>
            <Input
              id="name"
              placeholder="Ethereum Mainnet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-chain-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Currency Symbol</Label>
              <Input
                id="symbol"
                placeholder="ETH"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                required
                data-testid="input-chain-symbol"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chainId">Chain ID</Label>
              <Input
                id="chainId"
                type="number"
                placeholder="1"
                value={formData.chainId}
                onChange={(e) => setFormData({ ...formData, chainId: e.target.value })}
                required
                data-testid="input-chain-id"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rpcUrl">RPC URL</Label>
            <Input
              id="rpcUrl"
              placeholder="https://mainnet.infura.io/v3/..."
              value={formData.rpcUrl}
              onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
              required
              data-testid="input-chain-rpc"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blockExplorer">Block Explorer URL (Optional)</Label>
            <Input
              id="blockExplorer"
              placeholder="https://etherscan.io"
              value={formData.blockExplorer}
              onChange={(e) => setFormData({ ...formData, blockExplorer: e.target.value })}
              data-testid="input-chain-explorer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="decimals">Decimals</Label>
            <Input
              id="decimals"
              type="number"
              placeholder="18"
              value={formData.decimals}
              onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
              required
              data-testid="input-chain-decimals"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addChainMutation.isPending} data-testid="button-submit-chain">
              {addChainMutation.isPending ? "Adding..." : "Add Network"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTokenDialog({ chains }: { chains: Chain[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    chainId: "",
    name: "",
    symbol: "",
    contractAddress: "",
    decimals: "18",
  });

  const addTokenMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/tokens", {
        ...data,
        decimals: parseInt(data.decimals),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({
        title: "Token Added",
        description: `${formData.name} has been added successfully.`,
      });
      setOpen(false);
      setFormData({
        chainId: "",
        name: "",
        symbol: "",
        contractAddress: "",
        decimals: "18",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add token. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTokenMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-add-token">
          <Plus className="mr-2 h-4 w-4" />
          Add Token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Token</DialogTitle>
          <DialogDescription>
            Add a custom ERC-20, BEP-20, or similar token
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tokenChain">Network</Label>
            <select
              id="tokenChain"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={formData.chainId}
              onChange={(e) => setFormData({ ...formData, chainId: e.target.value })}
              required
              data-testid="select-token-chain"
            >
              <option value="">Select network</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} ({chain.symbol})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractAddress">Contract Address</Label>
            <Input
              id="contractAddress"
              placeholder="0x..."
              value={formData.contractAddress}
              onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })}
              className="font-mono"
              required
              data-testid="input-token-contract"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tokenName">Token Name</Label>
              <Input
                id="tokenName"
                placeholder="Tether USD"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-token-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tokenSymbol">Symbol</Label>
              <Input
                id="tokenSymbol"
                placeholder="USDT"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                required
                data-testid="input-token-symbol"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tokenDecimals">Decimals</Label>
            <Input
              id="tokenDecimals"
              type="number"
              placeholder="18"
              value={formData.decimals}
              onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
              required
              data-testid="input-token-decimals"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addTokenMutation.isPending} data-testid="button-submit-token">
              {addTokenMutation.isPending ? "Adding..." : "Add Token"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TokenCard({ token, chain }: { token: Token; chain?: Chain }) {
  return (
    <Card data-testid={`card-token-${token.symbol}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: token.iconColor || "#6B7280" }}
            >
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{token.name}</h3>
              <p className="text-sm text-muted-foreground">{token.symbol}</p>
            </div>
          </div>
          {chain && (
            <Badge variant="outline" className="text-xs">
              {chain.name}
            </Badge>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contract</span>
            <code className="text-xs font-mono">
              {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
            </code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Decimals</span>
            <span>{token.decimals}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Chains() {
  const { wallets, isUnlocked, chains, tokens } = useWallet();
  const hasWallet = wallets.length > 0;
  const [activeTab, setActiveTab] = useState("chains");

  const chainsLoading = false;
  const tokensLoading = false;

  if (!hasWallet || !isUnlocked) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-3xl font-bold">Chains & Tokens</h1>
        <HardwareStatusCard />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Chains & Tokens</h1>
        <div className="flex gap-2">
          <AddTokenDialog chains={chains} />
          <AddChainDialog />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="chains" data-testid="tab-chains">
            <Layers className="mr-2 h-4 w-4" />
            Networks ({chains.length})
          </TabsTrigger>
          <TabsTrigger value="tokens" data-testid="tab-tokens">
            <Coins className="mr-2 h-4 w-4" />
            Tokens ({tokens.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chains">
          {chainsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                    <Skeleton className="h-20 w-full mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {chains.map((chain) => {
                const wallet = wallets.find((w) => w.chainId === chain.id);
                return <ChainCard key={chain.id} chain={chain} wallet={wallet} />;
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tokens">
          {tokensLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                    <Skeleton className="h-16 w-full mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Coins className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Custom Tokens</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add custom ERC-20, BEP-20, or other tokens to track
                </p>
                <AddTokenDialog chains={chains} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tokens.map((token) => {
                const chain = chains.find((c) => c.id === token.chainId);
                return <TokenCard key={token.id} token={token} chain={chain} />;
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
