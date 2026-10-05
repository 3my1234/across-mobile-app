import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL } from "./config";
import { fetchWithTimeout } from "./utils";
import { freshCatalogURL, useCatalogFreshness } from "./catalogFreshness";

type Review = { id: string; rating: number; review_text: string; reviewer_name: string; created_at: string };

export function ServiceReviews({ listingId }: { listingId: string }) {
  const [items, setItems] = useState<Review[]>([]);
  const [cursor, setCursor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  const load = useCallback(async (next = "") => {
    const request = ++generation.current;
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ limit: "10" });
      if (next) query.set("cursor", next);
      const response = await fetchWithTimeout(freshCatalogURL(`${API_URL}/api/v1/marketplace/listings/${listingId}/reviews?${query}`), { headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error("Customer reviews could not be loaded.");
      const body = await response.json();
      if (request !== generation.current) return;
      const incoming: Review[] = Array.isArray(body.items) ? body.items : [];
      setItems(current => next ? [...current, ...incoming.filter(item => !current.some(old => old.id === item.id))] : incoming);
      setCursor(body.next_cursor || "");
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : "Reviews unavailable");
    } finally { if (request === generation.current) setBusy(false); }
  }, [listingId]);
  useEffect(() => {
    setItems([]); setCursor(""); void load();
    return invalidateRequests;
  }, [load, invalidateRequests]);
  useCatalogFreshness(() => load());
  return <View style={styles.section}>
    <Text style={styles.title}>Customer reviews</Text>
    <Text style={styles.help}>Reviews from customers with completed service requests.</Text>
    {items.map(item => <View key={item.id} style={styles.review}>
      <View style={styles.row}><Text style={styles.name}>{item.reviewer_name}</Text><Ionicons name="star" size={13} color="#A66A00" /><Text style={styles.score}>{item.rating}/5</Text></View>
      {!!item.review_text && <Text style={styles.body}>{item.review_text}</Text>}
      <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
    </View>)}
    {!busy && !error && !items.length && <Text style={styles.body}>No reviews yet. After your service is completed, open My requests to share your experience.</Text>}
    {!!error && <><Text style={styles.error}>{error}</Text><Pressable disabled={busy} onPress={() => void load()} style={styles.button}><Text style={styles.score}>Retry reviews</Text></Pressable></>}
    {busy && <ActivityIndicator color="#FF4747" />}
    {!!cursor && !error && <Pressable disabled={busy} onPress={() => void load(cursor)} style={styles.button}><Text style={styles.score}>More reviews</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  section: { marginTop: 8, padding: 16, backgroundColor: "#FFF" },
  title: { fontSize: 17, fontWeight: "900", color: "#191919" },
  help: { fontSize: 12, color: "#777", marginTop: 4 },
  review: { borderTopWidth: 1, borderColor: "#EEE", paddingVertical: 12, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { flex: 1, fontWeight: "800", color: "#191919" },
  score: { fontWeight: "800", color: "#A66A00" },
  body: { marginTop: 8, color: "#4F4F4F", lineHeight: 21 },
  date: { color: "#777", fontSize: 11, marginTop: 6 },
  error: { color: "#C9353B", marginTop: 8 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center" }
});
