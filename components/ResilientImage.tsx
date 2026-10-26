import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, ImageProps as NativeImageProps } from "react-native";
import { Image, ImageProps } from "expo-image";
import { API_URL, FALLBACK_IMAGES } from "./config";
import { normalizeMediaUrl } from "./utils";

type Props = Omit<ImageProps, "source" | "onLoad" | "onError"> & { uri?: string | null; uris?: (string | null | undefined)[]; fallbackUri?: string; onLoad?:NativeImageProps['onLoad'];onError?:NativeImageProps['onError'] };

// Retry the original photo before replacing it with a fallback.
export function ResilientImage({ uri, uris, fallbackUri = FALLBACK_IMAGES[0], onError, onLoad, ...props }: Props) {
  // Signed S3 URLs can rotate without changing the object. Compare canonical
  // public URLs so a catalogue refresh cannot reset an already loaded bitmap.
  const signature = JSON.stringify(Array.from(new Set([...(uris?.length ? uris : [uri]), fallbackUri]
    .map(value => normalizeMediaUrl(String(value || ""))).filter(Boolean))));
  const candidates = useMemo(() => JSON.parse(signature) as string[], [signature]);
  const [attempt, setAttempt] = useState({ index: 0, retry: 0, cycle: 0 });
  const recovery = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false), failed = useRef(false), generation = useRef(0), mounted = useRef(true);
  const current = candidates[attempt.index] || "";
  const requestUri = (attempt.retry || attempt.cycle) && current.startsWith(`${API_URL}/api/v1/public/images/view/`)
    ? `${current}${current.includes("?") ? "&" : "?"}mobile_retry=${attempt.cycle}-${attempt.retry}` : current;
  const requestKey = `${signature}:${attempt.index}:${attempt.retry}:${attempt.cycle}`;
  const source=useMemo(()=>({uri:requestUri,cacheKey:current}),[requestUri,current]);
  const activeRequest = useRef(requestKey); activeRequest.current = requestKey;
  useEffect(() => {
    mounted.current = true; generation.current++; loaded.current = false; failed.current = false; recovery.current=0;
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
    const timeout = setTimeout(retry, 20000);
    return () => clearTimeout(timeout);
  }, [requestKey]);
  // A temporary CDN/network failure must not leave a mounted catalogue tile on
  // its fallback forever. Retry the original in the foreground, with a bound.
  useEffect(()=>{
    if((attempt.index===0 && attempt.retry<2) || recovery.current>=3)return;
    const timeout=setTimeout(()=>{
      if(!mounted.current || AppState.currentState==='background' || AppState.currentState==='inactive')return;
      if(attempt.index===0 && loaded.current)return;
      recovery.current++;loaded.current=false;failed.current=false;
      setAttempt(previous=>({index:0,retry:0,cycle:previous.cycle+1}));
    },30000*(recovery.current+1));
    return()=>clearTimeout(timeout);
  },[attempt.index,attempt.retry,attempt.cycle,signature]);
  // Keep the same native view when a request retries. Expo Image retains cached
  // bitmaps on disk and in memory instead of remounting a blank native image.
  return <Image {...props} cachePolicy={current.startsWith(`${API_URL}/api/v1/public/images/view/`) ? 'memory-disk' : 'memory'} transition={120}
    style={[{ backgroundColor: "#E5EBE7" }, props.style]} source={source}
    onLoad={event => {
      if(!mounted.current || activeRequest.current !== requestKey) return;
      if(event.source?.url && event.source.url!==requestUri && event.source.url!==current)return;
      loaded.current = true;
      if (attempt.index === 0) failed.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current); retryTimer.current = null;
      onLoad?.({nativeEvent:{source:{uri:requestUri,width:event.source?.width||0,height:event.source?.height||0}}} as Parameters<NonNullable<NativeImageProps['onLoad']>>[0]);
    }} onError={event => { if(!mounted.current || activeRequest.current !== requestKey) return; retry(); onError?.({nativeEvent:{error:event.error}} as Parameters<NonNullable<NativeImageProps['onError']>>[0]); }}/>;
}
