export function setup(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Scanner-Key",
  );
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
export async function owner(req, db) {
  const t = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  if (!t) return null;
  const { data, error } = await db.auth.getUser(t);
  return error ? null : data.user?.id;
}
export function records() {
  return import("../public/data/records.json", { with: { type: "json" } }).then(
    (m) => m.default,
  );
}
