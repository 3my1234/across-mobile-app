import React, { useEffect, useMemo, useState } from "react";
import { Image, ImageProps } from "react-native";
import { FALLBACK_IMAGES } from "./config";
import { normalizeMediaUrl } from "./utils";

type Props = Omit<ImageProps, "source"> & {
  uri?: string | null;
  uris?: Array<string | null | undefined>;
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
  const current = candidates[candidateIndex] || fallback;

  useEffect(() => setCandidateIndex(0), [candidates]);

  return (
    <Image
      {...props}
      source={{ uri: current }}
      onError={(event) => {
        setCandidateIndex(index => Math.min(index + 1, candidates.length - 1));
        onError?.(event);
      }}
    />
  );
}
