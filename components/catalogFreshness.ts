import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { API_URL } from "./config";
import { fetchWithTimeout } from "./utils";

export function freshCatalogURL(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}refresh=${Date.now()}`;
}

const listeners = new Set<() => void | Promise<unknown>>();
let timer: ReturnType<typeof setInterval> | null = null;
let subscription: ReturnType<typeof AppState.addEventListener> | null = null;
let polling = false;
let token = "";
let lastSuccessAt = 0;
let failures = 0;
let retryAt = 0;

function notify() {
  for (const listener of listeners) void Promise.resolve().then(listener).catch(() => {});
}

async function poll(force = false) {
  if (polling || (!force && Date.now() < retryAt) || (AppState.currentState && AppState.currentState !== "active")) return;
  polling = true;
  try {
    const response = await fetchWithTimeout(freshCatalogURL(`${API_URL}/api/v1/catalog/version`), { headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) {
      const retry = Number(response.headers?.get?.("Retry-After"));
      if ((response.status === 429 || response.status === 503) && Number.isFinite(retry) && retry > 0) retryAt = Date.now() + Math.min(3600, retry) * 1000;
      throw new Error("catalog version unavailable");
    }
    const body = await response.json();
    if (typeof body.change_token !== "string") throw new Error("invalid catalog version");
    const changed = token !== "" && token !== body.change_token;
    const reconnected = lastSuccessAt > 0 && Date.now() - lastSuccessAt > 30000;
    token = body.change_token;
    lastSuccessAt = Date.now();
    failures = 0; retryAt = 0;
    if (changed || reconnected) notify();
  } catch {
    // Do not turn a failed tiny heartbeat into a full-catalogue request storm.
    // Keep existing content, back off, and invalidate after a successful recovery.
    failures = Math.min(failures + 1, 4);
    retryAt = Math.max(retryAt, Date.now() + Math.min(120000, 15000 * 2 ** (failures - 1)));
  } finally { polling = false; }
}

// One lightweight version request serves every mounted catalogue screen.
// Pause background polling; resume immediately when the buyer returns.
export function useCatalogFreshness(refresh: () => void | Promise<unknown>, enabled = true) {
  const currentRefresh = useRef(refresh);
  currentRefresh.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const listener = () => currentRefresh.current();
    listeners.add(listener);
    if (!timer) {
      void poll();
      timer = setInterval(() => { void poll(); }, 15000 + Math.floor(Math.random() * 3000));
      subscription = AppState.addEventListener("change", state => {
        if (state === "active") { notify(); void poll(true); }
      });
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        if (timer) clearInterval(timer);
        timer = null;
        subscription?.remove();
        subscription = null;
      }
    };
  }, [enabled]);
}
