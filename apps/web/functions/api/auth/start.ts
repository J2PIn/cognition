import { Resend } from "resend";
import { signJwt } from "../jwt";

type Env = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  WEB_ORIGIN?: string;
  JWT_SECRET?: string;
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readJson(request: Request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson(request);

  // ✅ DEFINE email (this is what was missing / mismatched)
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ ok: false, error: "Invalid email" }, 400);

  if (!env.RESEND_API_KEY) return json({ ok: false, error: "Missing RESEND_API_KEY" }, 500);
  if (!env.EMAIL_FROM) return json({ ok: false, error: "Missing EMAIL_FROM" }, 500);
  if (!env.JWT_SECRET) return json({ ok: false, error: "Missing JWT_SECRET" }, 500);

  const origin =
    env.WEB_ORIGIN?.trim() ||
    new URL(request.url).origin; // fallback

  const token = await signJwt(env.JWT_SECRET, { email }, 3600);

  const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const resend = new Resend(env.RESEND_API_KEY);
  const sent = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email, // ✅ uses defined email
    subject: "Your Cognition sign-in link",
    html: `
      <p>Click to sign in:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 15 minutes.</p>
    `,
  });

  return json({ ok: true, id: sent?.data?.id ?? null, to: email, from: env.EMAIL_FROM });
};
