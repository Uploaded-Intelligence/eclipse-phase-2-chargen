// v0.10 — Team Room backend
//
// Vercel KV-backed party room document. Holds the team's shared metadata —
// teamName, member list (characterIds), and current initiative order. Each
// member's full character state lives in api/share/{characterId} (Layer 1).
// This endpoint is Layer 2 — the team-level shared doc.
//
// Endpoints:
//   GET    /api/team/<roomId>   → { schemaVersion, teamName, members, initiative, updatedAt }
//   POST   /api/team/<roomId>   ← initial doc (refuses if room exists — return 409)
//   PUT    /api/team/<roomId>   ← full-replace (used by Roll Initiative · All)
//   PATCH  /api/team/<roomId>   ← merge fields (add member set-union, edit teamName, etc.)
//
// No auth. The roomId IS the access token (UUID is the trust model — same as
// character shares). Documented: "treat team links like session passwords".

const { kv } = require("@vercel/kv");

const ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_PAYLOAD_BYTES = 64 * 1024;          // 64KB ceiling — team doc is small
const MAX_MEMBERS = 16;
const MAX_TEAM_NAME = 200;
const TTL_SECONDS = 60 * 60 * 24 * 30;        // 30 days, refreshed on every write
const KEY_PREFIX = "ep2team:";

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400"
  };
}

function setCors(res) {
  const h = corsHeaders();
  for (const k of Object.keys(h)) res.setHeader(k, h[k]);
}

// Validate the shape of a team-doc body (for POST / PUT / PATCH partial).
// Returns null if valid, or a string describing what's wrong. Fields are
// optional on PATCH; pass `partial: true` to skip required-presence checks.
function validateTeamBody(body, { partial = false } = {}) {
  if (!body || typeof body !== "object") return "body must be JSON object";

  if (!partial || body.teamName !== undefined) {
    if (body.teamName !== undefined && typeof body.teamName !== "string") return "teamName must be string";
    if (typeof body.teamName === "string" && body.teamName.length > MAX_TEAM_NAME) {
      return "teamName too long (max " + MAX_TEAM_NAME + " chars)";
    }
  }

  if (!partial || body.members !== undefined) {
    if (body.members !== undefined) {
      if (!Array.isArray(body.members)) return "members must be array";
      if (body.members.length > MAX_MEMBERS) return "too many members (max " + MAX_MEMBERS + ")";
      for (const id of body.members) {
        if (typeof id !== "string" || !ID_PATTERN.test(id)) {
          return "members[] entries must match " + ID_PATTERN.source;
        }
      }
    }
  }

  if (body.initiative !== undefined) {
    if (!Array.isArray(body.initiative)) return "initiative must be array";
    if (body.initiative.length > MAX_MEMBERS) return "too many initiative entries (max " + MAX_MEMBERS + ")";
    for (const entry of body.initiative) {
      if (!entry || typeof entry !== "object") return "initiative[] entries must be objects";
      if (typeof entry.characterId !== "string" || !ID_PATTERN.test(entry.characterId)) {
        return "initiative[].characterId must match " + ID_PATTERN.source;
      }
      if (typeof entry.value !== "number" || !isFinite(entry.value)) {
        return "initiative[].value must be a finite number";
      }
      if (entry.rolledAt !== undefined && typeof entry.rolledAt !== "string") {
        return "initiative[].rolledAt must be ISO string or omitted";
      }
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { roomId } = req.query;
  if (!roomId || !ID_PATTERN.test(roomId)) {
    return res.status(400).json({ error: "invalid roomId (must match " + ID_PATTERN.source + ")" });
  }
  const key = KEY_PREFIX + roomId;

  try {
    if (req.method === "GET") {
      const stored = await kv.get(key);
      if (!stored) {
        return res.status(404).json({ error: "team room not found or expired" });
      }
      return res.status(200).json(stored);
    }

    if (req.method === "POST") {
      // Create only — refuse if room exists (caller should retry with new roomId on 409).
      const body = req.body;
      const err = validateTeamBody(body);
      if (err) return res.status(400).json({ error: err });

      const totalSize = JSON.stringify(body).length;
      if (totalSize > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: "payload too large", size: totalSize, max: MAX_PAYLOAD_BYTES });
      }

      const existing = await kv.get(key);
      if (existing) {
        return res.status(409).json({ error: "team room already exists; regenerate roomId" });
      }

      const record = {
        schemaVersion: 1,
        teamName: typeof body.teamName === "string" ? body.teamName : "",
        members: Array.isArray(body.members) ? body.members.slice() : [],
        initiative: Array.isArray(body.initiative) ? body.initiative.slice() : [],
        updatedAt: new Date().toISOString()
      };
      await kv.set(key, record, { ex: TTL_SECONDS });
      return res.status(201).json({ ok: true, roomId, ttl: TTL_SECONDS, doc: record });
    }

    if (req.method === "PUT") {
      // Full replace (used by Roll Initiative · All replacing the whole initiative array,
      // or by team-doc rehydration after TTL expiry).
      const body = req.body;
      const err = validateTeamBody(body);
      if (err) return res.status(400).json({ error: err });

      const totalSize = JSON.stringify(body).length;
      if (totalSize > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: "payload too large", size: totalSize, max: MAX_PAYLOAD_BYTES });
      }

      const record = {
        schemaVersion: 1,
        teamName: typeof body.teamName === "string" ? body.teamName : "",
        members: Array.isArray(body.members) ? body.members.slice() : [],
        initiative: Array.isArray(body.initiative) ? body.initiative.slice() : [],
        updatedAt: new Date().toISOString()
      };
      await kv.set(key, record, { ex: TTL_SECONDS });
      return res.status(200).json({ ok: true, roomId, ttl: TTL_SECONDS, doc: record });
    }

    if (req.method === "PATCH") {
      // Merge specific fields. Members are set-union (no duplicates, no removals).
      // teamName + initiative are last-write-wins.
      const body = req.body;
      const err = validateTeamBody(body, { partial: true });
      if (err) return res.status(400).json({ error: err });

      const totalSize = JSON.stringify(body).length;
      if (totalSize > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: "payload too large", size: totalSize, max: MAX_PAYLOAD_BYTES });
      }

      const existing = await kv.get(key);
      if (!existing) {
        return res.status(404).json({ error: "team room not found; POST a new one first" });
      }

      const next = Object.assign({ schemaVersion: 1, teamName: "", members: [], initiative: [] }, existing);
      if (typeof body.teamName === "string") next.teamName = body.teamName;
      if (Array.isArray(body.members)) {
        // set-union: keep existing order, append new
        const seen = new Set(next.members);
        for (const id of body.members) {
          if (!seen.has(id)) {
            next.members.push(id);
            seen.add(id);
          }
        }
        if (next.members.length > MAX_MEMBERS) {
          return res.status(413).json({ error: "team full (max " + MAX_MEMBERS + " members)" });
        }
      }
      if (Array.isArray(body.initiative)) {
        next.initiative = body.initiative.slice();
      }
      next.updatedAt = new Date().toISOString();

      await kv.set(key, next, { ex: TTL_SECONDS });
      return res.status(200).json({ ok: true, roomId, ttl: TTL_SECONDS, doc: next });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("ep2team error:", err && err.message);
    return res.status(500).json({ error: "internal error", detail: (err && err.message) || "unknown" });
  }
};
