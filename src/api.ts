import type { CheckResult } from "../lib/types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({ error: `Server error (HTTP ${res.status}).` }));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export function checkInput(input: string) {
  return call<CheckResult>("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
}

export function getResult(id: string) {
  return call<CheckResult>(`/api/result?id=${encodeURIComponent(id)}`);
}
