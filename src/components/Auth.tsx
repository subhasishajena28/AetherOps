import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase, localAuth, backend, request } from "../lib/client";
import { Context, useAuth } from "../lib/auth-context";
export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  function sync(): Promise<void> {
    const identity = localAuth
      ? sessionStorage.getItem("aether-token")
        ? request(backend + "/api/me").then((x) => x.email)
        : Promise.resolve(null)
      : Promise.resolve(supabase?.auth.getSession()).then(
          (r) => r?.data.session?.user.email || null,
        );
    return identity
      .then((value) => setEmail(value))
      .catch(() => setEmail(null))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    sync();
    if (localAuth) return;
    const sub = supabase?.auth.onAuthStateChange((_e, s) => {
      setEmail(s?.user.email || null);
      setLoading(false);
    });
    return () => sub?.data.subscription.unsubscribe();
  }, []);
  async function logout() {
    if (localAuth) {
      await request(backend + "/api/logout", "POST");
      sessionStorage.removeItem("aether-token");
    } else {
      const r = await supabase?.auth.signOut();
      if (r?.error) throw r.error;
    }
    setEmail(null);
  }
  return (
    <Context.Provider value={{ email, loading, sync, logout }}>
      {children}
    </Context.Provider>
  );
}
export function Protected({ children }: { children: ReactNode }) {
  const a = useAuth();
  return a.loading ? (
    <div className="loading full">Opening your workspace…</div>
  ) : a.email ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}
