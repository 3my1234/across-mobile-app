import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, ImageProps } from "react-native";
import { API_URL, FALLBACK_IMAGES } from "./config";
import { normalizeMediaUrl } from "./utils";

type Props = Omit<ImageProps, "source"> & {
  uri?: string | null;
  uris?: (string | null | undefined)[];
  fallbackUri?: string;
};

export function ResilientImage({ uri, uris, fallbackUri = FALLBACK_IMAGES[0], onError, ...props }: Props) {
  const fallback = useMemo(() => normalizeMediaUrl(fallbackUri), [fallbackUri]);
  const candidates = useMemo(() => {
    const normalized = (uris?.length ? uris : [uri])
      .map(value => normalizeMediaUrl(String(value || "")))
      .filter(Boolean);
    return Array.from(new Set([...normalized, fallback]));
  }, [fallback, uri, uris]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [retryCycle, setRetryCycle] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = candidates[candidateIndex] || fallback;
  const requestUri = useMemo(() => {
    if (!retryCycle || !current.includes(`${API_URL}/api/v1/public/images/view/`)) return current;
    return `${current}${current.includes("?") ? "&" : "?"}mobile_retry=${retryCycle}`;
  }, [current, retryCycle]);

  useEffect(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    setCandidateIndex(0);
    setRetryCycle(0);
  }, [candidates]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  return (
    <Image
      key={requestUri}
      {...props}
      source={{ uri: requestUri }}
      onError={(event) => {
        if (candidateIndex < candidates.length - 1) {
          setCandidateIndex(candidateIndex + 1);
        } else if (retryCycle < 2 && !retryTimer.current) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            setCandidateIndex(0);
            setRetryCycle(cycle => cycle + 1);
          }, 450 * (retryCycle + 1));
        }
        onError?.(event);
      }}
    />
  );
}
