import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth, SignIn } from "@clerk/react";
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

const CLERK_CONFIGURED = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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

function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <span className="text-xl font-semibold text-gray-900">VoiceFlow AI</span>
        </div>
        <SignIn routing="hash" />
      </div>
    </div>
  );
}

function ClerkAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) return <LoginScreen />;

  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!CLERK_CONFIGURED) return <>{children}</>;
  return <ClerkAuthGuard>{children}</ClerkAuthGuard>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard>
            <Router />
          </AuthGuard>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
