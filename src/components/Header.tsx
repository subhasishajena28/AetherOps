import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  ScanLine,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";
import Brand from "./Brand";
import { useAuth } from "../lib/auth-context";
export default function Header() {
  const [menu, setMenu] = useState(false),
    [drop, setDrop] = useState(false);
  const { email } = useAuth();
  return (
    <header className="site-header">
      <div className="shell nav-shell">
        <Brand />
        <nav
          className={menu ? "top-nav mobile-open" : "top-nav"}
          aria-label="Main navigation"
        >
          <div className="drop-wrap">
            <button
              className={"nav-link " + (drop ? "active" : "")}
              onClick={() => setDrop(!drop)}
              aria-expanded={drop}
            >
              Platform <ChevronDown size={12} />
            </button>
            {drop && (
              <>
                <button
                  className="dismiss"
                  aria-label="Close platform menu"
                  onClick={() => setDrop(false)}
                />
                <div
                  className="dropdown"
                  onClick={() => {
                    setDrop(false);
                    setMenu(false);
                  }}
                >
                  <a href="/#capabilities">
                    <ScanLine size={16} />
                    Platform capabilities
                  </a>
                  <Link to="/demo">
                    <LayoutDashboard size={16} />
                    Demo workspace
                  </Link>
                  <Link to="/docs">
                    <BookOpen size={16} />
                    Security model
                  </Link>
                </div>
              </>
            )}
          </div>
          <a href="/#workflow" onClick={() => setMenu(false)}>
            How it works
          </a>
          <Link to="/docs">Documentation</Link>
        </nav>
        <div className="nav-actions">
          {!email && (
            <Link className="sign-link" to="/login">
              Sign in
            </Link>
          )}
          <Link
            className="btn primary nav-cta"
            to={email ? "/workspace" : "/login?mode=signup"}
          >
            {email ? "Workspace" : "Get started"}
            <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-toggle icon-btn"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
