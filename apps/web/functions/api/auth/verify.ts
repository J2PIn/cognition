export const onRequestGet = async (ctx: any) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  const email = await verifyToken(token, env.JWT_SECRET);
  if (!email) {
    return new Response("Invalid token", { status: 401 });
  }

  const sessionToken = await createSession(email, env.JWT_SECRET);

  return new Response(null, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
    }
  });
};

// implement verifyToken + createSession similar to above
