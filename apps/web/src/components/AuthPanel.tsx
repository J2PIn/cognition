import React from "react";

type MeResponse = { user: { email: string } | null };

export default function AuthPanel() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = React.useState<string | null>(null);
  const [me, setMe] = React.useState<MeResponse>({ user: null });

  async function refreshMe() {
    const r = await fetch("/api/me", { method: "GET" });
    const j = (await r.json()) as MeResponse;
    setMe(j);
  }

  React.useEffect(() => {
    refreshMe().catch(() => {});
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErr(null);

    try {
      const r = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || `Request failed (${r.status})`);
      }

      setStatus("sent");
    } catch (e: any) {
      setStatus("error");
      setErr(e?.message || "Failed to send link");
    }
  }

  return (
    <div style={{ maxWidth: 480, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
      {me.user ? (
        <>
          <div style={{ fontWeight: 600 }}>Signed in</div>
          <div style={{ marginTop: 6, color: "#444" }}>{me.user.email}</div>
          <button
            style={{ marginTop: 12 }}
            onClick={() => refreshMe()}
          >
            Refresh
          </button>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            (Logout can be added next.)
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600 }}>Sign in / Get access</div>
          <form onSubmit={sendLink} style={{ marginTop: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              type="email"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
              }}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                cursor: "pointer",
              }}
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>

          {status === "sent" && (
            <div style={{ marginTop: 10, color: "#1a7f37" }}>
              Link sent. Check your email.
            </div>
          )}
          {status === "error" && (
            <div style={{ marginTop: 10, color: "#b42318" }}>
              {err || "Something went wrong"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
