import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Play,
  ShieldCheck,
  LockKeyhole,
  ScanLine,
  Layers3,
  FileCheck2,
  Sparkles,
  Braces,
  GitPullRequest,
  Terminal,
  FileText,
  Crosshair,
  Box,
  ChevronRight,
} from "lucide-react";
import Header from "../components/Header";
import Brand from "../components/Brand";
import { useAuth } from "../lib/auth-context";
const features = [
  {
    icon: ScanLine,
    n: "01",
    name: "Multi-engine scanning",
    text: "Three trusted engines working together to uncover vulnerabilities and exposed secrets.",
    tag: "STATIC ANALYSIS",
    url: "/docs#engines",
  },
  {
    icon: Sparkles,
    n: "02",
    name: "AI-powered remediation",
    text: "Turn complex findings into clear explanations and actionable, developer-ready fixes.",
    tag: "INTELLIGENCE",
    url: "/demo/assistant",
  },
  {
    icon: FileText,
    n: "03",
    name: "Actionable reports",
    text: "Export detailed security reports, share findings, and keep a clear record of every scan.",
    tag: "REPORTING",
    url: "/demo/reports",
  },
];
export default function Landing() {
  const { email } = useAuth();
  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="hero-grid" />
          <div className="shell hero">
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="hero-badge">
                <span className="status-dot" />
                APPLICATION SECURITY INTELLIGENCE
              </div>
              <h1>
                Your code.
                <br />
                <span>Our intelligence.</span>
              </h1>
              <p>
                Find vulnerabilities, understand the risk, and ship secure code
                with AI-powered security analysis.
              </p>
              <div className="hero-actions">
                <Link
                  className="btn primary large"
                  to={email ? "/workspace" : "/login?mode=signup"}
                >
                  Start scanning <ArrowRight size={17} />
                </Link>
                <Link className="btn secondary large" to="/demo">
                  <Play size={14} />
                  Explore demo
                </Link>
              </div>
              <div className="hero-trust">
                <span>
                  <LockKeyhole />
                  Private by design
                </span>
                <i />
                <span>
                  <ShieldCheck />
                  No code execution
                </span>
              </div>
            </motion.div>
            <div className="core-scene">
              <img
                src="/images/analysis-core.webp"
                alt="An illuminated gold-edged analysis core suspended over a layered obsidian processor"
                fetchPriority="high"
              />
              <span className="coordinate c1">+</span>
              <span className="coordinate c2">+</span>
              <div className="figure-label">
                <span className="figure-line" />
                FIG. 01 <b>/</b> AETHER ANALYSIS CORE
              </div>
            </div>
          </div>
        </section>
        <section className="metrics-wrap" aria-label="Platform at a glance">
          <div className="shell metrics">
            {[
              { icon: Layers3, value: "03", label: "Scanning engines" },
              { icon: ShieldCheck, value: "100%", label: "Static analysis" },
              { icon: Braces, value: "AI", label: "Remediation guidance" },
              {
                icon: FileCheck2,
                value: "PDF + JSON",
                label: "Report exports",
              },
            ].map(({ icon: Icon, value, label }) => (
              <div className="metric" key={label}>
                <Icon />
                <div>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="shell capabilities" id="capabilities">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <i /> PLATFORM CAPABILITIES
              </div>
              <h2>Security, end to end.</h2>
            </div>
            <p>
              From the first scan to the final fix.
              <br />
              One connected security workspace.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, n, name, text, tag, url }) => (
              <Link className="feature" to={url} key={n}>
                <div className="feature-top">
                  <span className="feature-icon">
                    <Icon size={23} strokeWidth={1.5} />
                  </span>
                  <span className="feature-no">/ {n}</span>
                </div>
                <h3>{name}</h3>
                <p>{text}</p>
                <div className="feature-foot">
                  <span>{tag}</span>
                  <ArrowUpRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section id="workflow" className="workflow">
          <div className="shell">
            <div className="eyebrow">
              <i /> THE WORKFLOW
            </div>
            <h2>From source to solution.</h2>
            <div className="steps">
              {[
                {
                  i: Box,
                  t: "Upload your project",
                  d: "Add a Python project ZIP to your private workspace. Every archive is validated before analysis.",
                },
                {
                  i: Crosshair,
                  t: "Inspect real findings",
                  d: "Review scanner evidence, severity, and file locations. See exactly what each engine covered.",
                },
                {
                  i: GitPullRequest,
                  t: "Fix with confidence",
                  d: "Explore remediation guidance, track the fix, and export a report for your team.",
                },
              ].map(({ i: I, t, d }, n) => (
                <div key={t}>
                  <small>STEP 0{n + 1}</small>
                  <I />
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <Link className="text-link" to="/demo">
              Walk through the demo <ChevronRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="shell footer">
        <Brand />
        <span>Application security intelligence</span>
        <Link to="/docs">
          <Terminal size={14} />
          Documentation
        </Link>
      </footer>
    </>
  );
}
