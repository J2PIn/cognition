const API_BASE = import.meta.env.VITE_API_BASE as string;

if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn("Missing VITE_API_BASE. Set it in apps/web/.env");
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = `${API_BASE.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    credentials: "include", // IMPORTANT for cookie auth
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}
