export interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  JWT_SECRET: string;
  APP_NAME: string;
  COOKIE_NAME: string;
  COOKIE_MAX_AGE_SECONDS: string;
  WEB_ORIGIN: string;
}

type Json = Record<string, unknown>;

const json = (data: Json, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });

const nowIso = () => new Date().toISOString();

function corsHeaders(env: Env) {
  return {
    "access-control-allow-origin": env.WEB_ORIGIN,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "origin",
  };
}

function base64url(input: ArrayBuffer) {
  const bytes = new Uint8Array(input);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  // btoa expects latin1 string
  const b64 = btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return b64;
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex;
}

async function hmacSha256(key: string, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return base64url(sig);
}

async function jwtSign(env: Env, payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj: unknown) =>
    base64url(new TextEncoder().encode(JSON.stringify(obj)).buffer);

  const h = enc(header);
  const p = enc(payload);
  const toSign = `${h}.${p}`;
  const sig = await hmacSha256(env.JWT_SECRET, toSign);
  return `${toSign}.${sig}`;
}

function jwtParse(token: string): { header: any; payload: any; sig: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const dec = (b64u: string) => {
    const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4);
    const str = atob(b64);
    return JSON.parse(str);
  };
  return { header: dec(h), payload: dec(p), sig };
}

async function jwtVerify(env: Env, token: string) {
  const parsed = jwtParse(token);
  if (!parsed) return null;
  const [h, p] = token.split(".", 2);
  const expected = await hmacSha256(env.JWT_SECRET, `${h}.${p}`);
  if (expected !== parsed.sig) return null;
  // exp check (seconds)
  if (parsed.payload?.exp && typeof parsed.payload.exp === "number") {
    const now = Math.floor(Date.now() / 1000);
    if (now > parsed.payload.exp) return null;
  }
  return parsed.payload;
}

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") || "";
  const parts = cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function setSessionCookie(env: Env, token: string) {
  const maxAge = parseInt(env.COOKIE_MAX_AGE_SECONDS || "1209600", 10);
  // HttpOnly cookie so frontend JS can’t steal it
  return `${env.COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie(env: Env) {
  return `${env.COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function rand6() {
  // cryptographically secure 6-digit code
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1_000_000).padStart(6, "0");
}

async function sendWithResend(env: Env, to: string, subject: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Resend failed: ${resp.status} ${txt}`);
  }
}

async function requireUser(env: Env, req: Request) {
  const token = getCookie(req, env.COOKIE_NAME);
  if (!token) return null;
  const payload = await jwtVerify(env, token);
  if (!payload?.uid || !payload?.email) return null;
  return { uid: String(payload.uid), email: String(payload.email) };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      // ---------- AUTH ----------
      if (url.pathname === "/api/auth/request" && req.method === "POST") {
        const { email } = (await req.json()) as { email?: string };
        if (!email || !email.includes("@")) {
          return json({ ok: false, error: "Invalid email" }, 400, corsHeaders(env));
        }

        const code = rand6();
        const code_hash = await sha256Hex(`${email.toLowerCase()}|${code}`);
        const id = crypto.randomUUID();
        const created_at = nowIso();
        const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        await env.DB.prepare(
          "INSERT INTO auth_codes (id, email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, email.toLowerCase(), code_hash, expires, created_at).run();

        // Send email
        const subject = `${env.APP_NAME}: your login code`;
        const html =
          `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;">
             <h2>${env.APP_NAME}</h2>
             <p>Your login code is:</p>
             <p style="font-size:28px; letter-spacing:3px; font-weight:700;">${code}</p>
             <p>This code expires in 10 minutes.</p>
             <p style="color:#666; font-size:12px;">Non-diagnostic readiness check.</p>
           </div>`;

        await sendWithResend(env, email, subject, html);

        return json({ ok: true }, 200, corsHeaders(env));
      }

      if (url.pathname === "/api/auth/verify" && req.method === "POST") {
        const { email, code } = (await req.json()) as { email?: string; code?: string };
        if (!email || !code || code.length !== 6) {
          return json({ ok: false, error: "Invalid email/code" }, 400, corsHeaders(env));
        }
        const normEmail = email.toLowerCase();
        const wanted = await sha256Hex(`${normEmail}|${code}`);

        // Find a matching unconsumed code that hasn't expired
        const row = await env.DB.prepare(
          `SELECT id, expires_at, consumed_at FROM auth_codes
           WHERE email=? AND code_hash=? ORDER BY created_at DESC LIMIT 1`
        ).bind(normEmail, wanted).first<any>();

        if (!row) return json({ ok: false, error: "Wrong code" }, 401, corsHeaders(env));
        if (row.consumed_at) return json({ ok: false, error: "Code already used" }, 401, corsHeaders(env));
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return json({ ok: false, error: "Code expired" }, 401, corsHeaders(env));
        }

        // Consume
        await env.DB.prepare("UPDATE auth_codes SET consumed_at=? WHERE id=?")
          .bind(nowIso(), row.id).run();

        // Upsert user
        const existing = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(normEmail).first<any>();
        const uid = existing?.id || crypto.randomUUID();
        if (!existing) {
          await env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
            .bind(uid, normEmail, nowIso()).run();
        }

        // Create session JWT
        const exp = Math.floor(Date.now() / 1000) + 14 * 24 * 3600;
        const token = await jwtSign(env, { uid, email: normEmail, exp });

        return json(
          { ok: true, user: { id: uid, email: normEmail } },
          200,
          { ...corsHeaders(env), "set-cookie": setSessionCookie(env, token) }
        );
      }

      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        return json({ ok: true }, 200, { ...corsHeaders(env), "set-cookie": clearSessionCookie(env) });
      }

      if (url.pathname === "/api/me" && req.method === "GET") {
        const user = await requireUser(env, req);
        if (!user) return json({ ok: false }, 401, corsHeaders(env));
        return json({ ok: true, user }, 200, corsHeaders(env));
      }

      // ---------- COG CHECK ----------
      if (url.pathname === "/api/session/start" && req.method === "POST") {
        const user = await requireUser(env, req);
        if (!user) return json({ ok: false }, 401, corsHeaders(env));

        const { device_fingerprint } = (await req.json().catch(() => ({}))) as { device_fingerprint?: string };
        const sid = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO sessions (id, user_id, started_at, device_fingerprint) VALUES (?, ?, ?, ?)"
        ).bind(sid, user.uid, nowIso(), device_fingerprint || null).run();

        return json({ ok: true, sessionId: sid }, 200, corsHeaders(env));
      }

      // Complete: frontend sends per-task summaries (not raw taps) in v1
      if (url.pathname === "/api/session/complete" && req.method === "POST") {
        const user = await requireUser(env, req);
        if (!user) return json({ ok: false }, 401, corsHeaders(env));

        const body = (await req.json()) as {
          sessionId: string;
          metrics: Record<string, number>;
          confidence: number;
          integrity?: number;
        };

        if (!body?.sessionId || !body.metrics) {
          return json({ ok: false, error: "Missing sessionId/metrics" }, 400, corsHeaders(env));
        }

        // Load baseline for each metric
        const metricKeys = Object.keys(body.metrics);
        const placeholders = metricKeys.map(() => "?").join(",");
        const baselineRows = await env.DB.prepare(
          `SELECT metric, mean, std, n FROM baseline_stats WHERE user_id=? AND metric IN (${placeholders})`
        ).bind(user.uid, ...metricKeys).all<any>();

        const baselineMap = new Map<string, { mean: number; std: number; n: number }>();
        for (const r of baselineRows.results || []) baselineMap.set(r.metric, r);

        // Compute z-scores (if no baseline yet, z=0 and mark "baseline_pending")
        const z: Record<string, number> = {};
        let baselineCoverage = 0;

        for (const k of metricKeys) {
          const b = baselineMap.get(k);
          if (b && b.std > 0 && b.n >= 5) {
            z[k] = (body.metrics[k] - b.mean) / b.std;
            baselineCoverage += 1;
          } else {
            z[k] = 0;
          }
        }

        // Minimal readiness logic v1 (tune later)
        // - “bad” metrics where higher is worse (errors, false positives)
        // - reaction time: higher is worse
        const worseIfHigh = new Set([
          "srt_mean_ms",
          "srt_lapse_rate",
          "crt_mean_ms",
          "crt_error_rate",
          "gonogo_false_positive_rate",
          "wm_error_rate",
        ]);

        // Score: sum of positive deviations for worseIfHigh
        let risk = 0;
        for (const k of metricKeys) {
          if (worseIfHigh.has(k)) risk += Math.max(0, z[k]);
        }

        // Confidence miscalibration penalty (very light v1)
        // If confidence is very high while risk is high -> add penalty
        const conf = Math.max(0, Math.min(100, body.confidence ?? 50));
        if (conf > 80 && risk > 3) risk += 0.5;

        let readiness: "GREEN" | "YELLOW" | "RED" = "GREEN";
        if (risk >= 4) readiness = "RED";
        else if (risk >= 2) readiness = "YELLOW";

        const score_json = {
          z,
          risk,
          readiness,
          baselineCoverage,
          baselinePending: baselineCoverage < Math.max(3, Math.floor(metricKeys.length * 0.6)),
        };

        await env.DB.prepare(
          "UPDATE sessions SET ended_at=?, metrics_json=?, score_json=?, readiness=?, integrity=? WHERE id=? AND user_id=?"
        )
          .bind(
            nowIso(),
            JSON.stringify({ metrics: body.metrics, confidence: conf }),
            JSON.stringify(score_json),
            readiness,
            body.integrity ?? 1.0,
            body.sessionId,
            user.uid
          )
          .run();

        // Update baseline incrementally (simple running mean/std via Welford)
        // v1: only update after session ends, and only for "GREEN" to reduce contamination
        if (readiness === "GREEN") {
          for (const k of metricKeys) {
            const x = body.metrics[k];
            const b = baselineMap.get(k);
            if (!b) {
              await env.DB.prepare(
                "INSERT INTO baseline_stats (user_id, metric, mean, std, n, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
              ).bind(user.uid, k, x, 1.0, 1, nowIso()).run();
              continue;
            }
            const n1 = b.n + 1;
            const mean1 = b.mean + (x - b.mean) / n1;
            // crude std update v1: keep std from collapsing too fast
            const std1 = Math.max(1e-6, Math.sqrt(((b.std ** 2) * (b.n - 1) + (x - b.mean) * (x - mean1)) / Math.max(1, n1 - 1)));
            await env.DB.prepare(
              "UPDATE baseline_stats SET mean=?, std=?, n=?, updated_at=? WHERE user_id=? AND metric=?"
            ).bind(mean1, std1, n1, nowIso(), user.uid, k).run();
          }
        }

        return json({ ok: true, readiness, score: score_json }, 200, corsHeaders(env));
      }

                  // --- DIAG (temporary) ---
      if (url.pathname === "/api/_diag" && req.method === "GET") {
        const emailFrom = env.EMAIL_FROM ?? "";
        return json(
          {
            ok: true,
            hasResendKey: !!env.RESEND_API_KEY && env.RESEND_API_KEY.length > 10,
            resendKeyLen: env.RESEND_API_KEY ? env.RESEND_API_KEY.length : 0,
            emailFrom,
            emailFromLen: emailFrom.length,
            emailFromHasNewline: emailFrom.includes("\n") || emailFrom.includes("\r"),
            emailFromTrimmed: emailFrom.trim(),
            emailFromTrimmedLen: emailFrom.trim().length,
            webOrigin: env.WEB_ORIGIN || null,
            hasJwtSecret: !!env.JWT_SECRET && env.JWT_SECRET.length > 10,
          },
          200,
          corsHeaders(env)
        );
      }


      if (url.pathname.startsWith("/api/session/") && req.method === "GET") {
        const user = await requireUser(env, req);
        if (!user) return json({ ok: false }, 401, corsHeaders(env));

        const sid = url.pathname.split("/").pop()!;
        const row = await env.DB.prepare(
          "SELECT id, started_at, ended_at, metrics_json, score_json, readiness FROM sessions WHERE id=? AND user_id=?"
        ).bind(sid, user.uid).first<any>();

        if (!row) return json({ ok: false, error: "Not found" }, 404, corsHeaders(env));
        return json({ ok: true, session: row }, 200, corsHeaders(env));
      }

      return json({ ok: false, error: "Not found" }, 404, corsHeaders(env));
    } catch (err: any) {
      return json({ ok: false, error: err?.message || "Server error" }, 500, corsHeaders(env));
    }
  },
};
