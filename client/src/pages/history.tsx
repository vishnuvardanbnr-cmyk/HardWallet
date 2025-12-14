import { useState, useEffect } from "react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWallet } from "@/lib/wallet-context";
import { ChainIcon } from "@/components/chain-icon";
import { HardwareStatusCard } from "@/components/hardware-status";
import type { Chain, Transaction } from "@shared/schema";

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function truncateHash(hash: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0.00";
  return num.toFixed(6);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: Transaction["status"] }) {
  switch (status) {
    case "confirmed":
      return (
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
          Confirmed
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
          <XCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function TransactionRow({ transaction, chain }: { transaction: Transaction; chain?: Chain }) {
  const [expanded, setExpanded] = useState(false);
  const isSend = transaction.type === "send";

  return (
    <div 
      className="border-b border-border last:border-0"
      data-testid={`transaction-${transaction.id}`}
    >
      <div 
        className="flex items-center justify-between py-4 px-4 cursor-pointer hover-elevate"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isSend ? "bg-orange-500/10 text-orange-500" : "bg-green-500/10 text-green-500"
          }`}>
            {isSend ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{isSend ? "Sent" : "Received"}</p>
              {chain && (
                <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="sm" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isSend ? "To: " : "From: "}
              {truncateAddress(isSend ? transaction.toAddress : transaction.fromAddress)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`font-medium ${isSend ? "text-orange-500" : "text-green-500"}`}>
              {isSend ? "-" : "+"}{formatBalance(transaction.amount)} {transaction.tokenSymbol}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(transaction.timestamp)}
            </p>
          </div>
          <StatusBadge status={transaction.status} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3 text-sm">
            {transaction.txHash && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Transaction Hash</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs">{truncateHash(transaction.txHash)}</code>
                  {chain?.blockExplorer && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`${chain.blockExplorer}/tx/${transaction.txHash}`, "_blank");
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">From</span>
              <code className="font-mono text-xs">{truncateAddress(transaction.fromAddress)}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">To</span>
              <code className="font-mono text-xs">{truncateAddress(transaction.toAddress)}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span>{formatBalance(transaction.amount)} {transaction.tokenSymbol}</span>
            </div>
            {transaction.gasUsed && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gas Used</span>
                <span>{transaction.gasUsed}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Network</span>
              <span>{chain?.name || "Unknown"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function History() {
  const { isUnlocked, chains, transactions, wallets, refreshTransactions, isLoadingTransactions } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "send" | "receive">("all");
  const [filterChain, setFilterChain] = useState<string>("all");
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (isUnlocked && wallets.length > 0 && !hasFetched) {
      setHasFetched(true);
      refreshTransactions();
    }
  }, [isUnlocked, wallets.length, hasFetched, refreshTransactions]);

  if (!isUnlocked || wallets.length === 0) {
    return (
      <div className="p-6">
        <h1 className="mb-6 text-3xl font-bold">Transaction History</h1>
        <HardwareStatusCard />
      </div>
    );
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (filterChain !== "all" && tx.chainId !== filterChain) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tx.toAddress.toLowerCase().includes(query) ||
        tx.fromAddress.toLowerCase().includes(query) ||
        tx.txHash?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-3xl font-bold">Transaction History</h1>
        <Button 
          variant="outline" 
          onClick={() => refreshTransactions()}
          disabled={isLoadingTransactions}
          data-testid="button-refresh-transactions"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
          {isLoadingTransactions ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by address or hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-transactions"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="send">Sent</SelectItem>
            <SelectItem value="receive">Received</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterChain} onValueChange={setFilterChain}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-chain">
            <SelectValue placeholder="Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            {chains.map((chain) => (
              <SelectItem key={chain.id} value={chain.id}>
                <div className="flex items-center gap-2">
                  <ChainIcon symbol={chain.symbol} iconColor={chain.iconColor} size="sm" />
                  {chain.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoadingTransactions ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-20 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Transactions</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || filterType !== "all" || filterChain !== "all"
                  ? "No transactions match your filters"
                  : "Your transaction history will appear here"}
              </p>
            </div>
          ) : (
            <div>
              {filteredTransactions.map((tx) => {
                const chain = chains.find((c) => c.id === tx.chainId);
                return <TransactionRow key={tx.id} transaction={tx} chain={chain} />;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredTransactions.length > 0 && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </p>
      )}
    </div>
  );
}
