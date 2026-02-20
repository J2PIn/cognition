import { Resend } from "resend";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const { email } = await request.json<any>().catch(() => ({}));
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ ok: false, error: "Invalid email" }, 400);
    }

    const RESEND_API_KEY = (env as any).RESEND_API_KEY;
    const EMAIL_FROM = (env as any).EMAIL_FROM;
    const WEB_ORIGIN = (env as any).WEB_ORIGIN || "https://provecognition.site";

    if (!RESEND_API_KEY) return json({ ok: false, error: "Missing RESEND_API_KEY" }, 500);
    if (!EMAIL_FROM) return json({ ok: false, error: "Missing EMAIL_FROM" }, 500);

    // TODO: generate token + store it (whatever your current flow is)
    // For now, just send a test email to prove Resend works:
    const signInUrl = `${WEB_ORIGIN}/`;

    const resend = new Resend(RESEND_API_KEY);

    const result: any = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Your Cognition sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${signInUrl}">${signInUrl}</a></p>`,
    });

    // Resend SDKs vary; handle both shapes
    const id = result?.id || result?.data?.id;
    const error = result?.error || result?.data?.error;

    if (error) return json({ ok: false, error }, 502);
    if (!id) return json({ ok: false, error: "Resend returned no id", result }, 502);

    return json({ ok: true, id });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 502);
  }
};
