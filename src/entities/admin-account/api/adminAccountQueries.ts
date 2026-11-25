import { queryOptions } from "@tanstack/react-query";

import { listAdminAccounts, type AdminAccountDto } from "./adminAccountStore";

export type { AdminAccountDto };

export const adminAccountQueryKeys = { all: ["admin-accounts"] as const };

export const adminAccountsQueryOptions = () =>
  queryOptions({
    queryKey: adminAccountQueryKeys.all,
    queryFn: async () => listAdminAccounts(),
  });
