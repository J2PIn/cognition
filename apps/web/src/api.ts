const API_BASE = import.meta.env.VITE_API_BASE as string;

export async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include", // IMPORTANT for cookie auth
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
  });
  return res.json();
}
