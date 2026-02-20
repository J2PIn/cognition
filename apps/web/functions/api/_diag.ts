export const onRequestGet: PagesFunction = async ({ env }) => {
  const has = (k: string) => {
    const v = (env as any)[k];
    return { present: !!v, len: typeof v === "string" ? v.length : null };
  };

  return new Response(
    JSON.stringify({
      ok: true,
      keys: {
        RESEND_API_KEY: has("RESEND_API_KEY"),
        EMAIL_FROM: has("EMAIL_FROM"),
        WEB_ORIGIN: has("WEB_ORIGIN"),
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
};
