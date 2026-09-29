const crypto = require("crypto");

const URL_ = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const rnd = (n) => crypto.randomBytes(n).toString("hex");
const CKO = "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=";

function eq(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function hp(pw) { const s = rnd(8); return s + ":" + crypto.scryptSync(String(pw), s, 32).toString("hex"); }
function vp(pw, st) {
  if (!st || st.indexOf(":") < 0) return false;
  const p = st.split(":");
  return eq(crypto.scryptSync(String(pw), p[0], 32).toString("hex"), p[1]);
}
async function q(path, method, body, prefer) {
  const r = await fetch(URL_ + "/rest/v1/" + path, {
    method: method || "GET",
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: prefer || "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t);
  return t ? JSON.parse(t) : [];
}
function cookies(h) {
  const o = {};
  String(h || "").split(";").forEach((c) => { const i = c.indexOf("="); if (i > 0) o[c.slice(0, i).trim()] = c.slice(i + 1).trim(); });
  return o;
}
const E = encodeURIComponent;

const TXT = {
  none: "NONE. No text at all on the image.",
  headline: "A short bold title/headline (max 6 words, from the pin title) large and readable on the image.",
  points: "A short headline (max 6 words) plus exactly 3 very short callout points (max 4 words each), infographic layout.",
  ad: "An ad-style short headline (max 6 words) plus one short call-to-action (e.g. Shop Now). Do NOT invent discounts, prices or claims not in the listing.",
};
const RULES = [
  "You are the GrowMyPin Pinterest pin writer for Etsy/Shopify client shops.",
  "For each pin output: title (under 100 chars, most important keyword first), description (2-4 natural sentences, value-first, NOT a keyword dump), alt_text, image_prompt.",
  "image_prompt: a complete paste-ready ChatGPT image prompt. Start with \"Create an image:\". Tell ChatGPT to use the attached product photo as exact reference and keep the product identical. Follow the PIN STYLE and TEXT ON IMAGE given; describe scene, props, lighting, camera, mood, colors. Vertical 2:3 ratio, photorealistic, no logos, no watermark, no extra products. If TEXT ON IMAGE is not NONE, put the exact overlay words in double quotes with font style, size, color, placement (clear of the product); otherwise say no text on the image.",
  "RULES: 1) No keyword stuffing. Never copy the full listing title. Max 4-5 light relevant keywords per pin. Never mix unrelated occasions/themes. ONE clear theme per pin, suited to the target country.",
  "2) Description reads like a human wrote it, 2-3 sentences, no spec sheet.",
  "3) Seasonal framing from TODAY. Pinterest trends run 6-8 weeks ahead. Jul-Aug early Christmas planners. Sep holiday search spikes. Oct gift-ideas peak, frame as gift idea. Nov highest purchase intent. Dec 1-20 last-minute gifts. Dec 21-31 New Year/fresh-start takes over.",
  "4) Use 1-2 keywords from the niche keyword list (TOP first, then GOOD, then OK) naturally. Never dump the list.",
  "5) Use the target country everyday wording (e.g. Ayurvedic terms become western wellness terms for US/UK: kadha -> herbal tea, adaptogen, natural sleep remedy).",
  "6) alt_text describes the scene in image_prompt (mention overlay text if any).",
  "7) Each variation uses a DIFFERENT angle but still ONE theme.",
  "8) business_note: ONE short useful observation or empty string. listing_flags: short warnings only if real (wrong Etsy category, 70%+ discounts, copied-image risk) else empty array.",
  "Build pins ONLY from what is visible in the screenshots or text. Never invent details.",
  "Return ONLY JSON: {\"pins\":[{\"angle\":\"\",\"title\":\"\",\"description\":\"\",\"alt_text\":\"\",\"image_prompt\":\"\"}],\"business_note\":\"\",\"listing_flags\":[]}",
].join("\n");

async function generate(b, cfg, who, ip) {
  const cl = (cfg.clients || []).find((x) => x.id === b.client);
  const nn = (cfg.niches || []).find((x) => x.id === b.niche);
  const st = (cfg.styles || []).find((x) => x.id === b.style);
  if (!cl || !nn || !st || !(cl.niches || []).includes(nn.id) || !(cl.styles || []).includes(st.id)) return [400, { error: "Invalid selection" }];
  const listing = String(b.listing || "").slice(0, 4000);
  const imgs = (Array.isArray(b.images) ? b.images : []).slice(0, 3);
  if (!listing.trim() && !imgs.length) return [400, { error: "Screenshot ya text chahiye" }];
  const kw = [2, 1, 0].map((p) => {
    const l = (nn.kw || []).filter((k) => k.p === p).map((k) => k.k);
    return l.length ? ["OK", "GOOD", "TOP"][p] + ": " + l.join(", ") : "";
  }).filter(Boolean).join(" | ");
  const prompt = RULES + "\n\nTODAY: " + new Date().toDateString() + "\nCLIENT: " + cl.name + "\nTARGET COUNTRY: " + cl.country + (cl.notes ? "\nCLIENT NOTES: " + cl.notes : "") + "\nNICHE: " + nn.name + "\nNICHE KEYWORDS (priority order): " + kw + "\nPIN STYLE: " + st.name + " - " + st.desc + "\nTEXT ON IMAGE: " + TXT[st.tx || "none"] + "\nNUMBER OF PIN VARIATIONS: " + (cl.n || 3) + "\n\n" + (imgs.length ? "The attached screenshot(s) show the Etsy/Shopify listing.\n" : "") + "LISTING TEXT (optional):\n" + listing;
  const content = imgs.map((d) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: String(d).split(",")[1] } }));
  content.push({ type: "text", text: prompt });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 3000, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) return [502, { error: "AI error, dobara try karo." }];
  let out;
  try {
    const t = j.content.map((c) => c.text || "").join("").replace(/```json|```/g, "").trim();
    out = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  } catch (e) { return [502, { error: "Output parse nahi hua, dobara try karo." }]; }
  await q("team_gens", "POST", { who, client: cl.name, niche: nn.name, style: st.name, note: (imgs.length ? "[" + imgs.length + " screenshot] " : "") + listing.slice(0, 300), output: out, ip });
  return [200, out];
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!URL_ || !KEY || !process.env.DASHBOARD_PASSWORD) return res.status(500).json({ error: "Server env vars missing" });
  const out = (code, o) => res.status(code).json(o);
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const ck = cookies(req.headers.cookie);
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const ua = String(req.headers["user-agent"] || "");
    const dev = ck.gmpd || "";
    const admin = eq(req.headers["x-dashboard-key"], process.env.DASHBOARD_PASSWORD);
    const blocked = await q("team_blocked?select=kind,value");
    const isBlk = !admin && blocked.some((x) => (x.kind === "ip" && x.value === ip) || (x.kind === "device" && dev && x.value === dev));

    if (b.action === "login") {
      if (isBlk) return out(403, { error: "blocked" });
      const email = String(b.email || "").trim().toLowerCase();
      const u = (await q("team_users?email=eq." + E(email) + "&select=*"))[0];
      if (!u || !u.active || !vp(b.password, u.pass_hash)) return out(401, { error: "bad" });
      const t = rnd(32), d = dev || rnd(16);
      await q("team_sessions", "POST", { token_hash: H(t), user_id: u.id, ip, ua, device: d });
      res.setHeader("Set-Cookie", ["gmp=" + t + CKO + 7776000, "gmpd=" + d + CKO + 31536000]);
      return out(200, { ok: true });
    }

    let me = null;
    if (admin) me = { id: "admin", email: "admin", admin: true };
    else {
      if (isBlk || !ck.gmp) return out(401, { error: "login" });
      const s = (await q("team_sessions?token_hash=eq." + H(ck.gmp) + "&select=user_id,team_users(id,email,active)"))[0];
      const u = s && s.team_users;
      if (!u || !u.active) return out(401, { error: "login" });
      me = { id: u.id, email: u.email, admin: false };
      q("team_sessions?token_hash=eq." + H(ck.gmp), "PATCH", { last_seen: new Date().toISOString() }).catch(() => {});
    }
    const st = (await q("team_settings?id=eq.1&select=work_hash,config"))[0] || {};
    const unlocked = me.admin || (!!st.work_hash && eq(ck.gmpw, H(st.work_hash + me.id)));

    if (b.action === "logout") {
      if (ck.gmp) await q("team_sessions?token_hash=eq." + H(ck.gmp), "DELETE");
      res.setHeader("Set-Cookie", ["gmp=" + CKO + 0]);
      return out(200, { ok: true });
    }
    if (b.action === "boot") return out(200, { email: me.email, admin: me.admin, unlocked, cfg: unlocked ? st.config : null });
    if (b.action === "unlock") {
      if (!st.work_hash || !vp(b.password, st.work_hash)) return out(401, { error: "bad" });
      res.setHeader("Set-Cookie", ["gmpw=" + H(st.work_hash + me.id) + CKO + 31536000]);
      return out(200, { ok: true });
    }
    if (b.action === "generate") {
      if (!unlocked) return out(403, { error: "Work password chahiye" });
      const r = await generate(b, st.config || {}, me.email, ip);
      return out(r[0], r[1]);
    }

    if (!me.admin) return out(403, { error: "Forbidden" });
    if (b.action === "overview") {
      const r = await Promise.all([
        q("team_users?select=id,email,active,created_at&order=created_at"),
        q("team_sessions?select=created_at,last_seen,ip,ua,device,team_users(email)&order=created_at.desc&limit=150"),
        q("team_gens?select=created_at,who,client,niche,style,note,output,ip&order=created_at.desc&limit=150"),
      ]);
      return out(200, { users: r[0], sessions: r[1], gens: r[2], blocked, cfg: st.config, has_work: !!st.work_hash });
    }
    if (b.action === "createUser") {
      const email = String(b.email || "").trim().toLowerCase();
      if (!email || String(b.password || "").length < 6) return out(400, { error: "Email + password (6+ chars) chahiye" });
      await q("team_users", "POST", { email, pass_hash: hp(b.password) });
      return out(200, { ok: true });
    }
    if (b.action === "resetPassword") {
      if (String(b.password || "").length < 6) return out(400, { error: "6+ chars chahiye" });
      await q("team_users?id=eq." + E(b.id), "PATCH", { pass_hash: hp(b.password) });
      await q("team_sessions?user_id=eq." + E(b.id), "DELETE");
      return out(200, { ok: true });
    }
    if (b.action === "setActive") {
      await q("team_users?id=eq." + E(b.id), "PATCH", { active: !!b.active });
      if (!b.active) await q("team_sessions?user_id=eq." + E(b.id), "DELETE");
      return out(200, { ok: true });
    }
    if (b.action === "block") {
      if (!["ip", "device"].includes(b.kind) || !b.value) return out(400, { error: "Bad block" });
      await q("team_blocked?on_conflict=kind,value", "POST", { kind: b.kind, value: b.value }, "resolution=merge-duplicates,return=representation");
      await q("team_sessions?" + (b.kind === "ip" ? "ip" : "device") + "=eq." + E(b.value), "DELETE");
      return out(200, { ok: true });
    }
    if (b.action === "unblock") {
      await q("team_blocked?kind=eq." + E(b.kind) + "&value=eq." + E(b.value), "DELETE");
      return out(200, { ok: true });
    }
    if (b.action === "setWorkPass") {
      if (String(b.password || "").length < 4) return out(400, { error: "Kam se kam 4 characters" });
      await q("team_settings?id=eq.1", "PATCH", { work_hash: hp(b.password) });
      return out(200, { ok: true });
    }
    if (b.action === "saveConfig") {
      if (!b.data || typeof b.data !== "object") return out(400, { error: "Bad config" });
      await q("team_settings?id=eq.1", "PATCH", { config: b.data });
      return out(200, { ok: true });
    }
    return out(400, { error: "Bad action" });
  } catch (e) {
    return out(500, { error: "Server error" });
  }
};
