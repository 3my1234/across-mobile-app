import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_URL, BOTTOM_NAV_HEIGHT } from "./config";
import { ResilientImage } from "./ResilientImage";
import { fetchWithTimeout } from "./utils";

type Listing = {
  id: string;
  listing_type: string;
  title: string;
  description: string;
  category: string;
  address_line?: string;
  city: string;
  state: string;
  price: number | null;
  currency_code: string;
  pricing_unit: string;
  provider_name: string;
  media_urls: string[];
  direct_booking: boolean;
  safety_warning?: string;
};

type Slot = { id: string; starts_at: string; ends_at: string; remaining: number };
type BuyerRequest = {
  id: string;
  request_type: string;
  status: string;
  starts_at?: string | null;
  listing_title: string;
  listing_type: string;
  provider_name: string;
  message?: string;
  created_at: string;
};

const LISTING_TYPES = [
  { key: "", label: "All" },
  { key: "hotel", label: "Hotels" },
  { key: "short_let", label: "Short lets" },
  { key: "car_rental", label: "Car rentals" },
  { key: "car_wash", label: "Car wash" },
  { key: "shop_rental", label: "Shops" },
  { key: "property", label: "Property" },
  { key: "land", label: "Land" }
];

const money = (value: number | null, currency = "NGN") => value == null
  ? "Enquire for price"
  : new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

function apiMessage(body: any, fallback: string) {
  return String(body?.message || body?.error || fallback);
}

export function MarketplaceScreen({ token, bottomInset = 0 }: { token: string | null; bottomInset?: number }) {
  const { width: viewportWidth } = useWindowDimensions();
  const [mode, setMode] = useState<"explore" | "requests">("explore");
  const [items, setItems] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listingCursor, setListingCursor] = useState("");
  const [requestCursor, setRequestCursor] = useState("");
  const [error, setError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [slotId, setSlotId] = useState("");
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [contact, setContact] = useState<{ email?: string; phone?: string } | null>(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token || ""}` }), [token]);

  const loadListings = useCallback(async (refresh = false, cursor = "") => {
    refresh ? setRefreshing(true) : cursor ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "24" });
      if (type) query.set("type", type);
      if (search.trim()) query.set("search", search.trim());
      if (cursor) query.set("cursor", cursor);
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings?${query.toString()}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Services are temporarily unavailable"));
      const incoming: Listing[] = Array.isArray(body.items) ? body.items : [];
      setItems(current => cursor ? [...current, ...incoming.filter(item => !current.some(existing => existing.id === item.id))] : incoming);
      setListingCursor(String(body.next_cursor || ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Services are temporarily unavailable");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [search, type]);

  const loadRequests = useCallback(async (refresh = false, cursor = "") => {
    refresh ? setRefreshing(true) : cursor ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "24" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/requests?${query.toString()}`, { headers: authHeaders });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Your requests could not be loaded"));
      const incoming: BuyerRequest[] = Array.isArray(body.items) ? body.items : [];
      setRequests(current => cursor ? [...current, ...incoming.filter(item => !current.some(existing => existing.id === item.id))] : incoming);
      setRequestCursor(String(body.next_cursor || ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your requests could not be loaded");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === "explore") void loadListings();
      else void loadRequests();
    }, mode === "explore" ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadListings, loadRequests, mode]);

  async function openListing(item: Listing) {
    setSelected(item);
    setContact(null);
    setSafetyAcknowledged(false);
    setSlotId("");
    setSlots([]);
    setError("");
    try {
      const detailResponse = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${item.id}`);
      if (detailResponse.ok) setSelected(await detailResponse.json());
      if (item.direct_booking) {
        const slotResponse = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${item.id}/availability`);
        if (slotResponse.ok) {
          const body = await slotResponse.json();
          setSlots(Array.isArray(body.items) ? body.items : []);
        }
      }
    } catch {
      // The public-list payload is complete enough to keep the detail usable offline/intermittently.
    }
  }

  async function revealContact() {
    if (!selected) return;
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${selected.id}/contact`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ safety_acknowledged: safetyAcknowledged })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Contact unavailable"));
      setContact(body);
    } catch (contactError) {
      Alert.alert("Contact unavailable", contactError instanceof Error ? contactError.message : "Please try again.");
    }
  }

  async function submitRequest() {
    if (!selected) return;
    if (!selected.direct_booking && !safetyAcknowledged) {
      Alert.alert("Safety acknowledgement required", "Read and accept the safety notice before sending an enquiry.");
      return;
    }
    setLoading(true);
    try {
      const requestType = selected.direct_booking
        ? (selected.listing_type === "car_wash" ? "appointment" : "booking")
        : (selected.listing_type === "shop_rental" ? "inspection" : "enquiry");
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${selected.id}/requests`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: requestType,
          slot_id: slotId || undefined,
          party_size: Math.max(1, Number(partySize) || 1),
          message: requestMessage.trim(),
          idempotency_key: `${selected.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Request could not be sent"));
      setRequestMessage("");
      Alert.alert("Request sent", selected.direct_booking
        ? "The provider will review and confirm your request."
        : "The provider will respond to your enquiry.");
      void loadRequests();
    } catch (requestError) {
      Alert.alert("Unable to send", requestError instanceof Error ? requestError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const heading = LISTING_TYPES.find(item => item.key === type)?.label || "Services";
  const detailBottomPadding = bottomInset + BOTTOM_NAV_HEIGHT + 32;

  if (selected) {
    const requiresSafetyAcknowledgement = !selected.direct_booking;
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: detailBottomPadding }}
        >
          <View style={styles.detailHeader}>
            <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to services">
              <Ionicons name="arrow-back" size={25} />
            </Pressable>
            <Text style={styles.detailHeaderTitle} numberOfLines={1}>{selected.title}</Text>
          </View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {(selected.media_urls?.length ? selected.media_urls : [""]).map((uri, index) => (
              <ResilientImage key={`${uri}-${index}`} uri={uri} style={[styles.hero, { width: viewportWidth }]} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={styles.section}>
            <Text style={styles.kicker}>{selected.listing_type.replaceAll("_", " ")} · verified provider</Text>
            <Text style={styles.title}>{selected.title}</Text>
            <Text style={styles.price}>{money(selected.price, selected.currency_code)}{selected.price != null && selected.pricing_unit ? ` / ${selected.pricing_unit}` : ""}</Text>
            <Text style={styles.meta}>{selected.provider_name} · {selected.city}, {selected.state}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this service</Text>
            <Text style={styles.body}>{selected.description}</Text>
          </View>
          {requiresSafetyAcknowledgement && (
            <View style={styles.warning}>
              <Ionicons name="warning" size={22} color="#9A5B00" />
              <View style={styles.grow}>
                <Text style={styles.warningTitle}>Inspect and verify before you pay</Text>
                <Text style={styles.warningText}>{selected.safety_warning || "Inspect the property in person and verify the provider's authority to offer it. Do not make advance payments before verification."}</Text>
                <Pressable style={styles.checkRow} onPress={() => setSafetyAcknowledged(value => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: safetyAcknowledged }}>
                  <Ionicons name={safetyAcknowledged ? "checkbox" : "square-outline"} size={23} color="#FF4747" />
                  <Text style={styles.grow}>I understand this safety notice.</Text>
                </Pressable>
              </View>
            </View>
          )}
          {selected.direct_booking && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose availability</Text>
              {slots.length ? slots.map(slot => (
                <Pressable key={slot.id} onPress={() => setSlotId(current => current === slot.id ? "" : slot.id)} style={[styles.slot, slotId === slot.id && styles.slotActive]}>
                  <Ionicons name={slotId === slot.id ? "radio-button-on" : "radio-button-off"} size={20} color="#FF4747" />
                  <Text style={styles.grow}>{new Date(slot.starts_at).toLocaleString()} · {slot.remaining} left</Text>
                </Pressable>
              )) : <Text style={styles.meta}>No fixed time slots are published. You can still send a flexible booking request.</Text>}
              <TextInput value={partySize} onChangeText={setPartySize} keyboardType="number-pad" placeholder="Guests / vehicles" style={styles.input} />
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{selected.direct_booking ? "Request booking" : "Send an enquiry"}</Text>
            <TextInput value={requestMessage} onChangeText={setRequestMessage} placeholder="Tell the provider what you need" multiline style={[styles.input, styles.textarea]} />
            <Pressable disabled={loading} style={[styles.primary, loading && styles.disabled]} onPress={submitRequest}>
              <Text style={styles.primaryText}>{loading ? "Sending…" : selected.direct_booking ? "Request booking" : "Send enquiry"}</Text>
            </Pressable>
            <Pressable disabled={requiresSafetyAcknowledgement && !safetyAcknowledged} style={[styles.secondary, requiresSafetyAcknowledgement && !safetyAcknowledged && styles.disabled]} onPress={revealContact}>
              <Text style={styles.secondaryText}>View verified provider contact</Text>
            </Pressable>
            {contact && (
              <View style={styles.contact}>
                <Text style={styles.sectionTitle}>Provider contact</Text>
                {!!contact.phone && <Pressable onPress={() => Linking.openURL(`tel:${contact.phone}`)}><Text style={styles.link}>{contact.phone}</Text></Pressable>}
                {!!contact.email && <Pressable onPress={() => Linking.openURL(`mailto:${contact.email}`)}><Text style={styles.link}>{contact.email}</Text></Pressable>}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.modeBar}>
        <Pressable style={[styles.modeButton, mode === "explore" && styles.modeButtonActive]} onPress={() => setMode("explore")}><Text style={[styles.modeText, mode === "explore" && styles.modeTextActive]}>Explore</Text></Pressable>
        <Pressable style={[styles.modeButton, mode === "requests" && styles.modeButtonActive]} onPress={() => setMode("requests")}><Text style={[styles.modeText, mode === "requests" && styles.modeTextActive]}>My requests</Text></Pressable>
      </View>
      {mode === "explore" ? (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={20} color="#777" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Hotels, cars, property, services" style={styles.grow} returnKeyType="search" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {LISTING_TYPES.map(item => <Pressable key={item.key} onPress={() => setType(item.key)} style={[styles.chip, type === item.key && styles.chipActive]}><Text style={[styles.chipText, type === item.key && styles.chipTextActive]}>{item.label}</Text></Pressable>)}
          </ScrollView>
          <View style={styles.listHeading}><Text style={styles.sectionTitle}>{heading}</Text><Text style={styles.meta}>{items.length} verified listings</Text></View>
          {loading && !items.length ? <ActivityIndicator color="#FF4747" style={styles.loader} /> : (
            <FlatList
              data={items}
              keyExtractor={item => item.id}
              numColumns={2}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadListings(true)} tintColor="#FF4747" />}
              onEndReached={() => { if (listingCursor && !loadingMore) void loadListings(false, listingCursor); }}
              onEndReachedThreshold={0.35}
              contentContainerStyle={{ padding: 8, paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 24 }}
              columnWrapperStyle={styles.columns}
              renderItem={({ item }) => (
                <Pressable style={styles.card} onPress={() => void openListing(item)}>
                  <ResilientImage uri={item.media_urls?.[0]} uris={item.media_urls} style={styles.cardImage} resizeMode="cover" />
                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardPrice}>{money(item.price, item.currency_code)}</Text>
                    <Text numberOfLines={1} style={styles.meta}>{item.city} · {item.provider_name}</Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={<EmptyState icon="business-outline" title="No matching verified listings" message={error || "Try another search or category."} />}
              ListFooterComponent={loadingMore ? <ActivityIndicator color="#FF4747" style={styles.pageLoader} /> : null}
            />
          )}
        </>
      ) : loading && !requests.length ? <ActivityIndicator color="#FF4747" style={styles.loader} /> : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadRequests(true)} tintColor="#FF4747" />}
          onEndReached={() => { if (requestCursor && !loadingMore) void loadRequests(false, requestCursor); }}
          onEndReachedThreshold={0.35}
          contentContainerStyle={{ padding: 12, paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 24 }}
          renderItem={({ item }) => (
            <View style={styles.requestCard}>
              <View style={styles.requestHeader}><Text style={styles.requestTitle} numberOfLines={2}>{item.listing_title}</Text><Text style={styles.status}>{item.status.replaceAll("_", " ")}</Text></View>
              <Text style={styles.meta}>{item.provider_name} · {item.request_type.replaceAll("_", " ")}</Text>
              {!!item.starts_at && <Text style={styles.requestDate}>{new Date(item.starts_at).toLocaleString()}</Text>}
              {!!item.message && <Text style={styles.body}>{item.message}</Text>}
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No requests yet" message={error || "Bookings and enquiries you send will appear here."} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#FF4747" style={styles.pageLoader} /> : null}
        />
      )}
    </View>
  );
}

function EmptyState({ icon, title, message }: { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }) {
  return <View style={styles.empty}><Ionicons name={icon} size={42} color="#AAA" /><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.emptyText}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#F7F7F7" },
  grow: { flex: 1 },
  loader: { marginTop: 50 },
  pageLoader: { marginVertical: 18 },
  modeBar: { marginHorizontal: 12, marginTop: 10, padding: 4, borderRadius: 12, backgroundColor: "#EDEDED", flexDirection: "row" },
  modeButton: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  modeButtonActive: { backgroundColor: "#FFF" },
  modeText: { color: "#777", fontWeight: "800" },
  modeTextActive: { color: "#191919" },
  search: { minHeight: 48, margin: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#E8E8E8" },
  chips: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E5E5" },
  chipActive: { backgroundColor: "#FF4747", borderColor: "#FF4747" },
  chipText: { fontWeight: "700", color: "#555" },
  chipTextActive: { color: "#FFF" },
  listHeading: { paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  columns: { gap: 8 },
  card: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", marginBottom: 8, maxWidth: "49%" },
  cardImage: { width: "100%", aspectRatio: 1, backgroundColor: "#EEE" },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#191919", minHeight: 38 },
  cardPrice: { fontSize: 16, fontWeight: "900", color: "#FF4747", marginTop: 4 },
  meta: { color: "#777", fontSize: 12, marginTop: 3 },
  empty: { alignItems: "center", padding: 50, gap: 8 },
  emptyText: { color: "#777", fontSize: 13, textAlign: "center", lineHeight: 20 },
  detailHeader: { padding: 14, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", gap: 12 },
  detailHeaderTitle: { fontSize: 18, fontWeight: "900", flex: 1 },
  galleryRow: { backgroundColor: "#EEE" },
  hero: { aspectRatio: 1, backgroundColor: "#EEE" },
  section: { backgroundColor: "#FFF", marginTop: 8, padding: 16 },
  kicker: { color: "#FF4747", fontWeight: "800", textTransform: "capitalize" },
  title: { fontSize: 23, fontWeight: "900", color: "#191919", marginTop: 5 },
  price: { fontSize: 22, fontWeight: "900", color: "#FF4747", marginTop: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#191919" },
  body: { color: "#4F4F4F", lineHeight: 22, marginTop: 8 },
  warning: { margin: 10, padding: 14, borderRadius: 12, backgroundColor: "#FFF5E6", flexDirection: "row", gap: 10 },
  warningTitle: { fontSize: 16, fontWeight: "900", color: "#7A4600" },
  warningText: { color: "#6C4A20", lineHeight: 20, marginTop: 4 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 12 },
  slot: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#DDD", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  slotActive: { borderColor: "#FF4747", backgroundColor: "#FFF4F4" },
  input: { borderWidth: 1, borderColor: "#DDD", borderRadius: 10, padding: 12, marginTop: 10, backgroundColor: "#FFF" },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  primary: { backgroundColor: "#FF4747", borderRadius: 11, padding: 14, alignItems: "center", marginTop: 12 },
  primaryText: { color: "#FFF", fontWeight: "900" },
  secondary: { backgroundColor: "#F0F4F2", borderRadius: 11, padding: 14, alignItems: "center", marginTop: 10 },
  secondaryText: { color: "#19332B", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  contact: { marginTop: 12, padding: 14, borderRadius: 10, backgroundColor: "#F7F7F7" },
  link: { color: "#C9353B", fontWeight: "800", marginTop: 8 },
  requestCard: { padding: 14, marginBottom: 10, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E8E8E8" },
  requestHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  requestTitle: { flex: 1, color: "#191919", fontSize: 16, fontWeight: "900" },
  status: { color: "#A5282E", backgroundColor: "#FFF1F1", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, overflow: "hidden", fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
  requestDate: { marginTop: 8, color: "#333", fontWeight: "700" }
});
