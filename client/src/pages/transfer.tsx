import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  QrCode,
  Send,
  Shield,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/lib/wallet-context";
import { useToast } from "@/hooks/use-toast";
import { ChainIcon } from "@/components/chain-icon";
import { HardwareStatusCard } from "@/components/hardware-status";
import type { Chain, Wallet } from "@shared/schema";

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0.00";
  return num.toFixed(4);
}

interface GasEstimate {
  gasPrice: string;
  gasPriceGwei: string;
  estimatedGas: string;
  estimatedFee: string;
  estimatedFeeUsd: string | null;
  symbol: string;
  error?: string;
}

function SendTab({ chains, wallets, initialChainId }: { chains: Chain[]; wallets: Wallet[]; initialChainId?: string }) {
  const { setShowPinModal, setPinAction, setPendingTransaction } = useWallet();
  const [selectedChainId, setSelectedChainId] = useState<string>(initialChainId || "");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const selectedChain = chains.find((c) => c.id === selectedChainId);
  const selectedWallet = wallets.find((w) => w.chainId === selectedChainId);

  const { data: gasEstimate, isLoading: gasLoading } = useQuery<GasEstimate>({
    queryKey: ["/api/gas-estimate", selectedChainId],
    enabled: !!selectedChainId,
    refetchInterval: 30000,
  });

  // Update selected chain when initialChainId changes (e.g., user clicks different chain's Send button)
  useEffect(() => {
    if (initialChainId && chains.find(c => c.id === initialChainId)) {
      setSelectedChainId(initialChainId);
    } else if (chains.length > 0 && !selectedChainId) {
      setSelectedChainId(chains[0].id);
    }
  }, [chains, initialChainId]);

  const handleSend = () => {
    setError("");

    if (!toAddress) {
      setError("Please enter a recipient address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const balance = parseFloat(selectedWallet?.balance || "0");
    if (parseFloat(amount) > balance) {
      setError("Insufficient balance");
      return;
    }

    setPendingTransaction({
      toAddress,
      amount,
      chainId: selectedChainId,
    });
    setPinAction("sign");
    setShowPinModal(true);
  };

  const handleMaxAmount = () => {
    if (selectedWallet) {
      setAmount(selectedWallet.balance);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="chain">Network</Label>
        <Select value={selectedChainId} onValueChange={setSelectedChainId}>
          <SelectTrigger id="chain" data-testid="select-send-chain">
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            {chains.map((chain) => {
              const wallet = wallets.find((w) => w.chainId === chain.id);
              return (
                <SelectItem key={chain.id} value={chain.id}>
                  <div className="flex items-center gap-2">
                    <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="sm" />
                    <span>{chain.name}</span>
                    <span className="text-muted-foreground">
                      ({formatBalance(wallet?.balance || "0")} {chain.symbol})
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient Address</Label>
        <Input
          id="recipient"
          placeholder="0x..."
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          className="font-mono"
          data-testid="input-recipient-address"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="amount">Amount</Label>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto py-0 text-xs"
            onClick={handleMaxAmount}
            data-testid="button-max-amount"
          >
            Max: {formatBalance(selectedWallet?.balance || "0")} {selectedChain?.symbol}
          </Button>
        </div>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pr-16"
            data-testid="input-send-amount"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {selectedChain?.symbol}
          </span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg bg-muted/50 p-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Gas Price</span>
          {gasLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <span data-testid="text-gas-price">
              {gasEstimate?.gasPriceGwei || "20"} Gwei
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Estimated Gas Fee</span>
          {gasLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span data-testid="text-gas-fee">
              ~{gasEstimate?.estimatedFee || "0.00042"} {selectedChain?.symbol}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          {gasLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="font-medium" data-testid="text-total-amount">
              {amount 
                ? (parseFloat(amount) + parseFloat(gasEstimate?.estimatedFee || "0.00042")).toFixed(6) 
                : "0.00"} {selectedChain?.symbol}
            </span>
          )}
        </div>
        {gasEstimate?.error && (
          <p className="mt-2 text-xs text-muted-foreground">
            Using estimated values (live data unavailable)
          </p>
        )}
      </div>

      <Button 
        className="w-full" 
        size="lg"
        onClick={handleSend}
        disabled={!toAddress || !amount}
        data-testid="button-sign-transaction"
      >
        <Shield className="mr-2 h-4 w-4" />
        Sign & Send Transaction
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You will need to enter your PIN to authorize this transaction
      </p>
    </div>
  );
}

function ReceiveTab({ chains, wallets, initialChainId }: { chains: Chain[]; wallets: Wallet[]; initialChainId?: string }) {
  const { toast } = useToast();
  const [selectedChainId, setSelectedChainId] = useState<string>(initialChainId || "");

  const selectedChain = chains.find((c) => c.id === selectedChainId);
  const selectedWallet = wallets.find((w) => w.chainId === selectedChainId);

  // Update selected chain when initialChainId changes (e.g., user clicks different chain's Receive button)
  useEffect(() => {
    if (initialChainId && chains.find(c => c.id === initialChainId)) {
      setSelectedChainId(initialChainId);
    } else if (chains.length > 0 && !selectedChainId) {
      setSelectedChainId(chains[0].id);
    }
  }, [chains, initialChainId]);

  const copyAddress = () => {
    if (selectedWallet) {
      navigator.clipboard.writeText(selectedWallet.address);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="receive-chain">Network</Label>
        <Select value={selectedChainId} onValueChange={setSelectedChainId}>
          <SelectTrigger id="receive-chain" data-testid="select-receive-chain">
            <SelectValue placeholder="Select network" />
          </SelectTrigger>
          <SelectContent>
            {chains.map((chain) => (
              <SelectItem key={chain.id} value={chain.id}>
                <div className="flex items-center gap-2">
                  <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="sm" />
                  <span>{chain.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col items-center justify-center py-6">
        <div className="mb-6 flex h-64 w-64 items-center justify-center rounded-xl bg-white p-4">
          {selectedWallet ? (
            <QRCodeSVG 
              value={selectedWallet.address} 
              size={224}
              level="M"
              includeMargin={false}
              data-testid="qr-code-address"
            />
          ) : (
            <div className="text-center">
              <QrCode className="mx-auto h-32 w-32 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Select a network</p>
            </div>
          )}
        </div>

        {selectedWallet && (
          <>
            <div className="mb-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Your {selectedChain?.name} Address</p>
              <code className="block rounded-lg bg-muted/50 px-4 py-3 font-mono text-sm break-all">
                {selectedWallet.address}
              </code>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copyAddress} data-testid="button-copy-receive-address">
                <Copy className="mr-2 h-4 w-4" />
                Copy Address
              </Button>
            </div>
          </>
        )}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only send {selectedChain?.symbol} and tokens on the {selectedChain?.name} network to this address. Sending other assets may result in permanent loss.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default function Transfer() {
  const { isConnected, isUnlocked, chains, wallets } = useWallet();
  const [location] = useLocation();
  
  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const defaultTab = searchParams.get("type") === "receive" ? "receive" : "send";
  const chainParam = searchParams.get("chain") || undefined;
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (!isConnected || !isUnlocked) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-3xl font-bold">Send / Receive</h1>
        <HardwareStatusCard />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-bold">Send / Receive</h1>

      <Card className="max-w-lg mx-auto">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="send" data-testid="tab-send">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Send
              </TabsTrigger>
              <TabsTrigger value="receive" data-testid="tab-receive">
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Receive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="send">
              <SendTab key={`send-${chainParam}`} chains={chains} wallets={wallets} initialChainId={chainParam} />
            </TabsContent>

            <TabsContent value="receive">
              <ReceiveTab key={`receive-${chainParam}`} chains={chains} wallets={wallets} initialChainId={chainParam} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
