import React, { useMemo, useState } from "react";



const API_BASE = "";
function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildHtmlReport(result: any, userEmail: string) {
  const when = new Date().toISOString();
  const esc = (s: any) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cognition report</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 28px; color:#111827; }
    .card { border:1px solid #e5e7eb; border-radius: 16px; padding: 18px; max-width: 720px; }
    .row { display:flex; gap:12px; flex-wrap:wrap; margin-top: 12px; }
    .pill { display:inline-block; padding:10px 12px; border-radius: 12px; background:#111827; color:#fff; font-weight:800; }
    table { width:100%; border-collapse: collapse; margin-top: 12px; }
    td { border:1px solid #e5e7eb; padding:10px; }
    .muted { color:#6b7280; font-size: 12px; }
    @media print { body { padding: 0; } .card { border: none; } }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin:0 0 6px">Cognition report</h1>
    <div class="muted">Generated: ${esc(when)} • User: ${esc(userEmail)}</div>

    <div class="row">
      <div class="pill">FLAG: ${esc(result.flag)}</div>
      <div style="padding:10px 12px; border-radius:12px; border:1px solid #e5e7eb;">
        <b>Score</b><br/>${esc(result.score)} / 100
      </div>
    </div>

    <table>
      <tr><td><b>RT avg</b></td><td>${esc(result.rtAvgMs)} ms</td></tr>
      <tr><td><b>Stroop acc</b></td><td>${esc(Math.round(result.stroopAcc * 100))}%</td></tr>
      <tr><td><b>Stroop RT</b></td><td>${esc(result.stroopRtMs)} ms</td></tr>
      <tr><td><b>Digits</b></td><td>${esc(Math.round(result.digitsAcc * 100))}%</td></tr>
      <tr><td><b>Baseline z</b></td><td>${esc(result.baselineZ)}</td></tr>
    </table>

    <p class="muted" style="margin-top:14px">
      Tip: Open this file and use <b>Print → Save as PDF</b> if you want a PDF.
    </p>
  </div>
</body>
</html>`;
}

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

type Flag = "GREEN" | "YELLOW" | "RED";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map(x => (x - m) ** 2));
  return Math.sqrt(v);
}

function computeFlag(score: number, baselineScores: number[]): { flag: Flag; z: number } {
  if (baselineScores.length < 5) return { flag: "YELLOW", z: 0 }; // not enough baseline yet
  const m = mean(baselineScores);
  const sd = stdev(baselineScores) || 1;
  const z = (score - m) / sd;

  // score higher = better
  if (z >= -0.5) return { flag: "GREEN", z };
  if (z >= -1.25) return { flag: "YELLOW", z };
  return { flag: "RED", z };
}

function baselineKey(email: string) {
  return `cognition:baseline:${email.toLowerCase()}`;
}

function loadBaseline(email: string): number[] {
  try {
    const raw = localStorage.getItem(baselineKey(email));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function saveBaseline(email: string, nextScores: number[]) {
  localStorage.setItem(baselineKey(email), JSON.stringify(nextScores.slice(-30))); // keep last 30
}

function Session({ email, onDone }: { email: string; onDone: () => void }) {
  const [phase, setPhase] = React.useState<"intro" | "rt" | "stroop" | "digits" | "result">("intro");
  const [busy, setBusy] = React.useState(false);

  // results
  const [rtAvg, setRtAvg] = React.useState<number | null>(null);           // ms (lower is better)
  const [stroopAcc, setStroopAcc] = React.useState<number | null>(null);   // 0..1
  const [stroopRt, setStroopRt] = React.useState<number | null>(null);     // ms (lower is better)
  const [digitAcc, setDigitAcc] = React.useState<number | null>(null);     // 0..1

  const [finalScore, setFinalScore] = React.useState<number | null>(null); // 0..100
  const [flag, setFlag] = React.useState<Flag>("YELLOW");
  const [z, setZ] = React.useState<number>(0);

  function scoreFromMetrics(m: { rtAvg: number; stroopAcc: number; stroopRt: number; digitAcc: number }) {
    // Normalize into 0..1 components
    const rt = clamp((900 - m.rtAvg) / 600, 0, 1);          // 300ms => 1, 900ms => 0
    const srt = clamp((1100 - m.stroopRt) / 700, 0, 1);     // 400ms => 1, 1100ms => 0
    const acc = clamp(m.stroopAcc, 0, 1);
    const dacc = clamp(m.digitAcc, 0, 1);

    // Weighted sum (tweak later)
    const raw = 0.38 * rt + 0.22 * srt + 0.25 * acc + 0.15 * dacc;
    return Math.round(raw * 100);
  }

  async function finish() {
    if (rtAvg == null || stroopAcc == null || stroopRt == null || digitAcc == null) return;

    const score = scoreFromMetrics({ rtAvg, stroopAcc, stroopRt, digitAcc });
    const base = loadBaseline(email);
    const nextBase = [...base, score];
    saveBaseline(email, nextBase);

    const { flag, z } = computeFlag(score, nextBase.slice(0, -1)); // compare to *previous* baseline
    setFinalScore(score);
    setFlag(flag);
    setZ(z);
    setPhase("result");
  }
    function currentResultPayload() {
    return {
      score: finalScore ?? 0,
      flag,
      rtAvgMs: rtAvg ?? 0,
      stroopAcc: stroopAcc ?? 0,
      stroopRtMs: stroopRt ?? 0,
      digitsAcc: digitAcc ?? 0,
      baselineZ: z,
      createdAtISO: new Date().toISOString(),
    };
  }

  async function shareResult() {
    const to = prompt("Send result to email:", "");
    if (!to) return;

    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/results/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to, result: currentResultPayload() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) alert(j?.error ?? "Failed to send");
      else alert("Sent!");
    } finally {
      setBusy(false);
    }
  }

  function downloadReport() {
    const r = currentResultPayload();
    const html = buildHtmlReport(r, email);
    const name = `cognition-report-${new Date().toISOString().slice(0, 10)}.html`;
    downloadText(name, html, "text/html");
  }
  // --- Reaction time test ---
  const [rtTrial, setRtTrial] = React.useState(0);
  const [rtPrompt, setRtPrompt] = React.useState<"wait" | "go" | "tooSoon">("wait");
  const [rtTimes, setRtTimes] = React.useState<number[]>([]);
  const goAtRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<number | null>(null);

  function rtStart() {
    setRtTimes([]);
    setRtTrial(0);
    setRtPrompt("wait");
    goAtRef.current = null;

    // random delay then GO
    const delay = 700 + Math.random() * 1600;
    timerRef.current = window.setTimeout(() => {
      setRtPrompt("go");
      goAtRef.current = performance.now();
    }, delay);
  }

  function rtTap() {
    if (rtPrompt === "wait") {
      setRtPrompt("tooSoon");
      if (timerRef.current) window.clearTimeout(timerRef.current);
      // restart trial
      window.setTimeout(() => {
        setRtPrompt("wait");
        rtStart();
      }, 800);
      return;
    }
    if (rtPrompt === "go" && goAtRef.current != null) {
      const t = performance.now() - goAtRef.current;
      const next = [...rtTimes, t];
      setRtTimes(next);

      const nextTrial = rtTrial + 1;
      setRtTrial(nextTrial);

      if (nextTrial >= 5) {
        const avg = Math.round(mean(next));
        setRtAvg(avg);
        setPhase("stroop");
        return;
      }

      setRtPrompt("wait");
      goAtRef.current = null;

      // schedule next GO
      const delay = 700 + Math.random() * 1600;
      timerRef.current = window.setTimeout(() => {
        setRtPrompt("go");
        goAtRef.current = performance.now();
      }, delay);
    }
  }

  // --- Stroop-lite ---
  const COLORS = [
    { name: "RED", css: "#ef4444" },
    { name: "GREEN", css: "#22c55e" },
    { name: "YELLOW", css: "#eab308" },
    { name: "BLUE", css: "#60a5fa" },
  ] as const;

  type StroopTrial = { word: typeof COLORS[number]["name"]; ink: typeof COLORS[number]["name"] };

  const [stroopIdx, setStroopIdx] = React.useState(0);
  const [stroopTrials, setStroopTrials] = React.useState<StroopTrial[]>([]);
  const [stroopCorrect, setStroopCorrect] = React.useState(0);
  const [stroopStartAt, setStroopStartAt] = React.useState<number | null>(null);
  const [stroopTimes, setStroopTimes] = React.useState<number[]>([]);

  function makeStroopTrials(n: number): StroopTrial[] {
    const names = COLORS.map(c => c.name);
    const out: StroopTrial[] = [];
    for (let i = 0; i < n; i++) {
      const word = names[Math.floor(Math.random() * names.length)];
      const ink = names[Math.floor(Math.random() * names.length)];
      out.push({ word, ink });
    }
    return out;
  }

  function stroopBegin() {
    const trials = makeStroopTrials(12);
    setStroopTrials(trials);
    setStroopIdx(0);
    setStroopCorrect(0);
    setStroopTimes([]);
    setStroopStartAt(performance.now());
  }

  function stroopAnswer(ans: StroopTrial["ink"]) {
    const t0 = stroopStartAt ?? performance.now();
    const dt = performance.now() - t0;
    setStroopStartAt(performance.now());

    const cur = stroopTrials[stroopIdx];
    const ok = cur && ans === cur.ink;
    setStroopCorrect((c) => c + (ok ? 1 : 0));
    setStroopTimes((xs) => [...xs, dt]);

    const next = stroopIdx + 1;
    if (next >= stroopTrials.length) {
      const acc = (stroopCorrect + (ok ? 1 : 0)) / stroopTrials.length;
      setStroopAcc(acc);
      setStroopRt(Math.round(mean([...stroopTimes, dt])));
      setPhase("digits");
      return;
    }
    setStroopIdx(next);
  }

  // --- Digit recall ---
  const [digitIdx, setDigitIdx] = React.useState(0);
  const [digitTarget, setDigitTarget] = React.useState("");
  const [digitShow, setDigitShow] = React.useState(true);
  const [digitInput, setDigitInput] = React.useState("");
  const [digitCorrect, setDigitCorrect] = React.useState(0);

  function newDigits(len: number) {
    let s = "";
    for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10).toString();
    return s;
  }

  function digitsBegin() {
    setDigitIdx(0);
    setDigitCorrect(0);
    const t = newDigits(7);
    setDigitTarget(t);
    setDigitInput("");
    setDigitShow(true);
    window.setTimeout(() => setDigitShow(false), 1400);
  }

  function digitsSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = digitInput.trim() === digitTarget;
    setDigitCorrect((c) => c + (ok ? 1 : 0));

    const next = digitIdx + 1;
    if (next >= 5) {
      const acc = (digitCorrect + (ok ? 1 : 0)) / 5;
      setDigitAcc(acc);
      finish();
      return;
    }

    setDigitIdx(next);
    const t = newDigits(7);
    setDigitTarget(t);
    setDigitInput("");
    setDigitShow(true);
    window.setTimeout(() => setDigitShow(false), 1400);
  }

  React.useEffect(() => {
    if (phase === "rt") rtStart();
    if (phase === "stroop") stroopBegin();
    if (phase === "digits") digitsBegin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const cardStyle: React.CSSProperties = {
    borderRadius: 24,
    padding: 18,
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.12)",
  };

  if (phase === "intro") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Session (2–3 min)</div>
        <div style={{ color: "rgba(255,255,255,.72)", marginTop: 8, lineHeight: 1.5 }}>
          You’re signed in as <b>{email}</b>. This session will calibrate your baseline and output a readiness flag.
        </div>
        <button
          onClick={() => setPhase("rt")}
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.16)",
            background: "linear-gradient(135deg, rgba(125,211,252,.25), rgba(167,139,250,.18))",
            color: "rgba(255,255,255,.95)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Start session
        </button>
      </div>
    );
  }

  if (phase === "rt") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>1/3 Reaction time</div>
        <div style={{ color: "rgba(255,255,255,.72)", marginTop: 8 }}>
          Trial {rtTrial + 1}/5 — click when it says <b>GO</b>. If you click too early, the trial restarts.
        </div>

        <div
          onClick={rtTap}
          style={{
            marginTop: 14,
            height: 120,
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,.14)",
            background: rtPrompt === "go" ? "rgba(34,197,94,.18)" : "rgba(0,0,0,.22)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            userSelect: "none",
            fontWeight: 900,
            fontSize: 22,
          }}
        >
          {rtPrompt === "wait" && "WAIT"}
          {rtPrompt === "go" && "GO"}
          {rtPrompt === "tooSoon" && "TOO SOON"}
        </div>

        <div style={{ marginTop: 12, color: "rgba(255,255,255,.65)", fontSize: 13 }}>
          Tip: you can also map this to Space later — MVP is click.
        </div>
      </div>
    );
  }

  if (phase === "stroop") {
    const cur = stroopTrials[stroopIdx];
    const inkCss = COLORS.find(c => c.name === cur?.ink)?.css ?? "#fff";

    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>2/3 Stroop</div>
        <div style={{ color: "rgba(255,255,255,.72)", marginTop: 8 }}>
          Pick the <b>ink color</b> (not the word). {stroopIdx + 1}/{stroopTrials.length}
        </div>

        <div style={{ marginTop: 16, display: "grid", placeItems: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 950, color: inkCss, letterSpacing: 1 }}>
            {cur?.word}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {COLORS.map(c => (
            <button
              key={c.name}
              onClick={() => stroopAnswer(c.name)}
              style={{
                padding: "12px 10px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(255,255,255,.06)",
                color: "rgba(255,255,255,.92)",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "digits") {
    return (
      <div style={cardStyle}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>3/3 Digit recall</div>
        <div style={{ color: "rgba(255,255,255,.72)", marginTop: 8 }}>
          Memorize the digits, then type them. {digitIdx + 1}/5
        </div>

        <div style={{ marginTop: 14, display: "grid", placeItems: "center" }}>
          <div
            style={{
              height: 80,
              width: "100%",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,.14)",
              background: "rgba(0,0,0,.22)",
              display: "grid",
              placeItems: "center",
              fontWeight: 950,
              fontSize: 34,
              letterSpacing: 6,
              color: "rgba(255,255,255,.92)",
            }}
          >
            {digitShow ? digitTarget : "•••••••"}
          </div>
        </div>

        {!digitShow && (
          <form onSubmit={digitsSubmit} style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <input
              value={digitInput}
              onChange={(e) => setDigitInput(e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder="Type the digits"
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
              disabled={busy}
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(255,255,255,.08)",
                color: "rgba(255,255,255,.92)",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Submit
            </button>
          </form>
        )}
      </div>
    );
  }

  // result
  const flagBg =
    flag === "GREEN" ? "rgba(34,197,94,.18)" :
    flag === "YELLOW" ? "rgba(234,179,8,.16)" :
    "rgba(239,68,68,.16)";

  const flagColor =
    flag === "GREEN" ? "#22c55e" :
    flag === "YELLOW" ? "#eab308" :
    "#ef4444";

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Result</div>
          <div style={{ color: "rgba(255,255,255,.72)", marginTop: 6 }}>
            Score: <b>{finalScore ?? "—"}</b> / 100
          </div>
          <div style={{ color: "rgba(255,255,255,.55)", marginTop: 6, fontSize: 13 }}>
            Baseline z: {Number.isFinite(z) ? z.toFixed(2) : "—"} (needs 5+ sessions for stability)
          </div>
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,.14)",
            background: flagBg,
            color: flagColor,
            fontWeight: 950,
            fontSize: 20,
            alignSelf: "center",
          }}
        >
          {flag}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        <Metric label="RT avg" value={rtAvg != null ? `${rtAvg} ms` : "—"} />
        <Metric label="Stroop acc" value={stroopAcc != null ? `${Math.round(stroopAcc * 100)}%` : "—"} />
        <Metric label="Stroop RT" value={stroopRt != null ? `${stroopRt} ms` : "—"} />
        <Metric label="Digits" value={digitAcc != null ? `${Math.round(digitAcc * 100)}%` : "—"} />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => setPhase("intro")}
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.16)",
            background: "rgba(255,255,255,.08)",
            color: "rgba(255,255,255,.92)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Run again
        </button>
        <button
          onClick={onDone}
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.16)",
            background: "rgba(255,255,255,.08)",
            color: "rgba(255,255,255,.92)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
                  <button
          onClick={shareResult}
          disabled={busy}
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.16)",
            background: "rgba(255,255,255,.08)",
            color: "rgba(255,255,255,.92)",
            cursor: "pointer",
            fontWeight: 900,
            opacity: busy ? 0.6 : 1,
          }}
        >
          Share via email
        </button>

        <button
          onClick={downloadReport}
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.16)",
            background: "rgba(255,255,255,.08)",
            color: "rgba(255,255,255,.92)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Download report
        </button>
          Back to landing
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        background: "rgba(255,255,255,.05)",
        border: "1px solid rgba(255,255,255,.10)",
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)" }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

export default function App() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSend = useMemo(() => email.includes("@") && email.length > 5, [email]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  async function refreshMe() {
    try {
      const r = await fetch("/api/me", { credentials: "include" });
      const j = await r.json();
      setUserEmail(j?.user?.email ?? null);
    } catch {
      setUserEmail(null);
    }
  }
  
  React.useEffect(() => {
    refreshMe();
  }, []);

  

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await postJson("/api/auth/start", { email });
      setSent(true);
      setMsg("Link sent. Check your email.");
    } catch (err: any) {
      setMsg(err?.message || "Failed to send link.");
    } finally {
      setBusy(false);
    }
  }

    // If we have a signed-in user, show the actual test session UI
  if (userEmail) {
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Logo />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
                Signed in as <b>{userEmail}</b>
              </div>
              <button
                onClick={() => {
                  // Minimal "sign out" UX for now: just forget local UI state
                  // (real logout endpoint can be added later)
                  setUserEmail(null);
                  setSent(false);
                  setMsg(null);
                }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.18)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.92)",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Back to landing
              </button>
            </div>
          </div>

          <div style={{ marginTop: 34, maxWidth: 720 }}>
            <Session
              email={userEmail}
              onDone={() => {
                setUserEmail(null);
                setSent(false);
                setMsg(null);
              }}
            />
          </div>

          <footer style={{ marginTop: 54, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.10)", color: "rgba(255,255,255,.6)", fontSize: 13 }}>
            © {new Date().getFullYear()} Cognition
          </footer>
        </div>
      </div>
    );
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
                <form onSubmit={requestCode} style={{ display: "grid", gap: 10 }}>
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
                      background: busy
                        ? "rgba(255,255,255,.08)"
                        : "linear-gradient(135deg, rgba(125,211,252,.25), rgba(167,139,250,.18))",
                      color: "rgba(255,255,255,.95)",
                      cursor: busy || !canSend ? "not-allowed" : "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {busy ? "Sending…" : "Email me a link"}
                  </button>
                </form>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)" }}>
                    Sent to <b>{email}</b>
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.75)", lineHeight: 1.5 }}>
                    Open the email and click the sign-in link.
                  </div>
                  <button
                    type="button"
                    onClick={refreshMe}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: "linear-gradient(135deg, rgba(125,211,252,.25), rgba(167,139,250,.18))",
                      color: "rgba(255,255,255,.95)",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    I clicked the link — continue
                  </button>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,.16)",
                      background: "rgba(255,255,255,.08)",
                      color: "rgba(255,255,255,.92)",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Use a different email
                  </button>
                </div>
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
