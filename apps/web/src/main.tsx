import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/600.css";
import "@fontsource/literata/400-italic.css";
import { ApiProblem } from "./lib/api";
import { applyTheme, storedTheme } from "./lib/theme";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => n < 2 && e instanceof ApiProblem && e.status === 0,
    },
    mutations: { retry: 0 },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

applyTheme(storedTheme());
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(storedTheme()));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
