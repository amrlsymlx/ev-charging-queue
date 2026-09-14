import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { supabase } from "./supabase";

// Route params (e.g. sa/dashboard's old saName/role) are never trusted for
// access control — anyone can set them by navigating to a URL directly.
// This round-trips to Supabase Auth to confirm a real signed-in session
// with an allowed role exists before the screen renders anything, matching
// the pattern already used in admin/dashboard.tsx and sa/dashboard.tsx.
export function useRequireRole(allowedRoles: string[], loginRoute: string) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user;
      const role = user?.app_metadata?.role || user?.user_metadata?.role;
      const ok = !error && !!user && allowedRoles.includes(role);

      if (cancelled) return;

      if (!ok) {
        router.replace(loginRoute as any);
        return;
      }

      setAuthorized(true);
      setCheckingAuth(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checkingAuth, authorized };
}
