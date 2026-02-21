// Minimal HS256 JWT for Cloudflare (WebCrypto), no deps.

const te = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlEncodeJson(obj: any): string {
  return b64urlEncode(te.encode(JSON.stringify(obj)));
}

function b64urlDecodeToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  return new Uint8Array(sig);
}

export async function jwtSign(
  secret: string,
  payload: Record<string, any>,
  expiresInSec: number
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };

  const h = b64urlEncodeJson(header);
  const p = b64urlEncodeJson(body);
  const data = `${h}.${p}`;

  const sig = await hmacSha256(secret, data);
  const s = b64urlEncode(sig);

  return `${data}.${s}`;
}

export async function jwtVerify<T = any>(
  secret: string,
  token: string
): Promise<{ ok: true; payload: T } | { ok: false; error: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "bad_format" };

  const [h, p, s] = parts;
  const data = `${h}.${p}`;

  // verify signature
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = b64urlDecodeToBytes(s);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, te.encode(data));
  if (!ok) return { ok: false, error: "bad_sig" };

  // decode payload
  let payload: any;
  try {
    const payloadJson = new TextDecoder().decode(b64urlDecodeToBytes(p));
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: "bad_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    return { ok: false, error: "expired" };
  }

  return { ok: true, payload };
}
