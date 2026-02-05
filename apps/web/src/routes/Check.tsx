import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";

export default function Check() {
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const me = await apiGet("/api/me");
      if (!me.ok) window.location.href = "/";
      else setReady(true);
    })();
  }, []);

  async function start() {
    const r = await apiPost("/api/session/start", { device_fingerprint: navigator.userAgent });
    if (r.ok) setSessionId(r.sessionId);
  }

  async function finishDemo() {
    // TEMP: fake metrics so you can test end-to-end today.
    // Next step: replace this with real task metrics from the battery UI.
    const metrics = {
      srt_mean_ms: 310,
      srt_lapse_rate: 0.03,
      crt_mean_ms: 480,
      crt_error_rate: 0.06,
      gonogo_false_positive_rate: 0.10,
      wm_error_rate: 0.18,
    };
    const confidence = 72;

    const r = await apiPost("/api/session/complete", { sessionId, metrics, confidence, integrity: 1.0 });
    if (r.ok) window.location.href = `/result/${sessionId}`;
  }

  if (!ready) return null;

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Decision Readiness Check</h1>
      <p style={{ color: "#555" }}>2 minutes. Fast + accurate. Compared to your baseline.</p>

      {!sessionId ? (
        <button onClick={start} style={{ padding: 14, width: "100%" }}>
          Start check
        </button>
      ) : (
        <button onClick={finishDemo} style={{ padding: 14, width: "100%" }}>
          Finish (demo metrics)
        </button>
      )}
    </div>
  );
}
