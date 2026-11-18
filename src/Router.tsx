import {
  BrowserRouter,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider, Protected } from "./components/Auth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Docs from "./pages/Docs";
import { useAuth } from "./lib/auth-context";
const Workspace = lazy(() => import("./pages/Workspace"));
import Brand from "./components/Brand";
function WorkspacePage({ demo = false }: { demo?: boolean }) {
  const { pathname } = useLocation();
  const { email } = useAuth();
  return (
    <Suspense fallback={<div className="loading">Opening workspace…</div>}>
      <Workspace key={pathname + (demo ? "public" : email)} demo={demo} />
    </Suspense>
  );
}
function Scroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash)
      setTimeout(
        () => document.getElementById(hash.slice(1))?.scrollIntoView(),
        30,
      );
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
export default function Router() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Scroll />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/docs" element={<Docs />} />
          <Route
            path="/demo/:view?/:scanId?"
            element={<WorkspacePage demo />}
          />
          <Route
            path="/workspace/:view?/:scanId?"
            element={
              <Protected>
                <WorkspacePage />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <div className="not-found">
                <Brand />
                <h1>Page not found.</h1>
                <Link to="/" className="btn primary">
                  Return home
                </Link>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
