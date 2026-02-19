import React, { useState } from "react";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

export default function App() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function api(path: string, body?: any) {
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

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api("/api/auth/request", { email });
      setSent(true);
      setMsg("Code sent. Check your email.");
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
      await api("/api/auth/verify", { email, code });
      setMsg("Signed in ✅");
    } catch (err: any) {
      setMsg(err?.message || "Failed to verify.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "56px 20px", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>Cognition</div>
        <a href="#signin" style={{ textDecoration: "none" }}>
          <button style={{ padding: "10px 14px", borderRadius: 14, border: "1px solid #ddd", background: "white" }}>
            Sign in / Get access
          </button>
        </a>
      </header>

      <main style={{ marginTop: 60 }}>
        <h1 style={{ fontSize: 46, lineHeight: 1.05, margin: 0 }}>
          A readiness check you can trust.
        </h1>
        <p style={{ fontSize: 18, color: "#444", marginTop: 16, maxWidth: 760 }}>
          Lightweight sessions. Baseline-aware scoring. No ads. No tracking pixels.
        </p>

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="#signin" style={{ textDecoration: "none" }}>
            <button style={{ padding: "12px 16px", borderRadius: 16, border: "1px solid #111", background: "#111", color: "white" }}>
              Sign in / Get access
            </button>
          </a>
          <a href="#how" style={{ alignSelf: "center", color: "#111" }}>How it works →</a>
        </div>

        <section id="how" style={{ marginTop: 70 }}>
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>How it works</h2>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#222" }}>
            <li>Sign in with email (6-digit code).</li>
            <li>Run a short session.</li>
            <li>Get a GREEN / YELLOW / RED readiness flag.</li>
          </ol>
        </section>

        <section id="signin" style={{ marginTop: 44, padding: 16, border: "1px solid #eee", borderRadius: 16 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Sign in / Get access</h2>
          <p style={{ color: "#555", marginTop: 8 }}>We’ll email you a 6-digit code.</p>

          {msg && (
            <div style={{ background: "#f6f6f6", border: "1px solid #eee", padding: 10, borderRadius: 12, marginTop: 10 }}>
              {msg}
            </div>
          )}

          {!sent ? (
            <form onSubmit={requestCode} style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 420 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                type="email"
                required
                style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />
              <button disabled={busy} style={{ padding: 12, borderRadius: 14, border: "1px solid #111", background: "#111", color: "white" }}>
                {busy ? "Sending…" : "Send code"}
              </button>
              {!API_BASE && <div style={{ color: "#b00", fontSize: 12 }}>Missing VITE_API_BASE env var.</div>}
            </form>
          ) : (
            <form onSubmit={verifyCode} style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 420 }}>
              <div style={{ fontSize: 13, color: "#444" }}>Sent to <b>{email}</b></div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                required
                style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", letterSpacing: 4, fontSize: 18 }}
              />
              <button disabled={busy || code.length !== 6} style={{ padding: 12, borderRadius: 14, border: "1px solid #111", background: "#111", color: "white" }}>
                {busy ? "Verifying…" : "Verify"}
              </button>
            </form>
          )}
        </section>
      </main>

      <footer style={{ marginTop: 80, paddingTop: 18, borderTop: "1px solid #eee", color: "#666", fontSize: 14 }}>
        © {new Date().getFullYear()} Cognition
      </footer>
    </div>
  );
}
