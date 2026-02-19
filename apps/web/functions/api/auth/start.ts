export const onRequestPost = async (ctx: any) => {
  const { request, env } = ctx;
  const { email } = await request.json();

  if (!email) {
    return new Response("Missing email", { status: 400 });
  }

  const token = await createToken(email, env.JWT_SECRET);

  const verifyUrl = `${env.WEB_ORIGIN}/api/auth/verify?token=${token}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: "Your Cognition login link",
      html: `<p>Click to sign in:</p>
             <a href="${verifyUrl}">${verifyUrl}</a>`
    })
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
};

async function createToken(email: string, secret: string) {
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + (15 * 60)
  };

  const text = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(text)
  );

  return btoa(text) + "." + btoa(String.fromCharCode(...new Uint8Array(signature)));
}
