import { createFileRoute } from "@tanstack/react-router";

import { ApiTestPage, validateApiAdminSearch } from "@pages/api-test";

export const Route = createFileRoute("/")({
  component: ApiTestPage,
  validateSearch: validateApiAdminSearch,
});
