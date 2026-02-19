import React, { useMemo, useState } from "react";



const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

function Logo() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(255,255,255,.18), rgba(255,255,255,.06))",
          border: "1px solid rgba(255,255,255,.14)",
          boxShadow: "0 12px 30px rgba(0,0,0,.35)",
          display: "grid",
          placeItems: "center",
        }}
        aria-hidden
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 6,
            background: "linear-gradient(135deg,#7dd3fc,#a78bfa)",
            boxShadow: "0 10px 20px rgba(167,139,250,.25)",
          }}
        />
      </div>
      <div style={{ fontWeight: 850, letterSpacing: 0.2 }}>Cognition</div>
    </div>
  );
}

async function postJson(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });
  const txt = await res.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch {}
  if (!res.ok) throw new Error(data?.error || txt || `HTTP ${res.status}`);
  return data;
}

export default function App() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => email.includes("@") && email.length > 5, [email]);
  const canVerify = useMemo(() => code.length === 6 && canSend, [code, canSend]);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await postJson("/api/auth/start", { email });
      setSent(true);
      setMsg("Link sent. Check your email.");
    } catch (err: any) {
      setMsg(err?.message || "Failed to send code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await postJson("/api/auth/verify", { email, code });
      setMsg("Signed in ✅");
    } catch (err: any) {
      setMsg(err?.message || "Failed to verify.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "rgba(255,255,255,.92)",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(125,211,252,.22), transparent 60%)," +
          "radial-gradient(900px 500px at 80% 20%, rgba(167,139,250,.18), transparent 55%)," +
          "radial-gradient(900px 600px at 45% 85%, rgba(34,211,238,.12), transparent 55%)," +
          "linear-gradient(180deg, #0b1020, #060814)",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 18px 60px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Logo />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="#how" style={{ color: "rgba(255,255,255,.75)", textDecoration: "none", fontSize: 14 }}>
              How it works
            </a>
            <a href="#signin" style={{ textDecoration: "none" }}>
              <button
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.18)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.92)",
                  cursor: "pointer",
                }}
              >
                Sign in / Get access
              </button>
            </a>
          </div>
        </div>

        {/* Hero */}
        <div style={{ marginTop: 64, display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 28 }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                gap: 10,
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.12)",
                color: "rgba(255,255,255,.8)",
                fontSize: 13,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
              Live beta · email sign-in
            </div>

            <h1 style={{ fontSize: 54, lineHeight: 1.03, margin: "16px 0 0", fontWeight: 900, letterSpacing: -0.6 }}>
              Prove your readiness—
              <span style={{ color: "transparent", WebkitTextFillColor: "transparent", backgroundClip: "text", WebkitBackgroundClip: "text",
                backgroundImage: "linear-gradient(135deg,#7dd3fc,#a78bfa)" }}>
                {" "}fast.
              </span>
            </h1>

            <p style={{ marginTop: 14, fontSize: 18, lineHeight: 1.55, color: "rgba(255,255,255,.75)", maxWidth: 680 }}>
              Short cognitive sessions. Baseline-aware scoring. A single signal: <b>GREEN / YELLOW / RED</b>.
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <a href="#signin" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    padding: "12px 16px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,.18)",
                    background: "linear-gradient(135deg, rgba(125,211,252,.25), rgba(167,139,250,.18))",
                    color: "rgba(255,255,255,.95)",
                    cursor: "pointer",
                    boxShadow: "0 18px 40px rgba(0,0,0,.35)",
                    fontWeight: 800,
                  }}
                >
                  Sign in / Get access
                </button>
              </a>

              <a href="#how" style={{ color: "rgba(255,255,255,.8)", textDecoration: "none", fontSize: 14 }}>
                See the flow →
              </a>

              {!API_BASE && (
                <span style={{ color: "#fca5a5", fontSize: 13 }}>
                  Missing <b>VITE_API_BASE</b> env var in Pages.
                </span>
              )}
            </div>

            {/* Value props */}
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {[
                ["Fast", "2–3 minute sessions"],
                ["Private", "No pixels. No ads."],
                ["Adaptive", "Personal baselines"],
              ].map(([t, d]) => (
                <div
                  key={t}
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    background: "rgba(255,255,255,.05)",
                    border: "1px solid rgba(255,255,255,.10)",
                  }}
                >
                  <div style={{ fontWeight: 850 }}>{t}</div>
                  <div style={{ marginTop: 6, color: "rgba(255,255,255,.72)", fontSize: 14 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right card */}
          <div
            style={{
              borderRadius: 24,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.12)",
              padding: 16,
              boxShadow: "0 24px 70px rgba(0,0,0,.45)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -120,
                background: "radial-gradient(circle at 30% 30%, rgba(125,211,252,.22), transparent 45%), radial-gradient(circle at 70% 40%, rgba(167,139,250,.18), transparent 45%)",
                filter: "blur(10px)",
              }}
              aria-hidden
            />
            <div style={{ position: "relative" }}>
              <div style={{ fontWeight: 850, marginBottom: 8 }}>Your next session</div>
              <div style={{ color: "rgba(255,255,255,.75)", fontSize: 14, lineHeight: 1.5 }}>
                Sign in to run a quick check and get a readiness flag.
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,.7)" }}>
                  <span>Signal</span>
                  <span>Baseline-aware</span>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["GREEN", "All clear", "rgba(34,197,94,.22)", "#22c55e"],
                    ["YELLOW", "Proceed carefully", "rgba(234,179,8,.18)", "#eab308"],
                    ["RED", "Delay / re-check", "rgba(239,68,68,.18)", "#ef4444"],
                  ].map(([k, s, bg, c]) => (
                    <div
                      key={k}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 16,
                        background: bg as string,
                        border: "1px solid rgba(255,255,255,.10)",
                      }}
                    >
                      <div style={{ fontWeight: 900, color: c as string }}>{k}</div>
                      <div style={{ color: "rgba(255,255,255,.78)", fontSize: 13 }}>{s}</div>
                    </div>
                  ))}
                </div>

                <a href="#signin" style={{ textDecoration: "none", marginTop: 4 }}>
                  <button
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: "rgba(255,255,255,.08)",
                      color: "rgba(255,255,255,.92)",
                      cursor: "pointer",
                      fontWeight: 850,
                    }}
                  >
                    Sign in / Get access
                  </button>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div id="how" style={{ marginTop: 64, display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>How it works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {[
              ["1) Email sign-in", "We email you a sign-in link."],
              ["2) Run a session", "Quick tasks, clean summary."],
              ["3) Get a flag", "GREEN / YELLOW / RED."],
            ].map(([t, d]) => (
              <div
                key={t}
                style={{
                  padding: 16,
                  borderRadius: 20,
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.10)",
                }}
              >
                <div style={{ fontWeight: 900 }}>{t}</div>
                <div style={{ marginTop: 8, color: "rgba(255,255,255,.72)", fontSize: 14, lineHeight: 1.5 }}>
                  {d}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sign in */}
        <div id="signin" style={{ marginTop: 50 }}>
          <div
            style={{
              borderRadius: 24,
              padding: 18,
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.12)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Sign in / Get access</div>
              <div style={{ color: "rgba(255,255,255,.72)", marginTop: 8, lineHeight: 1.5 }}>
                We’ll email you a sign-in link. No password.
              </div>

              {msg && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 16,
                  background: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "rgba(255,255,255,.85)"
                }}>
                  {msg}
                </div>
              )}
            </div>

            <div style={{ alignSelf: "center" }}>
              {!sent ? (
                <form onSubmit={sendLink} style={{ display: "grid", gap: 10 }}>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    type="email"
                    required
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(0,0,0,.25)",
                      color: "rgba(255,255,255,.92)",
                      outline: "none",
                    }}
                  />
                  <button
                    disabled={busy || !canSend}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: busy ? "rgba(255,255,255,.08)" : "linear-gradient(135deg, rgba(125,211,252,.25), rgba(167,139,250,.18))",
                      color: "rgba(255,255,255,.95)",
                      cursor: busy || !canSend ? "not-allowed" : "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {busy ? "Sending…" : "Send code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyCode} style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
                    Sent to <b>{email}</b>
                  </div>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    required
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(0,0,0,.25)",
                      color: "rgba(255,255,255,.92)",
                      outline: "none",
                      letterSpacing: 6,
                      fontSize: 18,
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  />
                  <button
                    disabled={busy || !canVerify}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: "rgba(255,255,255,.08)",
                      color: "rgba(255,255,255,.92)",
                      cursor: busy || !canVerify ? "not-allowed" : "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {busy ? "Verifying…" : "Verify"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <footer style={{ marginTop: 54, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.10)", color: "rgba(255,255,255,.6)", fontSize: 13 }}>
          © {new Date().getFullYear()} Cognition
        </footer>
      </div>
    </div>
  );
}
