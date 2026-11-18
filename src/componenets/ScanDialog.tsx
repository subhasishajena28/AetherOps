import { useState, useRef } from "react";
import {
  UploadCloud,
  FolderArchive,
  Play,
  ShieldCheck,
  Check,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import Modal from "./Modal";
import { backend, request, store } from "../lib/client";
import type { Scan } from "../lib/types";
export default function ScanDialog({
  demo,
  samples,
  onClose,
  done,
}: {
  demo: boolean;
  samples: Scan[];
  onClose: () => void;
  done: (s: Scan) => void;
}) {
  const [tab, setTab] = useState(demo || !backend ? "sample" : "upload"),
    [sample, setSample] = useState("vulnerable-demo"),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  function pick(f?: File) {
    setError("");
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".zip") || f.size > 5 * 1024 * 1024) {
      setError("Choose a .zip archive no larger than 5 MiB.");
      return;
    }
    setFile(f);
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        const s = samples.find((s) => s.sample === sample);
        if (!s) throw Error("This sample is not available.");
        done(s);
      } else if (tab === "sample" && !backend) {
        done(await request(store(), "POST", { sample }));
      } else if (tab === "sample") {
        done(await request(backend + "/api/scan/sample/" + sample, "POST"));
      } else {
        if (!file || !backend)
          throw Error("A connected scanner and ZIP file are required.");
        done(
          await request(
            backend + "/api/scan?name=" + encodeURIComponent(file.name),
            "POST",
            file,
          ),
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={demo ? "Explore a sample project" : "New security scan"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">
        {demo
          ? "Inspect genuine results from the AetherOps analysis pipeline."
          : "Choose an archive or start with a sample project."}
      </p>
      <div className="tabs">
        <button
          className={tab === "upload" ? "selected" : ""}
          disabled={busy}
          onClick={() => setTab("upload")}
        >
          Upload ZIP
        </button>
        <button
          className={tab === "sample" ? "selected" : ""}
          disabled={busy}
          onClick={() => setTab("sample")}
        >
          Demo projects
        </button>
      </div>
      {tab === "upload" ? (
        <>
          {demo ? (
            <div className="notice">
              <LockText />{" "}
              <Link className="text-link" to="/login?mode=signup">
                Create your workspace <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <>
              <button
                className={"dropzone " + (drag ? "drag" : "")}
                onClick={() => ref.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  pick(e.dataTransfer.files[0]);
                }}
              >
                <UploadCloud size={32} />
                <b>{file ? file.name : "Drop your project ZIP here"}</b>
                <span>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KiB · Click to replace`
                    : "or click to browse · Maximum 5 MiB"}
                </span>
              </button>
              <input
                ref={ref}
                className="sr-only"
                type="file"
                accept=".zip"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              {!backend && (
                <div className="notice">
                  The live scanner is not connected to this deployment. Explore
                  a recorded demo or follow the{" "}
                  <Link to="/docs#deploy">deployment guide</Link>. Your file has
                  not been uploaded.
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="sample-options">
          {samples.map((s) => (
            <button
              key={s.id}
              className={sample === s.sample ? "chosen" : ""}
              onClick={() => setSample(s.sample!)}
            >
              <FolderArchive />
              <span>
                <b>{s.project}</b>
                <small>
                  {s.sample === "secure-demo"
                    ? "Reviewed secure patterns"
                    : "Security review sample"}{" "}
                  · {s.files} files
                </small>
              </span>
              {sample === s.sample && <Check size={16} />}
            </button>
          ))}
          <small className="muted">
            {demo || !backend
              ? "Recorded results from an actual three-engine scan."
              : "Runs the same analysis pipeline as an uploaded archive."}
          </small>
        </div>
      )}
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="modal-foot">
        <ShieldCheck size={14} />
        Read-only analysis · No code execution
      </div>
      <button
        className="btn primary full"
        disabled={
          busy ||
          (tab === "upload" && (demo || !file || !backend)) ||
          (tab === "sample" && !samples.length)
        }
        onClick={submit}
      >
        <Play size={14} />
        {busy
          ? "Analyzing project — please keep this open…"
          : tab === "sample" && (demo || !backend)
            ? demo
              ? "Inspect sample"
              : "Add recorded sample"
            : "Run security scan"}
      </button>
    </Modal>
  );
}
function LockText() {
  return (
    <p>Personal project uploads require a signed-in, private workspace.</p>
  );
}
