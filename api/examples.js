import supabase from "./db-client.js";
import { setup, records } from "../server/http.js";
export default async function handler(req, res) {
  if (setup(req, res)) return;
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const { data, error } = await supabase
      .from("aether_examples")
      .select("id,title,description")
      .order("id");
    if (error) throw error;
    const scans = await records();
    return res.json(
      data.map((x) => ({
        ...scans.find((s) => s.sample === x.id),
        description: x.description,
      })),
    );
  } catch {
    return res
      .status(503)
      .json({ error: "The sample catalog is temporarily unavailable." });
  }
}
