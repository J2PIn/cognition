import { verifyJwt } from "../../jwt";

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    const payload = await verifyJwt(token, (env as any).JWT_SECRET);

    const headers = new Headers();
    headers.set(
      "Set-Cookie",
      `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    );
    headers.set("Location", "/");

    return new Response(null, { status: 302, headers });
  } catch {
    return new Response("Invalid or expired link", { status: 400 });
  }
};
