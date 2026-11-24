import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { DialogHost } from "@shared/ui";

import type { RouterContext } from "../router/router";

function RootComponent() {
  return (
    <>
      <Outlet />
      <DialogHost />
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});
