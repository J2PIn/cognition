export type Env = {
  DB: D1Database;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  WEB_ORIGIN: string;
};

function nowIso() {
  return new Date().toISOString();
}
function addMinutes(min: number) {
  return new Date(Date.now() + min * 60_000).toISOString();
}
function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

function base64url(bytes: ArrayBuffer) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(digest);
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  // token string: base64url
  return base64url(arr.buffer);
}

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

async function resendSend(env: Env, to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend failed: ${r.status} ${t}`);
  }
}

function setCookie(name: string, value: string, opts: {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  maxAgeSeconds?: number;
} = {}) {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  if (opts.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (opts.maxAgeSeconds != null) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  return parts.join("; ");
}

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function handleAuthRequest(req: Request, env: Env) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") return json({ ok: false, error: "Missing email" }, { status: 400 });

  const token = randomToken(32);
  const tokenHash = await sha256Base64url(token);
  const expiresAt = addMinutes(15);

  await env.DB.prepare(
    `INSERT INTO magic_links (token_hash, email, expires_at, created_at) VALUES (?, ?, ?, ?)`
  ).bind(tokenHash, email.toLowerCase().trim(), expiresAt, nowIso()).run();

  const verifyUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/auth/verify?token=${encodeURIComponent(token)}`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.5">
      <h2>Sign in to Cognition</h2>
      <p>Use this link to sign in. It expires in 15 minutes.</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p style="color:#666">If you didn’t request this, you can ignore this email.</p>
    </div>
  `;

  await resendSend(env, email, "Your Cognition sign-in link", html);

  return json({ ok: true });
}

export async function handleAuthVerify(req: Request, env: Env) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ ok: false, error: "Missing token" }, { status: 400 });

  const tokenHash = await sha256Base64url(token);

  const row = await env.DB.prepare(
    `SELECT token_hash, email, expires_at, used_at FROM magic_links WHERE token_hash = ?`
  ).bind(tokenHash).first<{ email: string; expires_at: string; used_at: string | null }>();

  if (!row) return json({ ok: false, error: "Invalid token" }, { status: 400 });
  if (row.used_at) return json({ ok: false, error: "Token already used" }, { status: 400 });
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: "Token expired" }, { status: 400 });

  const email = row.email;
  const userId = await sha256Base64url(`user:${email}`); // stable id, fine for v0

  await env.DB.prepare(
    `INSERT INTO users (id, email, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO NOTHING`
  ).bind(userId, email, nowIso()).run();

  await env.DB.prepare(`UPDATE magic_links SET used_at = ? WHERE token_hash = ?`)
    .bind(nowIso(), tokenHash).run();

  const sessionId = randomToken(32);
  const sessionExpiresAt = addDays(7);

  await env.DB.prepare(
    `INSERT INTO sessions (session_id, user_id, email, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(sessionId, userId, email, sessionExpiresAt, nowIso()).run();

  // Set cookie and redirect to app
  const headers = new Headers();
  headers.append("Set-Cookie", setCookie("session", encodeURIComponent(sessionId), {
    maxAgeSeconds: 7 * 24 * 60 * 60,
  }));
  headers.append("Location", `${env.WEB_ORIGIN.replace(/\/$/, "")}/app`);

  return new Response(null, { status: 302, headers });
}

export async function handleMe(req: Request, env: Env) {
  const sid = getCookie(req, "session");
  if (!sid) return json({ ok: false, error: "Not signed in" }, { status: 401 });

  const row = await env.DB.prepare(
    `SELECT user_id, email, expires_at FROM sessions WHERE session_id = ?`
  ).bind(sid).first<{ user_id: string; email: string; expires_at: string }>();

  if (!row) return json({ ok: false, error: "Invalid session" }, { status: 401 });
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ ok: false, error: "Session expired" }, { status: 401 });

  return json({ ok: true, user: { id: row.user_id, email: row.email } });
}
