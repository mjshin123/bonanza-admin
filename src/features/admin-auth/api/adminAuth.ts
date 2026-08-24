import { mutationOptions } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@shared/api/supabase";

export type AdminCredentials = {
  email: string;
  password: string;
};

export async function getCurrentAdminUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session?.user ?? null;
}

export function subscribeToAdminAuthState(
  listener: (user: User | null) => void,
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

async function signInAdmin(credentials: AdminCredentials): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    throw error;
  }

  return data.user;
}

async function signOutAdmin(): Promise<void> {
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
