import { mutationOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@shared/api/supabase";

export type AdminCredentials = {
  email: string;
  password: string;
};

const isDevAuthBypassEnabled =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";
const isDemoAuthBypassEnabled = import.meta.env.VITE_DEMO_MODE === "true";
const isAuthBypassEnabled =
  isDevAuthBypassEnabled || isDemoAuthBypassEnabled;

const devBypassUser = {
  id: "dev-bypass-admin",
  aud: "authenticated",
  role: "authenticated",
  email: "dev-admin@local.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "development", providers: ["development"] },
  user_metadata: { display_name: "Development Admin" },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as User;

export async function getCurrentAdminUser(): Promise<User | null> {
  if (isAuthBypassEnabled) {
    return devBypassUser;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session?.user ?? null;
}

export function subscribeToAdminAuthState(
  listener: (user: User | null) => void,
) {
  if (isAuthBypassEnabled) {
    queueMicrotask(() => listener(devBypassUser));
    return () => undefined;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

async function signInAdmin(credentials: AdminCredentials): Promise<User> {
  if (isAuthBypassEnabled) {
    return devBypassUser;
  }

  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }

  return data.user;
}

async function signOutAdmin(): Promise<void> {
  if (isAuthBypassEnabled) {
    return;
  }

  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    throw error;
  }
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
