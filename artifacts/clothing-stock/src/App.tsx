import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { Layout } from "@/components/layout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import AllStock from "@/pages/all-stock";
import LowStock from "@/pages/low-stock";
import Settings from "@/pages/settings";
import AddArticle from "@/pages/add-article";
import EditArticle from "@/pages/edit-article";
import ArticleDetail from "@/pages/article-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-r-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <Layout>
      <Component {...rest} />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {(params) => <ProtectedRoute component={Dashboard} {...params} />}
      </Route>
      <Route path="/all-stock">
        {(params) => <ProtectedRoute component={AllStock} {...params} />}
      </Route>
      <Route path="/low-stock">
        {(params) => <ProtectedRoute component={LowStock} {...params} />}
      </Route>
      <Route path="/settings">
        {(params) => <ProtectedRoute component={Settings} {...params} />}
      </Route>
      <Route path="/add-article">
        {(params) => <ProtectedRoute component={AddArticle} {...params} />}
      </Route>
      <Route path="/articles/:id/edit">
        {(params) => <ProtectedRoute component={EditArticle} {...params} />}
      </Route>
      <Route path="/articles/:id">
        {(params) => <ProtectedRoute component={ArticleDetail} {...params} />}
      </Route>
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
        <Toaster position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
