import { randomUUID, timingSafeEqual } from "node:crypto";
import supabase from "./db-client.js";
import { setup, owner, records } from "../server/http.js";
export default async function handler(req, res) {
  if (setup(req, res)) return;
  try {
    const uid = await owner(req, supabase);
    if (!uid)
      return res
        .status(401)
        .json({ error: "Sign in to access your workspace." });
    const table = () => supabase.from("aether_scans");
    if (req.method === "GET") {
      const { data, error } = await table()
        .select("report,triage")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return res.json(
        data.map((r) => ({ ...r.report, triage: r.triage || {} })),
      );
    }
    if (req.method === "POST") {
      let report;
      if (req.body?.sample) {
        report = (await records()).find((s) => s.sample === req.body.sample);
        if (!report) return res.status(400).json({ error: "Unknown sample." });
        report = { ...report, id: randomUUID(), origin: "Recorded sample" };
      } else {
        const a = Buffer.from(req.headers["x-scanner-key"] || ""),
          b = Buffer.from(process.env.SCANNER_GATEWAY_SECRET || "");
        if (!b.length || a.length !== b.length || !timingSafeEqual(a, b))
          return res
            .status(403)
            .json({ error: "Only the configured scanner can submit reports." });
        report = req.body.report;
        if (!report?.id || !Array.isArray(report.findings))
          return res.status(400).json({ error: "Invalid scanner report." });
      }
      const { count, error: ce } = await table()
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      if (ce) throw ce;
      if (count >= 100)
        return res
          .status(409)
          .json({ error: "Workspace limit: remove an older scan first." });
      const { error } = await table()
        .insert({ id: report.id, user_id: uid, report, triage: {} })
        .select("id")
        .single();
      if (error) throw error;
      return res.status(201).json(report);
    }
    if (req.method === "PUT" || req.method === "DELETE") {
      const id = req.body?.id;
      if (typeof id !== "string")
        return res.status(400).json({ error: "A scan ID is required." });
      const { data: r, error } = await table()
        .select("id,report,triage")
        .eq("user_id", uid)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!r) return res.status(404).json({ error: "Scan not found." });
      if (req.method === "DELETE") {
        const { error } = await table()
          .delete()
          .eq("id", id)
          .eq("user_id", uid);
        if (error) throw error;
        return res.json({ ok: true });
      }
      const { finding, status } = req.body;
      if (
        !r.report.findings.some((f) => f.id === finding) ||
        !["Open", "In review", "Resolved"].includes(status)
      )
        return res.status(400).json({ error: "Invalid finding or status." });
      const { data: changed, error: e } = await table()
        .update({ triage: { ...r.triage, [finding]: status } })
        .eq("id", id)
        .eq("user_id", uid)
        .eq("triage", JSON.stringify(r.triage || {}))
        .select("id");
      if (e) throw e;
      if (!changed?.length) return res.status(409).json({error:"This scan changed. Refresh before saving your review."});
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch {
    return res
      .status(503)
      .json({
        error:
          "Workspace storage is temporarily unavailable. Please try again.",
      });
  }
}
