import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Chain, Wallet, Transaction, Token } from "@shared/schema";
import { DEFAULT_CHAINS } from "@shared/schema";
import { hardwareWallet, type HardwareWalletState, type ConnectionStatus } from "./hardware-wallet";
import { softWallet, type SoftWalletState } from "./soft-wallet";
import { clientStorage, type StoredWallet, type StoredTransaction, type CustomToken, type CustomChain, type CachedBalance } from "./client-storage";
import { getUniversalBalance } from "./blockchain";
import { fetchAllTransactions, type ParsedTransaction } from "./explorer-service";
import { fetchTopAssets, type TopAsset } from "./price-service";
import { deriveAllAddresses, type DerivedAddress as MultiChainDerivedAddress } from "./multi-chain-address";

interface WalletContextType {
  hardwareState: HardwareWalletState;
  isConnected: boolean;
  isUnlocked: boolean;
  hasWalletOnDevice: boolean;
  walletMode: "hard_wallet" | "soft_wallet";
  setWalletMode: (mode: "hard_wallet" | "soft_wallet") => void;
  hasSoftWalletSetup: boolean;
  hasHardWalletSetup: boolean;
  currentModeHasWallet: boolean;
  chains: Chain[];
  wallets: Wallet[];
  setWallets: (wallets: Wallet[]) => void;
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  tokens: Token[];
  setTokens: (tokens: Token[]) => void;
  selectedChainId: string | null;
  setSelectedChainId: (chainId: string | null) => void;
  showPinModal: boolean;
  setShowPinModal: (show: boolean) => void;
  pinAction: "unlock" | "sign" | "setup" | "recover" | null;
  setPinAction: (action: "unlock" | "sign" | "setup" | "recover" | null) => void;
  pendingTransaction: { toAddress: string; amount: string; chainId: string } | null;
  setPendingTransaction: (tx: { toAddress: string; amount: string; chainId: string } | null) => void;
  connectLedger: () => Promise<boolean>;
  connectRaspberryPi: () => Promise<{ success: boolean; hasWallet: boolean; error?: string }>;
  connectSimulated: (seedPhrase: string) => Promise<boolean>;
  unlockWallet: (pin: string) => Promise<boolean>;
  lockWallet: () => void;
  disconnectDevice: () => Promise<void>;
  deriveWallets: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  refreshTransactions: () => Promise<void>;
  resetSessionTimeout: () => void;
  isLoading: boolean;
  isLoadingTransactions: boolean;
  error: string | null;
  topAssets: TopAsset[];
  enabledAssetIds: Set<string>;
  isLoadingAssets: boolean;
  toggleAssetEnabled: (assetId: string, enabled: boolean) => Promise<void>;
  refreshTopAssets: () => Promise<void>;
  enableAllAssets: () => Promise<void>;
  disableAllAssets: () => Promise<void>;
  createAdditionalWallet: (label?: string) => Promise<void>;
  createWalletWithNewSeed: (label?: string, pin?: string) => Promise<{ seedPhrase: string; walletGroupId: string }>;
  generateNewSeedPhrase: () => string;
  selectedAccountIndex: number;
  setSelectedAccountIndex: (index: number) => void;
  availableAccounts: { index: number; label?: string }[];
  visibleWallets: Wallet[];
  customTokens: CustomToken[];
  loadCustomTokens: () => Promise<void>;
  addCustomToken: (token: Omit<CustomToken, 'id' | 'addedAt'>) => Promise<CustomToken>;
  removeCustomToken: (id: string) => Promise<void>;
  customChains: CustomChain[];
  loadCustomChains: () => Promise<void>;
  addCustomChain: (chain: Omit<CustomChain, 'id' | 'addedAt'>) => Promise<CustomChain>;
  removeCustomChain: (id: string) => Promise<void>;
  balanceCacheStatus: { isStale: boolean; lastUpdated: number | null; isRefreshing: boolean };
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [hardwareState, setHardwareState] = useState<HardwareWalletState>(hardwareWallet.getState());
  const [softWalletState, setSoftWalletState] = useState<SoftWalletState>(softWallet.getState());
  const [chains, setChains] = useState<Chain[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"unlock" | "sign" | "setup" | "recover" | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<{ toAddress: string; amount: string; chainId: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [topAssets, setTopAssets] = useState<TopAsset[]>([]);
  const [enabledAssetIds, setEnabledAssetIds] = useState<Set<string>>(new Set());
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [walletMode, setWalletModeInternal] = useState<"hard_wallet" | "soft_wallet">(() => {
    // Load persisted wallet mode from localStorage
    const savedMode = localStorage.getItem("walletMode");
    return savedMode === "hard_wallet" ? "hard_wallet" : "soft_wallet";
  });
  const [hasSoftWalletSetup, setHasSoftWalletSetup] = useState(false);
  const [hasHardWalletSetup, setHasHardWalletSetup] = useState(false);
  const [softWallets, setSoftWallets] = useState<Wallet[]>([]);
  const [hardWallets, setHardWallets] = useState<Wallet[]>([]);
  const [selectedAccountIndex, setSelectedAccountIndex] = useState<number>(0);
  const [customTokens, setCustomTokens] = useState<CustomToken[]>([]);
  const [customChains, setCustomChains] = useState<CustomChain[]>([]);
  const [balanceCacheStatus, setBalanceCacheStatus] = useState<{ isStale: boolean; lastUpdated: number | null; isRefreshing: boolean }>({
    isStale: false,
    lastUpdated: null,
    isRefreshing: false,
  });
  
  // Ref to track mode switch operations and prevent race conditions
  const modeSwitchIdRef = useRef<number>(0);
  // Flag to indicate a mode switch is in progress
  const isModeSwitchingRef = useRef<boolean>(false);
  // Track cache loading per mode - only load once per mode
  const hasLoadedCacheForModeRef = useRef<{ soft: boolean; hard: boolean }>({ soft: false, hard: false });

  // Compute available accounts from wallets (unique account indices with labels)
  const availableAccounts = useMemo(() => {
    const accountMap = new Map<number, { index: number; label?: string }>();
    wallets.forEach(w => {
      if (!accountMap.has(w.accountIndex)) {
        accountMap.set(w.accountIndex, { index: w.accountIndex, label: w.label });
      }
    });
    return Array.from(accountMap.values()).sort((a, b) => a.index - b.index);
  }, [wallets]);

  // Filter wallets by selected account index - uses modeBasedWallets for race-condition-free display
  const visibleWallets = useMemo(() => {
    // Use modeBasedWallets which is computed synchronously from current mode
    // This prevents hard wallet data from appearing in soft wallet mode during rapid switches
    const walletsToFilter = walletMode === "soft_wallet" ? softWallets : 
      (hardwareState.status === "connected" || hardwareState.status === "unlocked" ? hardWallets : []);
    return walletsToFilter.filter(w => w.accountIndex === selectedAccountIndex);
  }, [walletMode, softWallets, hardWallets, hardwareState.status, selectedAccountIndex]);

  // Normalize selectedAccountIndex when wallets change and current index becomes invalid
  useEffect(() => {
    if (wallets.length === 0) return;
    const validIndices = new Set(wallets.map(w => w.accountIndex));
    if (!validIndices.has(selectedAccountIndex)) {
      const lowestIndex = Math.min(...Array.from(validIndices));
      setSelectedAccountIndex(lowestIndex);
    }
  }, [wallets, selectedAccountIndex]);

  useEffect(() => {
    const unsubscribe = hardwareWallet.subscribe(setHardwareState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = softWallet.subscribe(setSoftWalletState);
    return unsubscribe;
  }, []);

  // Check if soft wallet exists after storage is initialized
  useEffect(() => {
    if (storageInitialized) {
      softWallet.checkWalletExists();
    }
  }, [storageInitialized]);

  useEffect(() => {
    async function initStorage() {
      try {
        await clientStorage.init();
        setStorageInitialized(true);
        
        // Load mode-specific wallet setup states
        const softSetup = await clientStorage.isSoftWalletSetup();
        const hardSetup = await clientStorage.isHardWalletSetup();
        setHasSoftWalletSetup(softSetup);
        setHasHardWalletSetup(hardSetup);
        
        // Get persisted wallet mode
        const savedMode = localStorage.getItem("walletMode");
        const currentMode = savedMode === "hard_wallet" ? "hard_wallet" : "soft_wallet";
        
        // Load wallet data and check for cross-contamination
        const softWalletData = softSetup ? await clientStorage.getSoftWalletData() : [];
        const hardWalletData = hardSetup ? await clientStorage.getHardWalletData() : [];
        
        // Detect cross-contamination: if addresses match between soft and hard, clear the contaminated one
        if (softWalletData.length > 0 && hardWalletData.length > 0) {
          const softAddresses = new Set(softWalletData.map(w => w.address.toLowerCase()));
          const hardAddresses = new Set(hardWalletData.map(w => w.address.toLowerCase()));
          const overlap = [...softAddresses].some(addr => hardAddresses.has(addr));
          
          if (overlap) {
            console.log("[WalletContext] Detected cross-contamination - clearing soft wallet data");
            await clientStorage.clearSoftWallet();
            await clientStorage.clearEncryptedSeed();
            setHasSoftWalletSetup(false);
            setSoftWallets([]);
            
            // Only load hard wallet data - but don't display until device connects
            if (hardSetup) {
              const mappedHardWallets: Wallet[] = hardWalletData.map(w => ({
                id: w.id,
                deviceId: "hard",
                chainId: w.chainId,
                address: w.address,
                balance: "0",
                isActive: true,
                accountIndex: w.accountIndex ?? 0,
                label: w.label,
              }));
              setHardWallets(mappedHardWallets);
              // In hard wallet mode, don't set active wallets until device is connected
              // User needs to click "Connect" first
            }
            return;
          }
        }
        
        // Load cached balances to apply immediately
        const cachedBalances = await clientStorage.getAllCachedBalances();
        const cachedBalanceMap = new Map<string, string>();
        cachedBalances.forEach(c => {
          cachedBalanceMap.set(`${c.address.toLowerCase()}-${c.chainSymbol}`, c.balance);
        });
        
        // Update cache status
        const lastRefresh = await clientStorage.getLastFullRefresh();
        if (lastRefresh > 0) {
          const isStale = clientStorage.isCacheStale(lastRefresh);
          setBalanceCacheStatus({ isStale, lastUpdated: lastRefresh, isRefreshing: false });
        }
        
        // Load soft wallet data if it's set up (no contamination)
        if (softSetup && softWalletData.length > 0) {
          const mappedWallets: Wallet[] = softWalletData.map(w => {
            // Apply cached balance if available
            const cacheKey = `${w.address.toLowerCase()}-${w.chainSymbol}`;
            const cachedBalance = cachedBalanceMap.get(cacheKey);
            return {
              id: w.id,
              deviceId: "soft",
              chainId: w.chainId,
              address: w.address,
              balance: cachedBalance || "0",
              isActive: true,
              accountIndex: w.accountIndex ?? 0,
              label: w.label,
            };
          });
          setSoftWallets(mappedWallets);
          // Set as active wallets if in soft wallet mode
          if (currentMode === "soft_wallet") {
            setWallets(mappedWallets);
            // Mark cache as loaded for soft mode
            hasLoadedCacheForModeRef.current.soft = true;
          }
        }
        
        // Load hard wallet data if it's set up - but don't display until device connects
        if (hardSetup && hardWalletData.length > 0) {
          const mappedWallets: Wallet[] = hardWalletData.map(w => {
            // Apply cached balance if available
            const cacheKey = `${w.address.toLowerCase()}-${w.chainSymbol}`;
            const cachedBalance = cachedBalanceMap.get(cacheKey);
            return {
              id: w.id,
              deviceId: "hard",
              chainId: w.chainId,
              address: w.address,
              balance: cachedBalance || "0",
              isActive: true,
              accountIndex: w.accountIndex ?? 0,
              label: w.label,
            };
          });
          setHardWallets(mappedWallets);
          // In hard wallet mode, don't set active wallets until device is connected
          // User needs to click "Connect" first - wallets will be loaded when device connects
        }
      } catch (err) {
        console.error("Failed to initialize storage:", err);
      }
    }
    initStorage();
  }, []);
  
  // Handle wallet mode switching
  const setWalletMode = useCallback(async (mode: "hard_wallet" | "soft_wallet") => {
    if (mode === walletMode) return;
    
    // Mark that we're switching modes to prevent effects from interfering
    isModeSwitchingRef.current = true;
    
    // Increment mode switch ID to track this operation and prevent race conditions
    modeSwitchIdRef.current += 1;
    const currentSwitchId = modeSwitchIdRef.current;
    
    // First, persist current mode's wallets to storage before switching
    // Only save if wallets match the current mode (prevent cross-contamination)
    const expectedDeviceId = walletMode === "soft_wallet" ? "soft" : "hard";
    const walletsForCurrentMode = wallets.filter(w => w.deviceId === expectedDeviceId);
    
    if (walletsForCurrentMode.length > 0 && storageInitialized) {
      const storedWalletsForCurrentMode: StoredWallet[] = walletsForCurrentMode.map(w => {
        const chain = chains.find(c => c.id === w.chainId);
        return {
          id: w.id,
          address: w.address,
          chainId: w.chainId,
          chainName: chain?.name || "",
          chainSymbol: chain?.symbol || "",
          balance: w.balance,
          path: "m/44'/60'/0'/0/0",
          lastUpdated: new Date().toISOString(),
          accountIndex: w.accountIndex ?? 0,
          label: w.label,
        };
      });
      
      if (walletMode === "soft_wallet") {
        await clientStorage.saveSoftWalletData(storedWalletsForCurrentMode);
        await clientStorage.setSoftWalletSetup(true);
        // Check if this operation is still current before mutating state
        if (modeSwitchIdRef.current !== currentSwitchId) return;
        setHasSoftWalletSetup(true);
        setSoftWallets(walletsForCurrentMode);
      } else {
        await clientStorage.saveHardWalletData(storedWalletsForCurrentMode);
        await clientStorage.setHardWalletSetup(true);
        if (modeSwitchIdRef.current !== currentSwitchId) return;
        setHasHardWalletSetup(true);
        setHardWallets(walletsForCurrentMode);
      }
    }
    
    // Check if this operation is still current
    if (modeSwitchIdRef.current !== currentSwitchId) return;
    
    // Switch mode and immediately clear wallets to prevent stale data during async load
    setWalletModeInternal(mode);
    localStorage.setItem("walletMode", mode);
    setWallets([]);
    
    // Load wallets from storage for the target mode - no PIN required for viewing
    try {
      if (mode === "soft_wallet") {
        const softSetup = await clientStorage.isSoftWalletSetup();
        // Check if this operation is still current before mutating state
        if (modeSwitchIdRef.current !== currentSwitchId) return;
        setHasSoftWalletSetup(softSetup);
        
        if (softSetup) {
          const softWalletData = await clientStorage.getSoftWalletData();
          if (modeSwitchIdRef.current !== currentSwitchId) return;
          
          if (softWalletData.length > 0) {
            const mappedWallets: Wallet[] = softWalletData.map(w => ({
              id: w.id,
              deviceId: "soft",
              chainId: w.chainId,
              address: w.address,
              balance: "0",
              isActive: true,
              accountIndex: w.accountIndex ?? 0,
              label: w.label,
            }));
            setSoftWallets(mappedWallets);
            setWallets(mappedWallets);
          } else {
            // No wallet data even though setup flag is true - just show empty state
            setWallets([]);
          }
        } else {
          // Not set up - show empty state, user can set up from dashboard
          setWallets([]);
        }
      } else {
        // Hard wallet mode - only load wallet data into cache, NOT into active display
        // Wallets will only be displayed when device is actually connected
        const hardSetup = await clientStorage.isHardWalletSetup();
        const hasStoredHardWallet = await hardwareWallet.hasStoredHardWallet();
        
        // Check if this operation is still current before mutating state
        if (modeSwitchIdRef.current !== currentSwitchId) return;
        
        if (hardSetup || hasStoredHardWallet) {
          const hardWalletData = await clientStorage.getHardWalletData();
          if (modeSwitchIdRef.current !== currentSwitchId) return;
          
          if (hardWalletData.length > 0) {
            const mappedWallets: Wallet[] = hardWalletData.map(w => ({
              id: w.id,
              deviceId: "hard",
              chainId: w.chainId,
              address: w.address,
              balance: "0",
              isActive: true,
              accountIndex: w.accountIndex ?? 0,
              label: w.label,
            }));
            setHardWallets(mappedWallets);
            setHasHardWalletSetup(true);
            // Don't set active wallets - wait for device connection
            // The useEffect watching isConnected will populate wallets when device connects
            setWallets([]);
          } else {
            // No wallet data - show empty state
            setHasHardWalletSetup(false);
            setHardWallets([]);
            setWallets([]);
          }
        } else {
          // Not set up - show empty state, user can set up from dashboard
          setHasHardWalletSetup(false);
          setWallets([]);
        }
      }
    } catch (err) {
      console.error("Failed to load wallet data for mode:", mode, err);
      if (modeSwitchIdRef.current === currentSwitchId) {
        setWallets([]);
      }
    } finally {
      // Only clear the switching flag if this is still the current operation
      if (modeSwitchIdRef.current === currentSwitchId) {
        isModeSwitchingRef.current = false;
      }
    }
  }, [walletMode, wallets, storageInitialized, chains]);

  // Load top assets and enabled preferences on mount
  useEffect(() => {
    async function loadAssetsAndPreferences() {
      if (!storageInitialized) return;
      
      setIsLoadingAssets(true);
      try {
        // Fetch top assets from API
        const assets = await fetchTopAssets(20);
        setTopAssets(assets);
        
        const newAssetIds = new Set(assets.map(a => a.id));
        
        // Load enabled preferences from storage
        const hasPreference = await clientStorage.hasEnabledAssetsPreference();
        if (hasPreference) {
          const storedEnabled = await clientStorage.getEnabledAssets();
          // Reconcile: keep only IDs that exist in the new assets
          const synced = new Set<string>();
          for (const id of storedEnabled) {
            if (newAssetIds.has(id)) {
              synced.add(id);
            }
          }
          // If after reconciliation we lost all enabled assets, re-enable all
          if (synced.size === 0 && storedEnabled.size > 0) {
            setEnabledAssetIds(newAssetIds);
            await clientStorage.setEnabledAssets(newAssetIds);
          } else {
            setEnabledAssetIds(synced);
            // Only persist if we actually removed stale entries
            if (synced.size !== storedEnabled.size) {
              await clientStorage.setEnabledAssets(synced);
            }
          }
        } else {
          // First time: enable all top assets by default
          setEnabledAssetIds(newAssetIds);
          await clientStorage.setEnabledAssets(newAssetIds);
        }
      } catch (err) {
        console.error("Failed to load assets:", err);
      } finally {
        setIsLoadingAssets(false);
      }
    }
    loadAssetsAndPreferences();
  }, [storageInitialized]);

  useEffect(() => {
    async function loadTransactions() {
      if (!storageInitialized) return;
      try {
        const storedTxs = await clientStorage.getAllTransactions();
        const mappedTxs: Transaction[] = storedTxs.map(tx => ({
          id: tx.id,
          walletId: tx.walletId,
          chainId: tx.chainId,
          type: tx.type,
          status: tx.status,
          amount: tx.amount,
          tokenSymbol: tx.tokenSymbol,
          toAddress: tx.toAddress,
          fromAddress: tx.fromAddress,
          txHash: tx.txHash || undefined,
          gasUsed: tx.gasUsed || undefined,
          timestamp: tx.timestamp,
        }));
        setTransactions(mappedTxs);
      } catch (err) {
        console.error("Failed to load transactions:", err);
      }
    }
    loadTransactions();
  }, [storageInitialized]);

  useEffect(() => {
    const defaultChains: Chain[] = DEFAULT_CHAINS.map((c, i) => ({
      ...c,
      id: `chain-${i}`,
    }));
    
    // Merge default chains with custom chains
    const customChainsAsMapped: Chain[] = customChains.map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      rpcUrl: c.rpcUrl,
      chainId: c.chainId,
      blockExplorer: c.blockExplorer || "",
      iconColor: c.iconColor || "#6B7280",
      isDefault: false,
      decimals: c.decimals,
    }));
    
    setChains([...defaultChains, ...customChainsAsMapped]);
    if (defaultChains.length > 0 && !selectedChainId) {
      setSelectedChainId(defaultChains[0].id);
    }
  }, [customChains]);

  useEffect(() => {
    const handleActivity = () => {
      if (walletMode === "soft_wallet") {
        if (softWalletState.status === "unlocked") {
          softWallet.resetSessionTimeout();
        }
      } else {
        if (hardwareState.status === "unlocked") {
          hardwareWallet.resetSessionTimeout();
        }
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [walletMode, hardwareState.status, softWalletState.status]);

  const fetchedWalletIdsRef = useRef<Set<string>>(new Set());
  const isRefreshingRef = useRef<boolean>(false);
  
  // Reset fetched wallet IDs when wallet mode changes
  useEffect(() => {
    fetchedWalletIdsRef.current = new Set();
  }, [walletMode]);

  useEffect(() => {
    // Skip automatic fetch if refreshBalances is in progress
    if (isRefreshingRef.current) return;
    
    if (wallets.length === 0) {
      fetchedWalletIdsRef.current = new Set();
      return;
    }
    
    if (chains.length === 0) return;
    
    // Find wallets that haven't had their balances fetched yet
    const unfetchedWallets = wallets.filter(w => !fetchedWalletIdsRef.current.has(w.id));
    if (unfetchedWallets.length === 0) return;
    
    // Mark these wallets as being fetched (using ref to avoid re-render loop)
    unfetchedWallets.forEach(w => fetchedWalletIdsRef.current.add(w.id));
    
    (async () => {
      const updatedWallets = await Promise.all(
        wallets.map(async (wallet) => {
          // Only fetch balance for wallets that need it
          if (wallet.balance !== "0") return wallet;
          
          const chain = chains.find(c => c.id === wallet.chainId);
          if (!chain || chain.chainId === 0) return wallet;
          try {
            // Pass custom RPC URL for custom chains (non-default chains have rpcUrl set)
            const customRpcUrl = !chain.isDefault && chain.rpcUrl ? chain.rpcUrl : undefined;
            const balance = await getUniversalBalance(wallet.address, chain.chainId, chain.symbol, customRpcUrl);
            return { ...wallet, balance };
          } catch {
            return wallet;
          }
        })
      );
      setWallets(updatedWallets);
    })();
  }, [wallets, chains.length, walletMode]);

  // For soft wallet mode, use softWalletState; for hard wallet mode, use hardwareState
  const isConnected = walletMode === "soft_wallet" 
    ? (softWalletState.status === "locked" || softWalletState.status === "unlocked" || softWalletState.hasWallet)
    : (hardwareState.status === "connected" || hardwareState.status === "unlocked");
  const isUnlocked = walletMode === "soft_wallet"
    ? softWalletState.status === "unlocked"
    : hardwareState.status === "unlocked";
  
  // Computed value for whether current mode has a wallet set up
  const currentModeHasWallet = walletMode === "soft_wallet" ? hasSoftWalletSetup : hasHardWalletSetup;

  // CRITICAL: Compute displayed wallets synchronously based on current mode
  // This eliminates race conditions from async state updates
  const modeBasedWallets = useMemo(() => {
    if (walletMode === "soft_wallet") {
      // In soft wallet mode, ONLY show soft wallet data
      return softWallets;
    } else {
      // In hard wallet mode, ONLY show hard wallet data when device is connected
      const hardConnected = hardwareState.status === "connected" || hardwareState.status === "unlocked";
      return hardConnected ? hardWallets : [];
    }
  }, [walletMode, softWallets, hardWallets, hardwareState.status]);

  // Track last hard wallet connection status for triggering balance refresh
  const lastHardConnectedRef = useRef<boolean>(false);
  
  // Sync wallets array from modeBasedWallets when hard wallet connects or mode changes
  // This ensures the wallets array is populated for components that depend on it
  useEffect(() => {
    if (isModeSwitchingRef.current) return; // Don't sync during mode switch
    
    if (walletMode === "hard_wallet") {
      const hardConnected = hardwareState.status === "connected" || hardwareState.status === "unlocked";
      
      // Detect when hard wallet just connected (transition from not connected to connected)
      const justConnected = hardConnected && !lastHardConnectedRef.current;
      lastHardConnectedRef.current = hardConnected;
      
      if (hardConnected && hardWallets.length > 0) {
        // Clear the fetched wallet IDs ref so balances get fetched fresh
        // This happens on initial sync OR when hard wallet reconnects
        if (wallets.length === 0 || justConnected) {
          fetchedWalletIdsRef.current = new Set();
          // Clone hardWallets to ensure React detects the state change
          setWallets([...hardWallets]);
        }
      }
    } else {
      // Reset the ref when switching away from hard wallet mode
      lastHardConnectedRef.current = false;
    }
  }, [walletMode, hardwareState.status, hardWallets, wallets.length]);

  const connectLedger = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await hardwareWallet.connectLedger();
      return result;
    } catch (err: any) {
      setError(err.message || "Failed to connect Ledger");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectRaspberryPi = useCallback(async (): Promise<{ success: boolean; hasWallet: boolean; error?: string }> => {
    console.log("[WalletContext] connectRaspberryPi() called");
    setIsLoading(true);
    setError(null);
    try {
      const result = await hardwareWallet.connectRaspberryPi();
      console.log("[WalletContext] hardwareWallet.connectRaspberryPi() result:", result);
      
      if (result) {
        const hasWallet = hardwareWallet.hasWalletOnDevice();
        console.log("[WalletContext] Device has wallet:", hasWallet);
        
        // Check if the Pico has a wallet - if not, clear cached wallets
        if (!hasWallet) {
          console.log("[WalletContext] NEW DEVICE - No wallet found, clearing cache");
          setWallets([]);
          setTransactions([]);
          await clientStorage.clearAll();
        } else {
          console.log("[WalletContext] EXISTING DEVICE - Wallet found on device");
        }
        return { success: true, hasWallet };
      } else {
        // Connection failed - reset hasWallet to false and return error
        console.log("[WalletContext] Connection failed");
        hardwareWallet.setHasWalletOnDevice(false);
        const errorMsg = hardwareWallet.getState().error;
        return { success: false, hasWallet: false, error: errorMsg || undefined };
      }
    } catch (err: any) {
      // Exception thrown - reset hasWallet to false
      console.log("[WalletContext] Exception:", err);
      hardwareWallet.setHasWalletOnDevice(false);
      const errorMsg = err.message || "Failed to connect Raspberry Pi";
      setError(errorMsg);
      return { success: false, hasWallet: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectSimulated = useCallback(async (seedPhrase: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await hardwareWallet.connectSimulated(seedPhrase);
      return result;
    } catch (err: any) {
      setError(err.message || "Failed to create simulated wallet");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlockWallet = useCallback(async (pin: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      let result: boolean;
      if (walletMode === "soft_wallet") {
        result = await softWallet.unlock(pin);
        if (!result && softWallet.getState().error) {
          setError(softWallet.getState().error);
        }
      } else {
        result = await hardwareWallet.unlock(pin);
      }
      if (result) {
        setShowPinModal(false);
      }
      return result;
    } catch (err: any) {
      setError(err.message || "Failed to unlock wallet");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [walletMode]);

  const lockWallet = useCallback(() => {
    if (walletMode === "soft_wallet") {
      softWallet.lock();
    } else {
      hardwareWallet.lock();
    }
  }, [walletMode]);

  const resetSessionTimeout = useCallback(() => {
    if (walletMode === "soft_wallet") {
      softWallet.resetSessionTimeout();
    } else {
      hardwareWallet.resetSessionTimeout();
    }
  }, [walletMode]);

  const disconnectDevice = useCallback(async () => {
    if (walletMode === "soft_wallet") {
      await softWallet.reset();
      setHasSoftWalletSetup(false);
      setSoftWallets([]);
    } else {
      await hardwareWallet.disconnect();
      await clientStorage.clearHardWallet();
      setHasHardWalletSetup(false);
      setHardWallets([]);
    }
    setWallets([]);
    setTransactions([]);
  }, [walletMode]);

  const deriveWallets = useCallback(async () => {
    // Check unlock status based on wallet mode
    if (walletMode === "soft_wallet") {
      if (softWallet.getState().status !== "unlocked") {
        setError("Wallet must be unlocked to derive wallets");
        return;
      }
    } else {
      const currentState = hardwareWallet.getState();
      if (currentState.status !== "unlocked") {
        setError("Device must be unlocked to derive wallets");
        return;
      }
    }

    // Before deriving new wallets, check if we have stored wallets
    if (storageInitialized) {
      const storedWallets = walletMode === "soft_wallet" 
        ? await clientStorage.getSoftWalletData()
        : await clientStorage.getHardWalletData();
      
      if (storedWallets.length > 0) {
        // Load from storage
        const mappedWallets: Wallet[] = storedWallets.map(w => ({
          id: w.id,
          deviceId: walletMode === "soft_wallet" ? "soft" : "hard",
          chainId: w.chainId,
          address: w.address,
          balance: "0",
          isActive: true,
          accountIndex: w.accountIndex ?? 0,
          label: w.label,
        }));
        
        // Check for new chains that need addresses derived
        const currentChains = chains.length > 0 ? chains : DEFAULT_CHAINS.map((c, i) => ({
          ...c,
          id: `chain-${i}`,
        }));
        
        // Get unique account indices from stored wallets
        const accountIndices = [...new Set(storedWallets.map(w => w.accountIndex ?? 0))];
        
        // Find chains that don't have wallets yet (for account index 0)
        const existingChainIds = new Set(storedWallets.filter(w => (w.accountIndex ?? 0) === 0).map(w => w.chainId));
        const missingChains = currentChains.filter(c => !existingChainIds.has(c.id));
        
        if (missingChains.length > 0) {
          // Derive addresses for missing chains
          let mnemonic: string | null = null;
          if (walletMode === "soft_wallet") {
            mnemonic = softWallet.getSeedPhrase();
          } else {
            mnemonic = await hardwareWallet.getSeedPhraseFromDevice();
          }
          
          if (mnemonic) {
            const missingSymbols = missingChains.map(c => c.symbol);
            const newAddresses = await deriveAllAddresses(mnemonic, missingSymbols, 0);
            
            for (const derived of newAddresses) {
              const chain = missingChains.find(c => c.symbol === derived.chainSymbol);
              if (!chain || !derived.address) continue;
              
              const walletId = `wallet-${chain.id}-${derived.address.slice(0, 8)}`;
              const newWallet: Wallet = {
                id: walletId,
                deviceId: walletMode === "soft_wallet" ? "soft" : "hard",
                chainId: chain.id,
                address: derived.address,
                balance: "0",
                isActive: true,
                accountIndex: 0,
              };
              mappedWallets.push(newWallet);
              
              // Save new wallet to storage
              const storedWallet: StoredWallet = {
                id: walletId,
                address: derived.address,
                chainId: chain.id,
                chainName: chain.name,
                chainSymbol: chain.symbol,
                balance: "0",
                path: derived.path,
                lastUpdated: new Date().toISOString(),
                accountIndex: 0,
              };
              if (walletMode === "soft_wallet") {
                await clientStorage.saveSoftWalletData([...storedWallets, storedWallet]);
              } else {
                await clientStorage.saveHardWalletData([...storedWallets, storedWallet]);
              }
            }
          }
        }
        
        setWallets(mappedWallets);
        if (walletMode === "soft_wallet") {
          setSoftWallets(mappedWallets);
        } else {
          setHardWallets(mappedWallets);
        }
        return;
      }
    }

    setIsLoading(true);
    try {
      const currentChains = chains.length > 0 ? chains : DEFAULT_CHAINS.map((c, i) => ({
        ...c,
        id: `chain-${i}`,
      }));
      
      const newWallets: Wallet[] = [];
      const chainSymbols = currentChains.map(c => c.symbol);
      
      if (walletMode === "soft_wallet") {
        // Use softWallet.deriveAddresses() for soft wallet mode
        const derivedAddresses = await softWallet.deriveAddresses(chainSymbols);
        
        for (const derived of derivedAddresses) {
          const chain = currentChains.find(c => c.symbol === derived.chainSymbol);
          if (!chain || !derived.address) continue;
          
          const walletId = `wallet-${chain.id}-${derived.address.slice(0, 8)}`;
          
          const wallet: Wallet = {
            id: walletId,
            deviceId: "soft",
            chainId: chain.id,
            address: derived.address,
            balance: "0",
            isActive: true,
            accountIndex: 0,
          };
          
          newWallets.push(wallet);
        }
      } else {
        // Hard wallet mode - try to get mnemonic for proper multi-chain derivation
        const mnemonic = await hardwareWallet.getSeedPhraseFromDevice();
        
        if (mnemonic) {
          // Use proper multi-chain address derivation
          const derivedAddresses = await deriveAllAddresses(mnemonic, chainSymbols);
          
          for (const derived of derivedAddresses) {
            const chain = currentChains.find(c => c.symbol === derived.chainSymbol);
            if (!chain || !derived.address) continue;
            
            const walletId = `wallet-${chain.id}-${derived.address.slice(0, 8)}`;
            
            const wallet: Wallet = {
              id: walletId,
              deviceId: "hard",
              chainId: chain.id,
              address: derived.address,
              balance: "0",
              isActive: true,
              accountIndex: 0,
            };
            
            newWallets.push(wallet);
          }
        } else {
          // Fallback: use hardware wallet's EVM derivation for EVM chains only
          const evmChains = currentChains.filter(c => c.chainId > 0);
          const chainIds = evmChains.map(c => c.chainId);
          
          const derivedAddresses = await hardwareWallet.getMultipleAddresses(chainIds);
          
          for (const derived of derivedAddresses) {
            const chain = evmChains.find(c => c.chainId === derived.chainId);
            if (!chain) continue;
            
            const walletId = `wallet-${chain.id}-${derived.address.slice(0, 8)}`;
            
            const wallet: Wallet = {
              id: walletId,
              deviceId: "hard",
              chainId: chain.id,
              address: derived.address,
              balance: "0",
              isActive: true,
              accountIndex: 0,
            };
            
            newWallets.push(wallet);
          }
        }
      }
      
      setWallets(newWallets);
      
      // Save to mode-specific storage and mark as set up
      if (storageInitialized && newWallets.length > 0) {
        const storedWalletsForMode: StoredWallet[] = newWallets.map(w => {
          const chain = currentChains.find(c => c.id === w.chainId);
          return {
            id: w.id,
            address: w.address,
            chainId: w.chainId,
            chainName: chain?.name || "",
            chainSymbol: chain?.symbol || "",
            balance: w.balance,
            path: "m/44'/60'/0'/0/0",
            lastUpdated: new Date().toISOString(),
            accountIndex: w.accountIndex ?? 0,
            label: w.label,
          };
        });
        
        if (walletMode === "soft_wallet") {
          await clientStorage.saveSoftWalletData(storedWalletsForMode);
          await clientStorage.setSoftWalletSetup(true);
          setHasSoftWalletSetup(true);
          setSoftWallets(newWallets);
        } else {
          await clientStorage.saveHardWalletData(storedWalletsForMode);
          await clientStorage.setHardWalletSetup(true);
          setHasHardWalletSetup(true);
          setHardWallets(newWallets);
        }
      }
      
      if (chains.length === 0) {
        setChains(currentChains);
      }
      
      if (newWallets.length > 0 && !selectedChainId) {
        setSelectedChainId(newWallets[0].chainId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to derive wallets");
    } finally {
      setIsLoading(false);
    }
  }, [chains, selectedChainId, storageInitialized, walletMode]);

  const loadCachedBalances = useCallback(async () => {
    const currentWallets = walletMode === "soft_wallet" ? softWallets : hardWallets;
    if (currentWallets.length === 0 || chains.length === 0) return;
    
    try {
      const cachedBalances = await clientStorage.getAllCachedBalances();
      if (cachedBalances.length === 0) return;
      
      const lastRefresh = await clientStorage.getLastFullRefresh();
      const isStale = lastRefresh > 0 ? clientStorage.isCacheStale(lastRefresh) : true;
      
      setBalanceCacheStatus(prev => ({
        ...prev,
        isStale,
        lastUpdated: lastRefresh || null,
      }));
      
      const updatedWallets = currentWallets.map(wallet => {
        const chain = chains.find(c => c.id === wallet.chainId);
        if (!chain) return wallet;
        
        const cached = cachedBalances.find(
          c => c.address.toLowerCase() === wallet.address.toLowerCase() && c.chainSymbol === chain.symbol
        );
        
        if (cached) {
          return { ...wallet, balance: cached.balance };
        }
        return wallet;
      });
      
      setWallets([...updatedWallets]);
      if (walletMode === "soft_wallet") {
        setSoftWallets([...updatedWallets]);
      } else {
        setHardWallets([...updatedWallets]);
      }
    } catch (err) {
      console.error("Failed to load cached balances:", err);
    }
  }, [walletMode, softWallets, hardWallets, chains]);

  const refreshBalances = useCallback(async () => {
    isRefreshingRef.current = true;
    fetchedWalletIdsRef.current = new Set();
    
    setBalanceCacheStatus(prev => ({ ...prev, isRefreshing: true }));
    
    try {
      const currentWallets = walletMode === "soft_wallet" ? softWallets : hardWallets;
      
      if (currentWallets.length === 0 || chains.length === 0) {
        // No wallets to refresh - clear refreshing but don't update lastUpdated
        // Keep isStale: false since there's nothing to be stale, but don't claim we just refreshed
        setBalanceCacheStatus(prev => ({ ...prev, isStale: false, isRefreshing: false }));
        return;
      }
      
      const balancesToCache: Array<{ address: string; chainSymbol: string; chainId: number; balance: string }> = [];
      
      const updatedWallets = await Promise.all(
        currentWallets.map(async (wallet) => {
          const chain = chains.find(c => c.id === wallet.chainId);
          if (!chain) {
            return wallet;
          }
          
          try {
            const customRpcUrl = !chain.isDefault && chain.rpcUrl ? chain.rpcUrl : undefined;
            const balance = await getUniversalBalance(wallet.address, chain.chainId, chain.symbol, customRpcUrl);
            
            balancesToCache.push({
              address: wallet.address,
              chainSymbol: chain.symbol,
              chainId: chain.chainId,
              balance,
            });
            
            return { ...wallet, balance };
          } catch (err) {
            console.error(`Failed to fetch balance for ${wallet.address}:`, err);
            return wallet;
          }
        })
      );
      
      // Only update wallets if at least one balance was successfully fetched
      // This preserves cached balances when all fetches fail
      if (balancesToCache.length > 0) {
        setWallets([...updatedWallets]);
        
        if (walletMode === "soft_wallet") {
          setSoftWallets([...updatedWallets]);
        } else {
          setHardWallets([...updatedWallets]);
        }
      }
      
      if (storageInitialized && balancesToCache.length > 0) {
        await clientStorage.setCachedBalances(balancesToCache);
        
        const storedWalletsForMode: StoredWallet[] = updatedWallets.map(w => {
          const chain = chains.find(c => c.id === w.chainId);
          return {
            id: w.id,
            address: w.address,
            chainId: w.chainId,
            chainName: chain?.name || "",
            chainSymbol: chain?.symbol || "",
            balance: w.balance,
            path: "m/44'/60'/0'/0/0",
            lastUpdated: new Date().toISOString(),
            accountIndex: w.accountIndex ?? 0,
            label: w.label,
            walletGroupId: w.walletGroupId,
          };
        });
        
        if (walletMode === "soft_wallet") {
          await clientStorage.saveSoftWalletData(storedWalletsForMode);
        } else {
          await clientStorage.saveHardWalletData(storedWalletsForMode);
        }
        
        // Only mark as fresh if at least one balance was successfully fetched
        setBalanceCacheStatus({
          isStale: false,
          lastUpdated: Date.now(),
          isRefreshing: false,
        });
      } else {
        // No balances fetched successfully - keep stale state, just clear refreshing
        setBalanceCacheStatus(prev => ({ ...prev, isRefreshing: false }));
      }
    } catch (err: any) {
      console.error("Failed to refresh balances:", err);
      setBalanceCacheStatus(prev => ({ ...prev, isRefreshing: false }));
    } finally {
      isRefreshingRef.current = false;
    }
  }, [chains, storageInitialized, walletMode, softWallets, hardWallets]);

  const refreshTransactions = useCallback(async () => {
    if (wallets.length === 0 || chains.length === 0) return;
    
    setIsLoadingTransactions(true);
    try {
      const walletData = wallets.map(wallet => {
        const chain = chains.find(c => c.id === wallet.chainId);
        return {
          id: wallet.id,
          address: wallet.address,
          chainId: wallet.chainId,
          numericChainId: chain?.chainId || 0,
          chainSymbol: chain?.symbol || "ETH",
          blockExplorerUrl: chain?.blockExplorer,
        };
      });
      
      const explorerTxs = await fetchAllTransactions(walletData);
      
      const storedTxs = await clientStorage.getAllTransactions();
      const storedTxHashes = new Set(storedTxs.map(tx => tx.txHash).filter(Boolean));
      
      const newExplorerTxs = explorerTxs.filter(tx => !storedTxHashes.has(tx.txHash));
      
      const allTxs: Transaction[] = [
        ...storedTxs.map(tx => ({
          id: tx.id,
          walletId: tx.walletId,
          chainId: tx.chainId,
          type: tx.type as "send" | "receive",
          status: tx.status as "pending" | "confirmed" | "failed",
          amount: tx.amount,
          tokenSymbol: tx.tokenSymbol,
          toAddress: tx.toAddress,
          fromAddress: tx.fromAddress,
          txHash: tx.txHash || undefined,
          gasUsed: tx.gasUsed || undefined,
          timestamp: tx.timestamp,
        })),
        ...newExplorerTxs.map(tx => ({
          id: tx.id,
          walletId: tx.walletId,
          chainId: tx.chainId,
          type: tx.type,
          status: tx.status,
          amount: tx.amount,
          tokenSymbol: tx.tokenSymbol,
          toAddress: tx.toAddress,
          fromAddress: tx.fromAddress,
          txHash: tx.txHash,
          gasUsed: undefined,
          timestamp: tx.timestamp,
        })),
      ];
      
      allTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setTransactions(allTxs);
    } catch (err) {
      console.error("Failed to refresh transactions:", err);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [wallets, chains]);

  const hasWalletOnDevice = hardwareState.type === "raspberry_pi" ? hardwareWallet.hasWalletOnDevice() : true;

  const toggleAssetEnabled = useCallback(async (assetId: string, enabled: boolean) => {
    const updated = await clientStorage.toggleAsset(assetId, enabled);
    setEnabledAssetIds(new Set(updated));
  }, []);

  const refreshTopAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const assets = await fetchTopAssets(20);
      setTopAssets(assets);
      
      // Sync enabledAssetIds with new asset list
      // Keep only IDs that exist in the new assets, preserve user preferences
      const newAssetIds = new Set(assets.map(a => a.id));
      setEnabledAssetIds(prev => {
        const synced = new Set<string>();
        // Keep enabled IDs that still exist in the new assets
        for (const id of prev) {
          if (newAssetIds.has(id)) {
            synced.add(id);
          }
        }
        // If after sync we lost all enabled assets but had some before, re-enable all
        if (synced.size === 0 && prev.size > 0) {
          clientStorage.setEnabledAssets(newAssetIds);
          return newAssetIds;
        }
        // Persist the synced preferences if changed
        if (synced.size !== prev.size) {
          clientStorage.setEnabledAssets(synced);
        }
        return synced;
      });
    } catch (err) {
      console.error("Failed to refresh top assets:", err);
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  const enableAllAssets = useCallback(async () => {
    const allIds = new Set(topAssets.map(a => a.id));
    setEnabledAssetIds(allIds);
    await clientStorage.setEnabledAssets(allIds);
  }, [topAssets]);

  const disableAllAssets = useCallback(async () => {
    setEnabledAssetIds(new Set());
    await clientStorage.setEnabledAssets(new Set());
  }, []);

  const loadCustomTokens = useCallback(async () => {
    try {
      const tokens = await clientStorage.getCustomTokens();
      setCustomTokens(tokens);
    } catch (err) {
      console.error("Failed to load custom tokens:", err);
    }
  }, []);

  const addCustomToken = useCallback(async (token: Omit<CustomToken, 'id' | 'addedAt'>): Promise<CustomToken> => {
    const newToken = await clientStorage.addCustomToken(token);
    setCustomTokens(prev => {
      const existingIndex = prev.findIndex(t => t.id === newToken.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newToken;
        return updated;
      }
      return [...prev, newToken];
    });
    return newToken;
  }, []);

  const removeCustomToken = useCallback(async (id: string): Promise<void> => {
    await clientStorage.removeCustomToken(id);
    setCustomTokens(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (storageInitialized) {
      loadCustomTokens();
    }
  }, [storageInitialized, loadCustomTokens]);

  const loadCustomChains = useCallback(async () => {
    try {
      const chains = await clientStorage.getCustomChains();
      setCustomChains(chains);
    } catch (err) {
      console.error("Failed to load custom chains:", err);
    }
  }, []);

  const addCustomChain = useCallback(async (chain: Omit<CustomChain, 'id' | 'addedAt'>): Promise<CustomChain> => {
    const newChain = await clientStorage.addCustomChain(chain);
    setCustomChains(prev => {
      const existingIndex = prev.findIndex(c => c.id === newChain.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newChain;
        return updated;
      }
      return [...prev, newChain];
    });
    return newChain;
  }, []);

  const removeCustomChain = useCallback(async (id: string): Promise<void> => {
    await clientStorage.removeCustomChain(id);
    setCustomChains(prev => prev.filter(c => c.id !== id));
  }, []);

  useEffect(() => {
    if (storageInitialized) {
      loadCustomChains();
    }
  }, [storageInitialized, loadCustomChains]);

  const createAdditionalWallet = useCallback(async (label?: string) => {
    // Check unlock status based on wallet mode
    if (walletMode === "soft_wallet") {
      if (softWallet.getState().status !== "unlocked") {
        const errorMsg = "Wallet must be unlocked to create additional wallet";
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      const currentState = hardwareWallet.getState();
      if (currentState.status !== "unlocked") {
        const errorMsg = "Device must be unlocked to create additional wallet";
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    }

    setIsLoading(true);
    try {
      let mnemonic: string | null;
      if (walletMode === "soft_wallet") {
        mnemonic = softWallet.getSeedPhrase();
      } else {
        mnemonic = await hardwareWallet.getSeedPhraseFromDevice();
      }
      if (!mnemonic) {
        throw new Error("Cannot access seed phrase");
      }

      const currentChains = chains.length > 0 ? chains : DEFAULT_CHAINS.map((c, i) => ({
        ...c,
        id: `chain-${i}`,
      }));

      // Get current wallets from storage to find next account index
      const currentData = walletMode === "soft_wallet"
        ? await clientStorage.getSoftWalletData()
        : await clientStorage.getHardWalletData();

      const nextIndex = clientStorage.getNextAccountIndex(currentData);

      // Derive addresses for all chains with new account index
      const chainSymbols = currentChains.map(c => c.symbol);
      const derivedAddresses = await deriveAllAddresses(mnemonic, chainSymbols, nextIndex);

      // Create wallet objects with accountIndex and label
      const newWallets: Wallet[] = [];
      for (const derived of derivedAddresses) {
        const chain = currentChains.find(c => c.symbol === derived.chainSymbol);
        if (!chain || !derived.address) continue;

        const walletId = `wallet-${chain.id}-${derived.address.slice(0, 8)}-${nextIndex}`;

        const wallet: Wallet = {
          id: walletId,
          deviceId: walletMode === "soft_wallet" ? "soft" : "hard",
          chainId: chain.id,
          address: derived.address,
          balance: "0",
          isActive: true,
          accountIndex: nextIndex,
          label: label || `Wallet ${nextIndex + 1}`,
        };

        newWallets.push(wallet);
      }

      // Merge with existing wallets
      const mergedWallets = [...wallets, ...newWallets];
      setWallets(mergedWallets);

      // Save to mode-specific storage with accountIndex and label
      if (storageInitialized) {
        const storedWalletsForMode: StoredWallet[] = mergedWallets.map(w => {
          const chain = currentChains.find(c => c.id === w.chainId);
          return {
            id: w.id,
            address: w.address,
            chainId: w.chainId,
            chainName: chain?.name || "",
            chainSymbol: chain?.symbol || "",
            balance: w.balance,
            path: `m/44'/60'/${w.accountIndex ?? 0}'/0/0`,
            lastUpdated: new Date().toISOString(),
            accountIndex: w.accountIndex ?? 0,
            label: w.label,
          };
        });

        if (walletMode === "soft_wallet") {
          await clientStorage.saveSoftWalletData(storedWalletsForMode);
          setSoftWallets(mergedWallets);
        } else {
          await clientStorage.saveHardWalletData(storedWalletsForMode);
          setHardWallets(mergedWallets);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to create additional wallet");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [chains, wallets, walletMode, storageInitialized]);

  // Generate a new seed phrase (for UI to display before confirming)
  const generateNewSeedPhrase = useCallback((): string => {
    return softWallet.generateNewSeedPhrase();
  }, []);

  // Create a wallet with a completely new independent seed phrase
  const createWalletWithNewSeed = useCallback(async (label?: string, pin?: string): Promise<{ seedPhrase: string; walletGroupId: string }> => {
    if (walletMode !== "soft_wallet") {
      throw new Error("Independent seed wallets are only available in soft wallet mode");
    }
    
    if (!pin) {
      throw new Error("PIN is required to encrypt the new seed phrase");
    }

    setIsLoading(true);
    try {
      // Generate new seed phrase
      const newSeedPhrase = softWallet.generateNewSeedPhrase();
      const walletGroupId = `wallet-group-${Date.now()}`;

      // Encrypt and store the new seed
      const { encryptedSeed, pinHash, pinSalt } = await softWallet.encryptSeedForWalletGroup(
        newSeedPhrase,
        pin,
        walletGroupId
      );

      await clientStorage.saveWalletSeed({
        walletGroupId,
        encryptedSeed,
        pinHash,
        pinSalt,
        createdAt: new Date().toISOString(),
      });

      const currentChains = chains.length > 0 ? chains : DEFAULT_CHAINS.map((c, i) => ({
        ...c,
        id: `chain-${i}`,
      }));

      // Get current wallets to find next account index
      const currentData = await clientStorage.getSoftWalletData();
      const nextIndex = clientStorage.getNextAccountIndex(currentData);

      // Derive addresses for all chains with the new seed (accountIndex 0 for this seed)
      const chainSymbols = currentChains.map(c => c.symbol);
      const derivedAddresses = await deriveAllAddresses(newSeedPhrase, chainSymbols, 0);

      // Create wallet objects with the new walletGroupId
      const newWallets: Wallet[] = [];
      for (const derived of derivedAddresses) {
        const chain = currentChains.find(c => c.symbol === derived.chainSymbol);
        if (!chain || !derived.address) continue;

        const walletId = `wallet-${chain.id}-${derived.address.slice(0, 8)}-${nextIndex}`;

        const wallet: Wallet = {
          id: walletId,
          deviceId: "soft",
          chainId: chain.id,
          address: derived.address,
          balance: "0",
          isActive: true,
          accountIndex: nextIndex,
          label: label || `Wallet ${nextIndex + 1}`,
          walletGroupId,
        };

        newWallets.push(wallet);
      }

      // Merge with existing wallets
      const mergedWallets = [...wallets, ...newWallets];
      setWallets(mergedWallets);

      // Save to storage
      if (storageInitialized) {
        const storedWalletsForMode: StoredWallet[] = mergedWallets.map(w => {
          const chain = currentChains.find(c => c.id === w.chainId);
          return {
            id: w.id,
            address: w.address,
            chainId: w.chainId,
            chainName: chain?.name || "",
            chainSymbol: chain?.symbol || "",
            balance: w.balance,
            path: `m/44'/60'/${w.accountIndex ?? 0}'/0/0`,
            lastUpdated: new Date().toISOString(),
            accountIndex: w.accountIndex ?? 0,
            label: w.label,
            walletGroupId: w.walletGroupId,
          };
        });

        await clientStorage.saveSoftWalletData(storedWalletsForMode);
        setSoftWallets(mergedWallets);
      }

      return { seedPhrase: newSeedPhrase, walletGroupId };
    } catch (err: any) {
      setError(err.message || "Failed to create wallet with new seed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [chains, wallets, walletMode, storageInitialized]);

  return (
    <WalletContext.Provider
      value={{
        hardwareState,
        isConnected,
        isUnlocked,
        hasWalletOnDevice,
        walletMode,
        setWalletMode,
        hasSoftWalletSetup,
        hasHardWalletSetup,
        currentModeHasWallet,
        chains,
        wallets,
        setWallets,
        transactions,
        setTransactions,
        tokens,
        setTokens,
        selectedChainId,
        setSelectedChainId,
        showPinModal,
        setShowPinModal,
        pinAction,
        setPinAction,
        pendingTransaction,
        setPendingTransaction,
        connectLedger,
        connectRaspberryPi,
        connectSimulated,
        unlockWallet,
        lockWallet,
        disconnectDevice,
        deriveWallets,
        refreshBalances,
        refreshTransactions,
        resetSessionTimeout,
        isLoading,
        isLoadingTransactions,
        error,
        topAssets,
        enabledAssetIds,
        isLoadingAssets,
        toggleAssetEnabled,
        refreshTopAssets,
        enableAllAssets,
        disableAllAssets,
        createAdditionalWallet,
        createWalletWithNewSeed,
        generateNewSeedPhrase,
        selectedAccountIndex,
        setSelectedAccountIndex,
        availableAccounts,
        visibleWallets,
        customTokens,
        loadCustomTokens,
        addCustomToken,
        removeCustomToken,
        customChains,
        loadCustomChains,
        addCustomChain,
        removeCustomChain,
        balanceCacheStatus,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
