import { signJwt, verifyJwt } from "../jwt";

type VerifyPayload = { email?: string };

export const onRequestGet: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) return new Response("Missing token", { status: 400 });

  try {
    const v = await verifyJwt<VerifyPayload>((env as any).JWT_SECRET, token);
    if (!v.ok) return new Response("Invalid or expired link", { status: 400 });

    const email = String(v.payload?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return new Response("Invalid token payload", { status: 400 });
    }

    // Create a proper session token (e.g. 7 days)
    const sessionToken = await signJwt((env as any).JWT_SECRET, { email }, 60 * 60 * 24 * 7);

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");

    const isHttps = url.protocol === "https:";
    const securePart = isHttps ? " Secure;" : "";

    headers.set(
      "Set-Cookie",
      `session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800;${securePart}`
    );

    headers.set("Location", "/");
    return new Response(null, { status: 303, headers });
  } catch {
    return new Response("Invalid or expired link", { status: 400 });
  }
};
