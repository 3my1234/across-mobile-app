import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, ImageProps } from "react-native";
import { API_URL, FALLBACK_IMAGES } from "./config";
import { normalizeMediaUrl } from "./utils";

type Props = Omit<ImageProps, "source"> & { uri?: string | null; uris?: (string | null | undefined)[]; fallbackUri?: string };

// Retry the original photo before replacing it with a fallback.
export function ResilientImage({ uri, uris, fallbackUri = FALLBACK_IMAGES[0], onError, onLoad, ...props }: Props) {
  const signature = JSON.stringify([...(uris?.length ? uris : [uri]), fallbackUri]);
  const candidates = useMemo(() => Array.from(new Set((JSON.parse(signature) as (string | null | undefined)[])
    .map(value => normalizeMediaUrl(String(value || ""))).filter(Boolean))), [signature]);
  const [attempt, setAttempt] = useState({ index: 0, retry: 0, cycle: 0 });
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false), failed = useRef(false), generation = useRef(0), mounted = useRef(true);
  const current = candidates[attempt.index] || "";
  const requestUri = (attempt.retry || attempt.cycle) && current.startsWith(`${API_URL}/api/v1/public/images/view/`)
    ? `${current}${current.includes("?") ? "&" : "?"}mobile_retry=${attempt.cycle}-${attempt.retry}` : current;
  const requestKey = `${signature}:${attempt.index}:${attempt.retry}:${attempt.cycle}`;
  const activeRequest = useRef(requestKey); activeRequest.current = requestKey;
  useEffect(() => {
    mounted.current = true; generation.current++; loaded.current = false; failed.current = false;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null; setAttempt({ index: 0, retry: 0, cycle: 0 });
    return () => { mounted.current = false; generation.current++; if (retryTimer.current) clearTimeout(retryTimer.current); retryTimer.current = null; };
  }, [signature]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      if (state === "active" && failed.current) {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = null; failed.current = false; loaded.current = false;
        setAttempt(previous => ({ index: 0, retry: 0, cycle: (previous.cycle || 0) + 1 }));
      }
    });
    return () => listener.remove();
  }, []);
  const retry = () => {
    if (!mounted.current || loaded.current || retryTimer.current) return;
    failed.current = true;
    const next = attempt.retry < 2 ? { ...attempt, retry: attempt.retry + 1 }
      : attempt.index < candidates.length - 1 ? { ...attempt, index: attempt.index + 1, retry: 0 } : null;
    if (!next) return;
    const seq = generation.current;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      if (seq === generation.current) { loaded.current = false; setAttempt(next); }
    }, 350 * (attempt.retry + 1));
  };
  // Recover a stalled native image request even when no error event arrives.
  useEffect(() => {
    loaded.current = false;
    const timeout = setTimeout(retry, 10000);
    return () => clearTimeout(timeout);
  }, [requestKey]);
  return <Image {...props} key={requestKey} resizeMethod={props.resizeMethod || "resize"}
    style={[{ backgroundColor: "#E5EBE7" }, props.style]} source={{ uri: requestUri }}
    onLoad={event => {
      if(!mounted.current || activeRequest.current !== requestKey) return;
      loaded.current = true;
      if (attempt.index === 0) failed.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current); retryTimer.current = null;
      onLoad?.(event);
    }} onError={event => { if(!mounted.current || activeRequest.current !== requestKey) return; retry(); onError?.(event); }}/>;
}
