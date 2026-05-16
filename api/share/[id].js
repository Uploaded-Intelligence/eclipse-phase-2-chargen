// v0.7 Constellation — live-sync backend
//
// One serverless function on Vercel KV. Stores compressed character JSON
// keyed by anonymous UUID with a 30-day TTL. Players push their state via
// POST; GM's Party Page polls via GET every 30s. Unidirectional (player → GM).
//
// Endpoints:
//   GET    /api/share/<id>   → { data: <lz-base64>, name, updatedAt }
//   POST   /api/share/<id>   ← { data: <lz-base64>, name, updatedAt }  (body)
//   DELETE /api/share/<id>   → stop sharing
//
// No auth. The id IS the access token (UUID is the trust model — same as
// share-links and other anonymous-share TTRPG tools). Documented to users:
// "treat live links like session passwords".

const { kv } = require("@vercel/kv");

const ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_PAYLOAD_BYTES = 200 * 1024;        // 200KB hard ceiling (typical char ~50KB)
const TTL_SECONDS = 60 * 60 * 24 * 30;       // 30 days
const KEY_PREFIX = "ep2share:";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400"
  };
}

function setCors(res) {
  const h = corsHeaders();
  for (const k of Object.keys(h)) res.setHeader(k, h[k]);
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { id } = req.query;
  if (!id || !ID_PATTERN.test(id)) {
    return res.status(400).json({ error: "invalid id (must match /^[a-zA-Z0-9_-]{8,64}$/)" });
  }
  const key = KEY_PREFIX + id;

  try {
    if (req.method === "GET") {
      const stored = await kv.get(key);
      if (!stored) {
        return res.status(404).json({ error: "not found or expired" });
      }
      return res.status(200).json(stored);
    }

    if (req.method === "POST" || req.method === "PUT") {
      // Vercel parses JSON body automatically when content-type is application/json
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "body must be JSON object" });
      }
      if (!body.data || typeof body.data !== "string") {
        return res.status(400).json({ error: "body.data (compressed payload string) required" });
      }
      const totalSize = JSON.stringify(body).length;
      if (totalSize > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: "payload too large", size: totalSize, max: MAX_PAYLOAD_BYTES });
      }
      const record = {
        data: body.data,
        name: typeof body.name === "string" ? body.name.slice(0, 200) : "Unnamed",
        updatedAt: body.updatedAt || new Date().toISOString(),
        version: typeof body.version === "number" ? body.version : 1
      };
      await kv.set(key, record, { ex: TTL_SECONDS });
      return res.status(200).json({ ok: true, id, ttl: TTL_SECONDS });
    }

    if (req.method === "DELETE") {
      await kv.del(key);
      return res.status(204).end();
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    // Surface a generic message; log details server-side
    console.error("ep2share error:", err && err.message);
    return res.status(500).json({ error: "internal error", detail: (err && err.message) || "unknown" });
  }
}
