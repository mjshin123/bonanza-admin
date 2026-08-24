import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { queryClient } from "../providers/queryClient";
import { routeTree } from "../routeTree.gen";

export type RouterContext = { queryClient: QueryClient };

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
