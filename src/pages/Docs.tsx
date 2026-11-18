import Header from "../components/Header";
import { Link } from "react-router-dom";
import { ArrowRight, Download, BookOpen } from "lucide-react";
export default function Docs() {
  return (
    <>
      <Header />
      <main className="shell docs">
        <div className="eyebrow">
          <i /> DEVELOPER DOCUMENTATION
        </div>
        <h1>Platform field guide.</h1>
        <p className="lead">
          Everything you need to go from a project archive to a reviewed
          security report.
        </p>
        <div className="doc-layout">
          <aside>
            <BookOpen size={18} />
            <b>Contents</b>
            {[
              "Quick start",
              "Scanning engines",
              "Security model",
              "AI guidance",
              "Deployment",
              "Project files",
            ].map((n, i) => (
              <a
                key={n}
                href={
                  "#" +
                  ["start", "engines", "security", "ai", "deploy", "source"][i]
                }
              >
                {n}
              </a>
            ))}
          </aside>
          <div className="doc-content">
            <section id="start">
              <small>01 / GETTING STARTED</small>
              <h2>Quick start</h2>
              <ol>
                <li>Create an account and open your workspace.</li>
                <li>
                  Choose <b>New scan</b> and upload a Python project ZIP, or
                  select a bundled example.
                </li>
                <li>
                  Open a finding to see its location, explanation, and suggested
                  fix.
                </li>
                <li>
                  Track its review status and export your scan as PDF or JSON.
                </li>
              </ol>
              <Link className="text-link" to="/demo">
                Explore a recorded scan <ArrowRight size={15} />
              </Link>
            </section>
            <section id="engines">
              <small>02 / COVERAGE</small>
              <h2>Scanning engines</h2>
              <p>
                <b>Bandit</b> inspects the Python abstract syntax tree for
                common security issues. <b>Semgrep</b> applies bundled, offline
                Python rules. <b>detect-secrets</b> checks supported text files
                for potential credentials, without verifying them online.
              </p>
              <p>
                A report records each engine’s version, completion status, and
                finding count. A failed, unavailable, or timed-out engine makes
                the scan incomplete. A clean result is not a security guarantee.
              </p>
            </section>
            <section id="security">
              <small>03 / SAFEGUARDS</small>
              <h2>Security model</h2>
              <p>
                Archives are limited to 5 MiB compressed, 20 MiB expanded, 300
                entries, 1 MiB per file and a 100:1 compression ratio. Absolute
                paths, traversal, duplicate names, links, nested archives and
                encrypted entries are rejected. Only supported text files are
                scanned.
              </p>
              <p>
                Source is never imported, built, or executed. Engine
                configuration comes from the server, not the upload. Temporary
                files are removed after analysis; only redacted metadata is
                retained. Authenticated users can only access their own scans.
              </p>
            </section>
            <section id="ai">
              <small>04 / INTELLIGENCE</small>
              <h2>AI guidance</h2>
              <p>
                Review a finding and choose a question about its risk, fix, or
                verification. With a configured Gemini provider, only approved
                rule metadata and a selected question are sent. No source code,
                filenames, secrets, or account identifiers are shared. Without
                Gemini, the assistant labels its response as local rule
                guidance.
              </p>
            </section>
            <section id="deploy">
              <small>05 / OPERATIONS</small>
              <h2>Deployment</h2>
              <p>
                The Vercel demo includes genuine recorded scans, interactive
                findings, and downloadable reports. Fresh scans require the
                separate Python scanner service. The demo never substitutes
                recorded results for a new upload.
              </p>
              <p>
                Use SQLite and SQLAlchemy Core locally. The hosted configuration
                uses Supabase Auth and persistent PostgreSQL through an
                authorized Vercel API gateway. The project README includes exact
                commands, a Render Blueprint, CORS settings, and a complete
                environment-variable reference.
              </p>
            </section>
            <section id="source">
              <small>06 / DOWNLOADS</small>
              <h2>Project files</h2>
              <p>
                Download the frontend, Python service, tests, manifests,
                deployment setup, and both sample projects. No credentials or
                uploaded source files are included.
              </p>
              <a
                className="btn primary"
                href="/downloads/aetherops-source.zip"
                download
              >
                <Download size={16} />
                Download source
              </a>
              <div className="sample-downloads">
                <a href="/downloads/vulnerable-demo.zip" download>
                  Review sample ZIP ↓
                </a>
                <a href="/downloads/secure-demo.zip" download>
                  Secure sample ZIP ↓
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
