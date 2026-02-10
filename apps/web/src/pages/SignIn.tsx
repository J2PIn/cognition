import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function SignIn() {
  const nav = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await apiFetch("/api/auth/request", { method: "POST", body: JSON.stringify({ email }) });
      setStep("code");
      setMsg("Code sent. Check your email.");
    } catch (err: any) {
      setMsg(err.message || "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await apiFetch("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });
      // cookie set by API (requires credentials: include)
      nav("/app");
    } catch (err: any) {
      setMsg(err.message || "Failed to verify code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>Sign in</h1>
      <p style={{ color: "#555" }}>We’ll email you a 6-digit code.</p>

      {msg && (
        <div style={{ background: "#f6f6f6", border: "1px solid #eee", padding: 12, borderRadius: 12, marginTop: 12 }}>
          {msg}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={requestCode} style={{ marginTop: 20, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              type="email"
              required
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </label>
          <button disabled={busy} style={{ padding: 12, borderRadius: 14, border: "1px solid #111", background: "#111", color: "white" }}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} style={{ marginTop: 20, display: "grid", gap: 12 }}>
          <div style={{ color: "#444", fontSize: 14 }}>
            Code sent to <b>{email}</b>
            <button
              type="button"
              onClick={() => setStep("email")}
              style={{ marginLeft: 10, border: "none", background: "transparent", color: "#111", textDecoration: "underline", cursor: "pointer" }}
            >
              change
            </button>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            6-digit code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              required
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", letterSpacing: 4, fontSize: 18 }}
            />
          </label>

          <button disabled={busy || code.length !== 6} style={{ padding: 12, borderRadius: 14, border: "1px solid #111", background: "#111", color: "white" }}>
            {busy ? "Verifying…" : "Verify & continue"}
          </button>
        </form>
      )}
    </div>
  );
}
