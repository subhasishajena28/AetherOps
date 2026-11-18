import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  LayoutDashboard,
  History,
  ShieldAlert,
  Sparkles,
  Files,
  Plus,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  FolderArchive,
  Search,
  FileJson,
  FileText,
  ShieldCheck,
  ScanLine,
  CheckCircle2,
  Terminal,
  Trash2,
  BookOpen,
  Menu,
  X,
  Layers3,
  RefreshCw,
  CornerDownRight,
  Send,
  LoaderCircle,
} from "lucide-react";
import Brand from "../components/Brand";
import Modal from "../components/Modal";
import ScanDialog from "../components/ScanDialog";
import { useAuth } from "../lib/auth-context";
import { examples, request, store, backend, localAuth } from "../lib/client";
import { exportReport } from "../lib/reports";
import { type Scan, type Finding, formatDate } from "../lib/types";
const views = [
  { id: "overview", name: "Overview", i: LayoutDashboard },
  { id: "history", name: "Scan history", i: History },
  { id: "findings", name: "Vulnerabilities", i: ShieldAlert },
  { id: "assistant", name: "AI assistant", i: Sparkles },
  { id: "reports", name: "Reports", i: Files },
];
export default function Workspace({ demo = false }: { demo?: boolean }) {
  const { view = "overview", scanId } = useParams();
  const nav = useNavigate(),
    a = useAuth(),
    base = demo ? "/demo" : "/workspace";
  const [scans, setScans] = useState<Scan[]>([]),
    [samples, setSamples] = useState<Scan[]>([]),
    [loading, setLoading] = useState(true),
    [err, setErr] = useState(""),
    [dialog, setDialog] = useState(false),
    [mobile, setMobile] = useState(false),
    [filter, setFilter] = useState("All severities"),
    [query, setQuery] = useState(""),
    [opened, setOpened] = useState<{ s: Scan; f: Finding } | null>(null),
    [del, setDel] = useState<Scan | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const refresh = useCallback(
    () =>
      Promise.all([examples(), demo ? Promise.resolve(null) : request(store())])
        .then(([eg, data]) => {
          setSamples(eg);
          setScans(data || eg);
          setErr("");
        })
        .catch((e: Error) => setErr(e.message))
        .finally(() => setLoading(false)),
    [demo],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  const selected = scans.find((s) => s.id === scanId),
    all = scans.flatMap((s) => s.findings.map((f) => ({ s, f }))),
    rows =
      view === "scan"
        ? (selected?.findings || []).map((f) => ({ s: selected!, f }))
        : all;
  const visible = rows.filter(
    ({ f }) =>
      (filter === "All severities" || f.severity === filter) &&
      (f.title + " " + f.file + " " + f.rule)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function go(v: string) {
    nav(base + (v === "overview" ? "" : "/" + v));
  }
  async function action(fn: () => Promise<void>) {
    setErr("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const download = (s: Scan, fmt: "pdf" | "json") =>
    action(async () => {
      await exportReport(s, fmt);
      setNotice(fmt.toUpperCase() + " report downloaded.");
    });
  const chart = ["High", "Medium", "Low"].map((name) => ({
    name,
    count: all.filter(({ f }) => f.severity === name).length,
  }));
  const scanTable = (arr: Scan[]) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Coverage</th>
            <th>Findings</th>
            <th>Analyzed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {arr.map((s) => (
            <tr key={s.id}>
              <td>
                <button
                  className="table-project"
                  onClick={() => go("scan/" + s.id)}
                >
                  <FolderArchive size={16} />
                  {s.project}
                </button>
              </td>
              <td>
                <span
                  className={
                    "pill " + (s.status === "Complete" ? "green" : "medium")
                  }
                >
                  {s.status}
                </span>
              </td>
              <td>{s.findings.length}</td>
              <td>{formatDate(s.created_at)}</td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={"Open " + s.project}
                  onClick={() => go("scan/" + s.id)}
                >
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!arr.length && (
        <Empty
          title={query ? "No matching projects" : "No scans yet"}
          desc={
            query
              ? "Try another project name or clear the search."
              : "Analyze a Python archive or add a genuine sample scan."
          }
          onClick={() => setDialog(true)}
        />
      )}
    </div>
  );
  return (
    <div className="app-frame">
      <aside className={"sidebar " + (mobile ? "sidebar-open" : "")}>
        <Brand />
        <div className="workspace-tag">
          <span className="status-dot" />
          {demo ? "DEMO WORKSPACE" : "PRIVATE WORKSPACE"}
        </div>
        <small className="nav-label">WORKSPACE</small>
        <nav>
          {views.map(({ id, name, i: I }) => (
            <Link
              className={
                view === id || (view === "scan" && id === "history")
                  ? "side-link current"
                  : "side-link"
              }
              key={id}
              to={base + (id === "overview" ? "" : "/" + id)}
            >
              <I size={17} />
              {name}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <Link to="/docs" className="side-link">
            <BookOpen size={16} />
            Documentation
          </Link>
          <Link to="/" className="side-link">
            <ArrowUpRight size={16} />
            Back to website
          </Link>
          <div className="account-block">
            <span className="avatar">
              {demo ? "D" : a.email?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{demo ? "Demo explorer" : "Personal account"}</b>
              <small>{demo ? "Read-only access" : a.email}</small>
            </div>
            {!demo && (
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={() =>
                  action(async () => {
                    await a.logout();
                    nav("/");
                  })
                }
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <div className="workspace-top">
          <button
            className="mobile-toggle icon-btn"
            aria-label="Toggle workspace navigation"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
          <span>AetherOps</span>
          <ChevronRight size={13} />
          <b>{demo ? "Demo workspace" : "My workspace"}</b>
          <div className="top-right">
            <ShieldCheck size={14} /> Private by design
          </div>
        </div>
        <main className="workspace-body">
          <div className="eyebrow">
            <i /> APPLICATION SECURITY
          </div>
          <div className="workspace-heading">
            <div>
              <h1>
                {view === "scan"
                  ? selected?.project || "Scan details"
                  : views.find((x) => x.id === view)?.name === "Overview"
                    ? "Security overview"
                    : views.find((x) => x.id === view)?.name || "Workspace"}
              </h1>
              <p>
                {view === "overview"
                  ? "Your projects, findings, and security posture at a glance."
                  : view === "history"
                    ? "A complete record of your project analysis."
                    : view === "findings"
                      ? "Inspect, prioritize, and track your security findings."
                      : view === "assistant"
                        ? "Understand your findings and take the next safe step."
                        : view === "reports"
                          ? "Portable evidence from your security scans."
                          : "Review real findings and engine coverage."}
              </p>
            </div>
            <button className="btn primary" onClick={() => setDialog(true)}>
              <Plus size={16} />
              {demo ? "Explore sample" : "New scan"}
            </button>
          </div>
          {demo && (
            <div className="demo-banner">
              <Terminal size={16} />
              <span>
                <b>Demo workspace</b> · Genuine, recorded scan results. No
                account required.
              </span>
              <Link to="/login?mode=signup">
                Create workspace <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {err && (
            <div className="error" role="alert">
              {err} <button onClick={refresh}>Retry</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon-btn"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Loading workspace…
            </div>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="stat-grid">
                    {(
                      [
                        [Layers3, scans.length, "Total scans"],
                        [ShieldAlert, all.length, "Total findings"],
                        [
                          ScanLine,
                          all.filter(
                            ({ s, f }) => s.triage?.[f.id] !== "Resolved",
                          ).length,
                          "Open findings",
                        ],
                        [
                          CheckCircle2,
                          scans.filter((s) => s.status === "Complete").length,
                          "Complete scans",
                        ],
                      ] as const
                    ).map(([I, n, label]) => (
                      <div className="stat-card" key={label}>
                        <I size={19} />
                        <strong>{n}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <div className="panel">
                      <div className="panel-head">
                        <h3>Findings by severity</h3>
                        <span className="micro">ALL SCANS</span>
                      </div>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={chart}
                            margin={{
                              top: 12,
                              right: 16,
                              left: -24,
                              bottom: 0,
                            }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 5"
                              vertical={false}
                              stroke="#2a2b2b"
                            />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#a6a7aa", fontSize: 12 }}
                            />
                            <YAxis
                              allowDecimals={false}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#777", fontSize: 10 }}
                            />
                            <Tooltip
                              cursor={{ fill: "#242426" }}
                              contentStyle={{
                                background: "#191a1c",
                                border: "1px solid #45413a",
                                borderRadius: "6px",
                              }}
                            />
                            <Bar
                              dataKey="count"
                              name="Findings"
                              radius={[3, 3, 0, 0]}
                              barSize={42}
                            >
                              {chart.map((s, i) => (
                                <Cell
                                  key={s.name}
                                  fill={["#d77965", "#d6b16b", "#7f9d9a"][i]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="panel engine-panel">
                      <div className="panel-head">
                        <h3>Engine coverage</h3>
                        <ScanLine size={16} />
                      </div>
                      {["Bandit", "Semgrep", "detect-secrets"].map((n) => (
                        <div className="engine-row" key={n}>
                          <span className="mini-icon">
                            <Terminal size={16} />
                          </span>
                          <div>
                            <b>{n}</b>
                            <small>
                              {
                                scans.filter((s) =>
                                  s.engines.some(
                                    (e) =>
                                      e.name === n && e.status === "Complete",
                                  ),
                                ).length
                              }{" "}
                              completed scans
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="panel">
                    <div className="panel-head">
                      <h3>Recent scans</h3>
                      <button
                        className="text-link"
                        onClick={() => go("history")}
                      >
                        View history <ArrowRight size={14} />
                      </button>
                    </div>
                    {scanTable(scans.slice(0, 4))}
                  </div>
                </>
              )}
              {view === "history" && (
                <div className="panel">
                  <div className="panel-head">
                    <h3>
                      Project scans <small>{scans.length}</small>
                    </h3>
                    <button
                      className="icon-btn"
                      aria-label="Refresh scans"
                      onClick={refresh}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                  <div className="filter-row">
                    <Search size={16} />
                    <input
                      aria-label="Search projects"
                      placeholder="Search projects…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {scanTable(
                    scans.filter((s) =>
                      s.project.toLowerCase().includes(query.toLowerCase()),
                    ),
                  )}
                </div>
              )}
              {view === "scan" && selected && (
                <div className="panel detail-summary">
                  <div className="panel-head">
                    <h3>Analysis manifest</h3>
                    <span className="pill">{selected.origin}</span>
                  </div>
                  <p>
                    {formatDate(selected.created_at)} · {selected.files} files
                    analyzed · {selected.duration}s · {selected.skipped}{" "}
                    excluded
                  </p>
                  <div className="engine-list">
                    {selected.engines.map((e) => (
                      <div key={e.name}>
                        <b>{e.name}</b>
                        <span
                          className={
                            "pill " +
                            (e.status === "Complete" ? "green" : "medium")
                          }
                        >
                          {e.status}
                        </span>
                        <small>
                          v{e.version} · {e.count} findings
                        </small>
                        {e.note && <small>{e.note}</small>}
                      </div>
                    ))}
                  </div>
                  <div className="inline-actions">
                    <button
                      className="btn secondary small"
                      onClick={() => download(selected, "pdf")}
                    >
                      <FileText size={14} />
                      PDF report
                    </button>
                    <button
                      className="btn secondary small"
                      onClick={() => download(selected, "json")}
                    >
                      <FileJson size={14} />
                      JSON export
                    </button>
                    {!demo && (
                      <button
                        className="btn danger small"
                        onClick={() => setDel(selected)}
                      >
                        <Trash2 size={14} />
                        Delete scan
                      </button>
                    )}
                  </div>
                </div>
              )}
              {(view === "findings" || (view === "scan" && selected)) && (
                <div className="panel">
                  <div className="panel-head">
                    <h3>
                      Security findings <small>{rows.length}</small>
                    </h3>
                  </div>
                  <div className="filter-row">
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search findings"
                      placeholder="Search findings or files…"
                    />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      aria-label="Filter severity"
                    >
                      {["All severities", "High", "Medium", "Low"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="finding-list">
                    {visible.map(({ s, f }) => (
                      <button
                        key={s.id + f.id}
                        onClick={() => setOpened({ s, f })}
                      >
                        <span
                          className={
                            "pill severity " + f.severity.toLowerCase()
                          }
                        >
                          {f.severity}
                        </span>
                        <span>
                          <b>{f.title}</b>
                          <small>
                            {s.project} / {f.file}:{f.line} · {f.engine}
                          </small>
                        </span>
                        <em>{s.triage?.[f.id] || "Open"}</em>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    {!visible.length && (
                      <Empty
                        title={
                          rows.length
                            ? "No matching findings"
                            : selected?.status === "Partial"
                              ? "Analysis incomplete"
                              : "No findings reported"
                        }
                        desc={
                          rows.length
                            ? "Change your search or severity filter."
                            : "Review engine coverage before drawing conclusions."
                        }
                      />
                    )}
                  </div>
                </div>
              )}
              {view === "scan" && !selected && (
                <Empty
                  title="Scan not found"
                  desc="This project is not available in this workspace."
                />
              )}
              {view === "reports" && (
                <div className="report-grid">
                  {scans.map((s) => (
                    <div className="panel report-card" key={s.id}>
                      <span className="feature-icon">
                        <FileText size={22} />
                      </span>
                      <small className="micro">SECURITY REPORT</small>
                      <h3>{s.project}</h3>
                      <p>
                        {formatDate(s.created_at)} · {s.findings.length}{" "}
                        findings
                      </p>
                      <div className="inline-actions">
                        <button
                          className="btn primary small"
                          onClick={() => download(s, "pdf")}
                        >
                          Export PDF
                        </button>
                        <button
                          className="btn secondary small"
                          onClick={() => download(s, "json")}
                        >
                          Export JSON
                        </button>
                      </div>
                    </div>
                  ))}
                  {!scans.length && (
                    <Empty
                      title="No reports yet"
                      desc="Complete a scan to generate your first report."
                      onClick={() => setDialog(true)}
                    />
                  )}
                </div>
              )}
              {view === "assistant" && <Assistant scans={scans} demo={demo} />}
            </>
          )}
        </main>
      </div>
      {dialog && (
        <ScanDialog
          demo={demo}
          samples={samples}
          onClose={() => setDialog(false)}
          done={(s) => {
            setDialog(false);
            if (!demo) refresh();
            go("scan/" + s.id);
          }}
        />
      )}
      {opened && (
        <Modal title={opened.f.title} onClose={() => setOpened(null)}>
          <div className="finding-meta">
            <span className={"pill " + opened.f.severity.toLowerCase()}>
              {opened.f.severity}
            </span>
            <span>
              {opened.f.engine} / {opened.f.rule}
            </span>
          </div>
          <div className="source-line">
            <Terminal size={15} />
            {opened.f.file}:{opened.f.line}
          </div>
          <h4>What this means</h4>
          <p>{opened.f.explanation}</p>
          <h4>Recommended fix</h4>
          <p>{opened.f.fix}</p>
          {opened.f.pattern && <pre>{opened.f.pattern}</pre>}
          <label className="status-select">
            Review status
            <select
              disabled={demo || busy}
              value={
                scans.find((s) => s.id === opened.s.id)?.triage?.[
                  opened.f.id
                ] || "Open"
              }
              onChange={(e) =>
                action(async () => {
                  await request(store(), "PUT", {
                    id: opened.s.id,
                    finding: opened.f.id,
                    status: e.target.value,
                  });
                  await refresh();
                })
              }
            >
              {["Open", "In review", "Resolved"].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          {demo && (
            <small className="muted">
              Demo findings are read-only. Add a sample to your private
              workspace to triage it.
            </small>
          )}
          {err && <p className="error">{err}</p>}
          <button
            className="btn secondary full"
            onClick={() => {
              const id = opened.s.id + ":" + opened.f.id;
              setOpened(null);
              nav(base + "/assistant?finding=" + encodeURIComponent(id));
            }}
          >
            <Sparkles size={15} />
            Explore with assistant
          </button>
        </Modal>
      )}
      {del && (
        <Modal title="Delete this scan?" onClose={() => setDel(null)}>
          <p>
            This removes {del.project}, its findings, and its report from your
            workspace. This cannot be undone.
          </p>
          <div className="inline-actions">
            <button className="btn secondary" onClick={() => setDel(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await request(store(), "DELETE", { id: del.id });
                  setDel(null);
                  await refresh();
                  go("history");
                })
              }
            >
              Delete scan
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Empty({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <ShieldCheck size={27} />
      <h3>{title}</h3>
      <p>{desc}</p>
      {onClick && (
        <button className="btn secondary small" onClick={onClick}>
          Choose a project <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
function Assistant({ scans, demo }: { scans: Scan[]; demo: boolean }) {
  const all = scans.flatMap((s) =>
    s.findings.map((f) => ({ s, f, key: s.id + ":" + f.id })),
  );
  const [key, setKey] = useState(
      new URLSearchParams(location.search).get("finding") || all[0]?.key || "",
    ),
    [intent, setIntent] = useState("Explain the risk"),
    [answer, setAnswer] = useState(""),
    [provider, setProvider] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const hit = all.find((x) => x.key === key);
  async function ask() {
    if (!hit) return;
    setBusy(true);
    setErr("");
    try {
      if (!demo && backend) {
        const r = await request(backend + "/api/assistant", "POST", {
          scan_id: hit.s.id,
          finding_id: hit.f.id,
          intent,
        });
        setAnswer(r.answer);
        setProvider(r.provider);
      } else {
        setProvider("Local rule guidance");
        setAnswer(
          intent === "Explain the risk"
            ? hit.f.explanation
            : intent === "Suggest a fix"
              ? hit.f.fix + "\n\n" + hit.f.pattern
              : "After applying the fix, scan the same project again. Confirm that " +
                hit.f.rule +
                " no longer appears at this location and that " +
                hit.f.engine +
                " completed successfully. Review application behavior before closing the finding.",
        );
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel assistant-panel">
      <div className="feature-icon">
        <Sparkles />
      </div>
      <div className="eyebrow">AETHER INTELLIGENCE</div>
      <h2>What would you like to understand?</h2>
      <p>Choose a finding for focused, defensive remediation guidance.</p>
      {!all.length ? (
        <Empty
          title="No findings to review"
          desc="Scan a project or add a sample with findings to begin."
        />
      ) : (
        <>
          <label>
            Finding context
            <select
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setAnswer("");
              }}
            >
              {all.map((x) => (
                <option value={x.key} key={x.key}>
                  {x.f.title} — {x.f.file}:{x.f.line}
                </option>
              ))}
            </select>
          </label>
          <label>Question</label>
          <div className="intent-row">
            {["Explain the risk", "Suggest a fix", "Verify remediation"].map(
              (t) => (
                <button
                  className={t === intent ? "active" : ""}
                  key={t}
                  onClick={() => {
                    setIntent(t);
                    setAnswer("");
                  }}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          <button className="btn primary" disabled={!hit || busy} onClick={ask}>
            <Send size={14} />
            {busy ? "Preparing guidance…" : "Get guidance"}
          </button>
          {answer && (
            <div className="answer">
              <div className="eyebrow">
                <CornerDownRight size={14} />
                {provider}
              </div>
              <p>{answer}</p>
            </div>
          )}
          {err && <p className="error">{err}</p>}
          <div className="modal-foot">
            <ShieldCheck size={14} />
            {demo || !backend
              ? "Offline guidance · No data sent to an AI provider"
              : localAuth
                ? "Only rule metadata is shared with the configured provider"
                : "Source code is never sent to the AI provider"}
          </div>
        </>
      )}
    </div>
  );
}
