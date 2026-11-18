import { createClient } from "@supabase/supabase-js";
import type { Scan } from "./types";
export const backend = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const localAuth = import.meta.env.VITE_AUTH_MODE === "local";
export const supabase =
  !localAuth &&
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
export async function token() {
  return localAuth
    ? sessionStorage.getItem("aether-token")
    : (await supabase?.auth.getSession())?.data.session?.access_token;
}
export async function request(path: string, method = "GET", body?: unknown) {
  const t = await token();
  const isBinary = body instanceof Blob;
  const r = await fetch(path, {
    method,
    headers: {
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(body
        ? { "Content-Type": isBinary ? "application/zip" : "application/json" }
        : {}),
    },
    body: body ? (isBinary ? (body as Blob) : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(180000),
  });
  const data = await r.json().catch(() => {
    throw new Error(
      "The API is unavailable. Check the service connection and retry.",
    );
  });
  if (!r.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : data.error || "The request could not be completed.",
    );
  return data;
}
export const store = () => (localAuth ? backend + "/api/scans" : "/api/scans");
export async function examples(): Promise<Scan[]> {
  try {
    const x = await request(
      localAuth ? backend + "/api/examples" : "/api/examples",
    );
    if (!Array.isArray(x) || x.length !== 2 || x.some((s) => !s.id))
      throw Error();
    return x;
  } catch {
    const r = await fetch("/data/records.json");
    if (!r.ok) throw Error("Sample results could not be loaded.");
    return r.json();
  }
}
export function googleAuth() {
  if (!supabase) throw Error("Authentication is not configured.");
  const redirect = import.meta.env.VITE_GOOGLE_AUTH_PROXY,
    client = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!redirect || !client) {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + "/workspace" },
    });
  }
  const state = btoa(
    JSON.stringify({
      origin: location.origin,
      appName: "AetherOps",
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    }),
  );
  const popup = window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: client, redirect_uri: redirect, response_type: "code", scope: "openid email profile", prompt: "select_account", state })}`,
    "aether-google",
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      ? ""
      : "width=500,height=600",
  );
  if (!popup) throw Error("Allow pop-ups to continue with Google.");
  const handler = async (e: MessageEvent) => {
    if (e.source !== popup || e.origin !== new URL(redirect).origin) return;
    if (e.data?.type === "google-auth-denied") {
      window.removeEventListener("message", handler);
      return;
    }
    if (e.data?.type === "google-auth-success") {
      window.removeEventListener("message", handler);
      await supabase!.auth.setSession({
        access_token: e.data.access_token,
        refresh_token: e.data.refresh_token,
      });
    }
  };
  window.addEventListener("message", handler);
}
if (new URLSearchParams(location.hash.slice(1)).has("google_auth_popup"))
  supabase?.auth.getSession().then(({ data }) => {
    if (data.session) window.close();
  });
