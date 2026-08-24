import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import {
  getCurrentAdminUser,
  subscribeToAdminAuthState,
} from "../api/adminAuth";

type AdminSessionState = {
  error: Error | null;
  isLoading: boolean;
  user: User | null;
};

export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({
    error: null,
    isLoading: true,
    user: null,
  });

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAdminAuthState((user) => {
      if (!isMounted) {
        return;
      }

      setState({
        error: null,
        isLoading: false,
        user,
      });
    });

    void getCurrentAdminUser()
      .then((user) => {
        if (!isMounted) {
          return;
        }

        setState({
          error: null,
          isLoading: false,
          user,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setState({
          error:
            error instanceof Error
              ? error
              : new Error("세션을 확인하지 못했습니다."),
          isLoading: false,
          user: null,
        });
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
