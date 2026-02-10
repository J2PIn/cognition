import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px", fontFamily: "system-ui" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>Cognition</div>
        <Link to="/signin" style={{ textDecoration: "none" }}>
          <button style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}>
            Sign in / Get access
          </button>
        </Link>
      </header>

      <main style={{ marginTop: 56 }}>
        <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: 0 }}>
          Readiness, integrity, and cognitive state — as a system.
        </h1>
        <p style={{ fontSize: 18, color: "#444", marginTop: 16, maxWidth: 760 }}>
          Cognition is a lightweight check-in tool that helps you measure baseline performance and detect drift,
          without collecting invasive raw behavioral data.
        </p>

        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/signin" style={{ textDecoration: "none" }}>
            <button style={{ padding: "12px 16px", borderRadius: 14, border: "1px solid #111", background: "#111", color: "white" }}>
              Sign in / Get access
            </button>
          </Link>
          <a href="#how" style={{ alignSelf: "center", color: "#111" }}>How it works →</a>
        </div>

        <section id="how" style={{ marginTop: 64 }}>
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>How it works</h2>
          <ol style={{ margin: 0, paddingLeft: 18, color: "#222" }}>
            <li>Sign in with your email.</li>
            <li>Run a short session and submit summary metrics.</li>
            <li>See readiness signals vs your own baseline.</li>
          </ol>
        </section>

        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>Trust</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#222" }}>
            <li>No tracking pixels.</li>
            <li>No ad networks.</li>
            <li>Cookie is session-only auth.</li>
          </ul>
        </section>
      </main>

      <footer style={{ marginTop: 72, paddingTop: 18, borderTop: "1px solid #eee", color: "#666", fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>© {new Date().getFullYear()} Cognition</div>
          <div>
            Contact: <a href="mailto:hello@provecognition.site">hello@provecognition.site</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
