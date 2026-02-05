import { useEffect, useState } from "react";
import { apiGet } from "../api";

export default function Result() {
  const sid = window.location.pathname.split("/").pop()!;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const r = await apiGet(`/api/session/${sid}`);
      setData(r);
    })();
  }, [sid]);

  if (!data) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!data.ok) return <div style={{ padding: 24 }}>Not found.</div>;

  const readiness = data.session.readiness as string;
  const score = JSON.parse(data.session.score_json || "{}");

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Readiness: {readiness}</h1>
      <p style={{ color: "#555" }}>Compared to your normal performance.</p>

      <div style={{ padding: 12, background: "#f3f3f3", borderRadius: 8 }}>
        <div><b>Risk:</b> {score.risk?.toFixed?.(2) ?? "n/a"}</div>
        <div><b>Baseline pending:</b> {String(score.baselinePending ?? true)}</div>
      </div>

      <button onClick={() => (window.location.href = "/check")} style={{ marginTop: 12, padding: 14, width: "100%" }}>
        Retest
      </button>
    </div>
  );
}
