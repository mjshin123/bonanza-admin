import { mutationOptions } from "@tanstack/react-query";

export type AdminUser = { id: string; email: string };

export type AdminCredentials = {
  email: string;
  password: string;
};

export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  return null;
}

export function subscribeToAdminAuthState(
  listener: (user: AdminUser | null) => void,
) {
  queueMicrotask(() => listener(null));
  return () => undefined;
}

async function signInAdmin(_credentials: AdminCredentials): Promise<AdminUser> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function signOutAdmin(): Promise<void> {
  return;
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
