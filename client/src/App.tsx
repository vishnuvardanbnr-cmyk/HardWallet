import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/lib/theme-context";
import { WalletProvider } from "@/lib/wallet-context";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { HardwareStatus } from "@/components/hardware-status";
import { PinModal } from "@/components/pin-modal";

import Dashboard from "@/pages/dashboard";
import Transfer from "@/pages/transfer";
import Chains from "@/pages/chains";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import SetupGuide from "@/pages/setup-guide";
import WalletDetail from "@/pages/wallet-detail";
import ManageCrypto from "@/pages/manage-crypto";
import DApps from "@/pages/dapps";
import DAppBrowser from "@/pages/dapp-browser";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/wallet/:chainId" component={WalletDetail} />
      <Route path="/transfer" component={Transfer} />
      <Route path="/chains" component={Chains} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/setup" component={SetupGuide} />
      <Route path="/manage-crypto" component={ManageCrypto} />
      <Route path="/dapps" component={DApps} />
      <Route path="/dapp-browser" component={DAppBrowser} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WalletProvider>
          <TooltipProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-1 flex-col overflow-hidden">
                  <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex items-center gap-2">
                      <HardwareStatus />
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <PinModal />
            <Toaster />
          </TooltipProvider>
        </WalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
