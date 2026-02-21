export const onRequestGet: PagesFunction = async ({ env }) => {
  const keys = Object.keys(env as any).sort();

  const has = (k: string) => {
    const v = (env as any)[k];
    return { present: !!v, len: typeof v === "string" ? v.length : null };
  };

  return new Response(
    JSON.stringify(
      {
        ok: true,
        envKeys: keys, // names only
        keys: {
          RESEND_API_KEY: has("RESEND_API_KEY"),
          EMAIL_FROM: has("EMAIL_FROM"),
          WEB_ORIGIN: has("WEB_ORIGIN"),
        },
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json" } }
  );
};
