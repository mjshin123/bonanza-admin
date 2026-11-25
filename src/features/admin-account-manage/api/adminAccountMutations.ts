import { mutationOptions } from "@tanstack/react-query";

import {
  createAdminAccount,
  resetAdminPassword,
  suspendAdminAccount,
} from "@entities/admin-account";

export type CreateAdminAccountInput = { loginId: string };
export type CreateAdminAccountResult = {
  loginId: string;
  initialPassword: string;
};

async function create(
  input: CreateAdminAccountInput,
): Promise<CreateAdminAccountResult> {
  const { account, initialPassword } = createAdminAccount(input);
  return { loginId: account.loginId, initialPassword };
}

async function reset(input: {
  id: string;
}): Promise<CreateAdminAccountResult> {
  const { account, initialPassword } = resetAdminPassword(input);
  return { loginId: account.loginId, initialPassword };
}

export const suspendAdminAccountMutationOptions = () =>
  mutationOptions({
    mutationKey: ["admin-accounts", "suspend"],
    mutationFn: async (input: { id: string; suspended: boolean }) =>
      suspendAdminAccount(input),
  });

export const resetAdminPasswordMutationOptions = () =>
  mutationOptions({
    mutationKey: ["admin-accounts", "reset-password"],
    mutationFn: reset,
  });

export const createAdminAccountMutationOptions = () =>
  mutationOptions({
    mutationKey: ["admin-accounts", "create"],
    mutationFn: create,
  });
