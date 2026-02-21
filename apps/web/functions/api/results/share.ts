import { Resend } from "resend";
import { verifyJwt } from "../jwt";

type Env = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  JWT_SECRET?: string;
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function getSessionToken(req: Request): string | null {
  const cookie = req.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function fmtPct(x: number) {
  if (Number.isFinite(x)) return `${Math.round(x)}%`;
  return "—";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.JWT_SECRET) return json({ ok: false, error: "Missing JWT_SECRET" }, 500);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: "Missing RESEND_API_KEY" }, 500);
  if (!env.EMAIL_FROM) return json({ ok: false, error: "Missing EMAIL_FROM" }, 500);

  // Require a valid session
  const session = getSessionToken(request);
  if (!session) return json({ ok: false, error: "Not signed in" }, 401);

  const v = await verifyJwt<any>(env.JWT_SECRET, session);
  if (!v.ok) return json({ ok: false, error: "Bad session" }, 401);

  const fromUser = String(v.payload?.email ?? "").trim().toLowerCase();

  const body = await request.json().catch(() => ({} as any));
  const to = String(body?.to ?? "").trim().toLowerCase();
  const r = body?.result;

  if (!to || !to.includes("@")) return json({ ok: false, error: "Invalid recipient email" }, 400);
  if (!r) return json({ ok: false, error: "Missing result" }, 400);

  // Expecting result object like:
  // { score, flag, rtAvgMs, stroopAcc, stroopRtMs, digitsAcc, baselineZ, createdAtISO? }
  const score = Number(r.score);
  const flag = String(r.flag ?? "").toUpperCase();
  const rtAvgMs = Number(r.rtAvgMs);
  const stroopAcc = Number(r.stroopAcc);
  const stroopRtMs = Number(r.stroopRtMs);
  const digitsAcc = Number(r.digitsAcc);
  const baselineZ = Number(r.baselineZ);

  const when = r.createdAtISO ? new Date(String(r.createdAtISO)) : new Date();
  const whenStr = isNaN(when.getTime()) ? "" : when.toISOString().slice(0, 10);

  const subject = `Cognition result: ${flag || "Result"} (${Math.round(score)}/100)`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height:1.4">
      <h2 style="margin:0 0 8px">Cognition result</h2>
      <div style="color:#444; margin-bottom:14px">${whenStr ? `Date: <b>${whenStr}</b>` : ""}</div>

      <div style="display:inline-block; padding:10px 14px; border-radius:12px; background:#111827; color:#fff; margin-bottom:14px">
        <div style="font-size:12px; opacity:.8">Flag</div>
        <div style="font-size:22px; font-weight:800">${flag || "—"}</div>
      </div>

      <div style="margin: 10px 0 18px; font-size:16px">
        <b>Score:</b> ${Number.isFinite(score) ? `${Math.round(score)} / 100` : "—"}
      </div>

      <table cellspacing="0" cellpadding="8" style="border-collapse:collapse; width:100%; max-width:540px">
        <tr>
          <td style="border:1px solid #e5e7eb"><b>RT avg</b></td>
          <td style="border:1px solid #e5e7eb">${Number.isFinite(rtAvgMs) ? `${Math.round(rtAvgMs)} ms` : "—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb"><b>Stroop acc</b></td>
          <td style="border:1px solid #e5e7eb">${fmtPct(stroopAcc)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb"><b>Stroop RT</b></td>
          <td style="border:1px solid #e5e7eb">${Number.isFinite(stroopRtMs) ? `${Math.round(stroopRtMs)} ms` : "—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb"><b>Digits</b></td>
          <td style="border:1px solid #e5e7eb">${fmtPct(digitsAcc)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #e5e7eb"><b>Baseline z</b></td>
          <td style="border:1px solid #e5e7eb">${Number.isFinite(baselineZ) ? baselineZ.toFixed(2) : "—"}</td>
        </tr>
      </table>

      <p style="margin-top:18px; color:#6b7280; font-size:12px">
        Shared by ${fromUser || "a Cognition user"}.
      </p>
    </div>
  `;

  const resend = new Resend(env.RESEND_API_KEY);
  const sent = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });

  return json({ ok: true, id: sent?.data?.id ?? null });
};
