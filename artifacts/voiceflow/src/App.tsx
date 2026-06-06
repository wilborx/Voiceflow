import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import AgentsPage from "@/pages/agents";
import AgentNewPage from "@/pages/agent-new";
import AgentDetailPage from "@/pages/agent-detail";
import CallsPage from "@/pages/calls";
import CallDetailPage from "@/pages/call-detail";
import AnalyticsPage from "@/pages/analytics";
import IntegrationsPage from "@/pages/integrations";
import BillingPage from "@/pages/billing";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/agents/new" component={AgentNewPage} />
      <Route path="/agents/:id" component={AgentDetailPage} />
      <Route path="/agents" component={AgentsPage} />
      <Route path="/calls/:id" component={CallDetailPage} />
      <Route path="/calls" component={CallsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
