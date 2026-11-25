import { mutationOptions } from "@tanstack/react-query";

import {
  AdminAuthError,
  completeInitialPasswordChange,
  DEMO_SEED_LOGIN_ID,
  DEMO_SEED_PASSWORD,
  getAdminSessionUser,
  resetDemoAdminAccounts,
  signInAdminAccount,
  signOutAdminAccount,
  subscribeAdminSession,
  type AdminSessionUser,
  type AdminSignInResult,
} from "@entities/admin-account";

export type AdminUser = AdminSessionUser;
export type { AdminSignInResult };

export type AdminCredentials = {
  loginId: string;
  password: string;
};

export type ChangeInitialPasswordInput = {
  loginId: string;
  initialPassword: string;
  newPassword: string;
};

export const demoAdminAccount = {
  loginId: DEMO_SEED_LOGIN_ID,
  password: DEMO_SEED_PASSWORD,
};
export { AdminAuthError, resetDemoAdminAccounts };

export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  return getAdminSessionUser();
}

export function subscribeToAdminAuthState(
  listener: (user: AdminUser | null) => void,
) {
  return subscribeAdminSession(listener);
}

async function signInAdmin(
  credentials: AdminCredentials,
): Promise<AdminSignInResult> {
  return signInAdminAccount(credentials);
}

async function signOutAdmin(): Promise<void> {
  signOutAdminAccount();
}

async function changeInitialPassword(
  input: ChangeInitialPasswordInput,
): Promise<AdminUser> {
  return completeInitialPasswordChange(input);
}

export function adminSignInMutationOptions() {
  return mutationOptions({
    mutationKey: ["admin-auth", "sign-in"],
    mutationFn: signInAdmin,
  });
}

export function adminSignOutMutationOptions() {
  return mutationOptions({
    mutationKey: ["admin-auth", "sign-out"],
    mutationFn: signOutAdmin,
  });
}

export function adminChangeInitialPasswordMutationOptions() {
  return mutationOptions({
    mutationKey: ["admin-auth", "change-initial-password"],
    mutationFn: changeInitialPassword,
  });
}
