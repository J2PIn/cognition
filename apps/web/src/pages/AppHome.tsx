import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function AppHome() {
  const nav = useNavigate();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/me", { method: "GET" });
        setUser(res.user);
      } catch (e: any) {
        setErr(e.message || "Not signed in");
        nav("/signin");
      }
    })();
  }, []);

  if (!user) return <div style={{ padding: 40, fontFamily: "system-ui" }}>{err ? err : "Loading…"}</div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>You’re in.</h1>
      <p style={{ color: "#555" }}>Signed in as <b>{user.email}</b></p>

      <div style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 16 }}>
        <div style={{ fontWeight: 700 }}>Next:</div>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li>Run a session</li>
          <li>Submit metrics</li>
          <li>Show readiness vs baseline</li>
        </ul>
      </div>
    </div>
  );
}
