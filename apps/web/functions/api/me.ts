export const onRequestGet = async (ctx: any) => {
  const { request, env } = ctx;

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);

  if (!match) {
    return new Response(JSON.stringify({ user: null }));
  }

  const email = await verifySession(match[1], env.JWT_SECRET);

  if (!email) {
    return new Response(JSON.stringify({ user: null }));
  }

  return new Response(JSON.stringify({ user: { email } }), {
    headers: { "Content-Type": "application/json" }
  });
};
