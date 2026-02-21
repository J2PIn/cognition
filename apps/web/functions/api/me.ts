import { verifyJwt } from "../jwt";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    return Response.json({ user: null });
  }

  try {
    const payload = await verifyJwt(match[1], (env as any).JWT_SECRET);
    return Response.json({ user: { email: payload.email } });
  } catch {
    return Response.json({ user: null });
  }
};
