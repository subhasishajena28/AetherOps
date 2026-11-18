import type { Scan } from "./types";
export async function exportReport(scan: Scan, format: "pdf" | "json") {
  const filename =
    scan.project.replace(/[^a-z0-9_-]/gi, "-") + "-security-report";
  if (format === "json") {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scan, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 24;
  function text(value: string, size = 11) {
    doc.setFontSize(size);
    for (const t of doc.splitTextToSize(value, 174)) {
      if (y > 273) {
        doc.addPage();
        y = 22;
      }
      doc.text(t, 18, y);
      y += size * 0.48 + 1;
    }
    y += 2;
  }
  doc.setTextColor(125, 88, 16);
  text("AETHEROPS / APPLICATION SECURITY", 12);
  doc.setTextColor(24, 26, 30);
  text(scan.project, 22);
  text("Static analysis report | " + scan.status + " | " + scan.origin);
  text("Analyzed: " + scan.created_at);
  text("Archive SHA-256: " + scan.sha256, 8);
  text(
    `${scan.files} analyzed files | ${scan.skipped} excluded entries | ${scan.findings.length} findings`,
  );
  for (const e of scan.engines)
    text(
      `${e.name} ${e.version}: ${e.status}. ${e.count} findings. ${e.note}`,
      10,
    );
  text(
    "No findings is not proof of security. Rules and supported files limit coverage.",
    10,
  );
  for (const f of scan.findings) {
    y += 4;
    text(`${f.severity} / ${f.title}`, 14);
    text(
      `${f.engine} ${f.rule} | ${f.file}:${f.line} | ${scan.triage?.[f.id] || "Open"}`,
      9,
    );
    text(f.explanation);
    text("Recommended fix: " + f.fix);
    if (f.pattern) text("Safer pattern: " + f.pattern, 9);
  }
  doc.save(filename + ".pdf");
}
