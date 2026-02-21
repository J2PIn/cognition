import { verifyJwt } from "./jwt"; // adjust relative path if needed

type SessionPayload = { email?: string };

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return Response.json({ user: null });

  const token = decodeURIComponent(match[1]);

  const v = await verifyJwt<SessionPayload>((env as any).JWT_SECRET, token);
  if (!v.ok) return Response.json({ user: null });

  const email = String(v.payload?.email ?? "").trim().toLowerCase();
  if (!email) return Response.json({ user: null });

  return Response.json({ user: { email } });
};
