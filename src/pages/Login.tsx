import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import Brand from "../components/Brand";
import { useAuth } from "../lib/auth-context";
import {
  supabase,
  localAuth,
  backend,
  request,
  googleAuth,
} from "../lib/client";
export default function Login() {
  const [params, set] = useSearchParams();
  const signup = params.get("mode") === "signup";
  const a = useAuth();
  const [email, setEmail] = useState(""),
    [pass, setPass] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState("");
  if (a.email) return <Navigate to="/workspace" replace />;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      if (localAuth) {
        const r = await request(
          backend + "/api/auth/" + (signup ? "signup" : "login"),
          "POST",
          { email, password: pass },
        );
        sessionStorage.setItem("aether-token", r.token);
      } else {
        if (!supabase)
          throw Error(
            "Authentication is not configured. You can still explore the public demo.",
          );
        const { data, error } = signup
          ? await supabase.auth.signUp({ email, password: pass })
          : await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        if (!data.session)
          setMsg("Check your email to confirm your account, then sign in.");
      }
      await a.sync();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="shell auth-nav">
        <Brand />
        <Link to="/" className="back">
          <ArrowLeft size={15} />
          Back to home
        </Link>
      </div>
      <div className="auth-layout">
        <div className="auth-art">
          <img src="/images/analysis-core.webp" alt="Aether analysis core" />
          <div className="eyebrow">PRIVATE SECURITY WORKSPACE</div>
          <h2>
            Your code.
            <br />
            <span className="gold">Your control.</span>
          </h2>
        </div>
        <div className="auth-card">
          <div className="feature-icon">
            <LockKeyhole />
          </div>
          <div className="eyebrow">WORKSPACE ACCESS</div>
          <h1>{signup ? "Create your workspace." : "Welcome back."}</h1>
          <p>
            {signup
              ? "Start analyzing your code in a private workspace."
              : "Sign in to your application security workspace."}
          </p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <div className="pass-input">
                <input
                  type={show ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={signup ? 10 : 1}
                  maxLength={128}
                  placeholder={
                    signup ? "At least 10 characters" : "Enter your password"
                  }
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {err && (
              <div className="error" role="alert">
                {err}
              </div>
            )}
            {msg && (
              <div className="notice" role="status">
                {msg}
              </div>
            )}
            <button className="btn primary full" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create workspace" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          {!localAuth && (
            <>
              <div className="or">or continue with</div>
              <button
                className="btn secondary full"
                onClick={async () => {
                  try {
                    await googleAuth();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                }}
              >
                <b className="google-g">G</b>Google
              </button>
            </>
          )}
          <p className="auth-switch">
            {signup ? "Already have an account?" : "New to AetherOps?"}{" "}
            <button
              onClick={() => {
                set(signup ? {} : { mode: "signup" });
                setErr("");
                setMsg("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <Link className="demo-link" to="/demo">
            <ShieldCheck size={15} />
            Explore the demo without an account <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
