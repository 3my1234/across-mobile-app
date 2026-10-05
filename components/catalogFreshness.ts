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
let lastFallbackAt = 0;

function notify() {
  for (const listener of listeners) void Promise.resolve().then(listener).catch(() => {});
}

async function poll() {
  if (polling || (AppState.currentState && AppState.currentState !== "active")) return;
  polling = true;
  try {
    const response = await fetchWithTimeout(freshCatalogURL(`${API_URL}/api/v1/catalog/version`), { headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) throw new Error("catalog version unavailable");
    const body = await response.json();
    if (typeof body.change_token !== "string") throw new Error("invalid catalog version");
    const changed = token !== "" && token !== body.change_token;
    const reconnected = lastSuccessAt > 0 && Date.now() - lastSuccessAt > 30000;
    token = body.change_token;
    lastSuccessAt = Date.now();
    if (changed || reconnected) notify();
  } catch {
    // Rolling deployments and temporary connection failures must not leave a
    // screen stale indefinitely. Screens retain their offline data on failure.
    if (Date.now() - lastFallbackAt >= 30000) { lastFallbackAt = Date.now(); notify(); }
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
      timer = setInterval(() => { void poll(); }, 5000);
      subscription = AppState.addEventListener("change", state => {
        if (state === "active") { notify(); void poll(); }
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
