// Vercel serverless function: GET/POST /api/state
// Env vars needed (set in Vercel dashboard):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_PASSWORD

const crypto = require("crypto");

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pass = process.env.DASHBOARD_PASSWORD;

  if (!url || !key || !pass) {
    return res.status(500).json({ error: "Server env vars missing" });
  }
  if (!safeEqual(req.headers["x-dashboard-key"], pass)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const base = url.replace(/\/+$/, "") + "/rest/v1/ops_state";
  const sbHeaders = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };

  try {
    if (req.method === "GET") {
      const r = await fetch(base + "?id=eq.main&select=data", { headers: sbHeaders });
      if (!r.ok) return res.status(502).json({ error: "Supabase read failed", status: r.status });
      const rows = await r.json();
      return res.status(200).json({ data: rows.length ? rows[0].data : null });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || typeof body.data !== "object" || body.data === null) {
        return res.status(400).json({ error: "Bad body" });
      }
      const r = await fetch(base + "?on_conflict=id", {
        method: "POST",
        headers: Object.assign({}, sbHeaders, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ id: "main", data: body.data, updated_at: new Date().toISOString() })
      });
      if (!r.ok) return res.status(502).json({ error: "Supabase write failed", status: r.status });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
};
