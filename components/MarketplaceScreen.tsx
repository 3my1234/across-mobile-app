import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as Location from "expo-location";
import { API_URL, BOTTOM_NAV_HEIGHT } from "./config";
import { ResilientImage } from "./ResilientImage";
import { fetchWithTimeout } from "./utils";
import { freshCatalogURL, useCatalogFreshness } from "./catalogFreshness";
import { filterNearbySnapshot, readCachedContact, readNearbySnapshot, writeCachedContact, writeNearbySnapshot } from "./nearbyCache";

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
  distance_km?: number;
  is_available_now?: boolean;
  is_mobile_service?: boolean;
  review_count?: number;
  average_rating?: number;
};

type Slot = { id: string; starts_at: string; ends_at: string; remaining: number };
type BuyerRequest = {
  id: string;
  request_type: string;
  listing_id: string;
  status: string;
  starts_at?: string | null;
  listing_title: string;
  listing_type: string;
  review_rating?: number | null;
  provider_name: string;
  message?: string;
  party_size?: number;
  created_at: string;
};
type Conversation = {
  id: string;
  listing_id: string;
  listing_title: string;
  counterpart_name: string;
  status: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  subscription_active: boolean;
};
type ConversationMessage = {
  id: string;
  sender_type: "buyer" | "provider";
  body: string;
  created_at: string;
};

const LISTING_TYPES = [
  { key: "", label: "All" },
  { key: "hotel", label: "Hotels" },
  { key: "short_let", label: "Short lets" },
  { key: "car_rental", label: "Car rentals" },
  { key: "car_wash", label: "Car wash" },
  { key: "mechanic", label: "Mechanics" },
  { key: "plumber", label: "Plumbers" },
  { key: "carpenter", label: "Carpenters" },
  { key: "fuel_station", label: "Fuel stations" },
  { key: "food_vendor", label: "Food vendors" },
  { key: "artisan", label: "Other artisans" },
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

function bookingQuantityCopy(listingType: string) {
  if (listingType === "hotel" || listingType === "short_let") return { label: "Number of guests", help: "How many people will stay?", unit: "guest" };
  if (["car_rental", "car_wash", "mechanic"].includes(listingType)) return { label: "Number of vehicles", help: "How many vehicles is this booking for?", unit: "vehicle" };
  return { label: "Number of people receiving this service", help: "Enter 1 when booking only for yourself. This is not the number of days.", unit: "person" };
}

export function MarketplaceScreen({ token, bottomInset = 0, initialMode = "explore" }: { token: string | null; bottomInset?: number; initialMode?: "explore" | "requests" | "messages" }) {
  const { width: viewportWidth } = useWindowDimensions();
  const [mode, setMode] = useState<"explore" | "requests" | "messages">(initialMode);
  const [items, setItems] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<BuyerRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationDraft, setConversationDraft] = useState("");
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
  const [nearby, setNearby] = useState<{ latitude: number; longitude: number; accuracy?: number; label?: string } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  const [cacheNotice, setCacheNotice] = useState("");
  const listingRequest = useRef(0);
  const detailRequest = useRef(0);
  const onlineListingsLoaded = useRef(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [reviewedRequests, setReviewedRequests] = useState<Record<string, number>>({});
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token || ""}` }), [token]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const readNearbyPosition = useCallback(async () => {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status === "undetermined" && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) {
      const permanentlyDenied = !permission.canAskAgain;
      Alert.alert(
        "Location permission required",
        permanentlyDenied
          ? "Enable location permission in your phone settings to find verified services near you."
          : "Allow location while using Atlantic Express to find verified services near you.",
        permanentlyDenied
          ? [{ text: "Not now", style: "cancel" }, { text: "Open settings", onPress: () => void Linking.openSettings() }]
          : [{ text: "OK" }]
      );
      return null;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled && Platform.OS === "android") {
      try {
        await Location.enableNetworkProviderAsync();
      } catch {
        Alert.alert(
          "Turn on phone location",
          "Location services are off. Turn them on, then select Find services near me again.",
          [{ text: "OK" }]
        );
        return null;
      }
    } else if (!servicesEnabled) {
      Alert.alert("Turn on phone location", "Location services are off. Turn them on, then try again.");
      return null;
    }

    let position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (position.coords.accuracy == null || position.coords.accuracy > 5000) {
      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    }
    const accuracy = position.coords.accuracy ?? undefined;
    if (accuracy == null || accuracy > 10000) throw new Error("Your phone could not get a reliable location. Move outdoors or near a window, disable any VPN, and retry.");
    let label = "";
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const place = places[0]; label = [place?.district || place?.city, place?.region].filter(Boolean).join(", ");
    } catch {
      // Nearby search still works when the optional readable place lookup fails.
    }
    return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy, label };
  }, []);

  const loadListings = useCallback(async (refresh = false, cursor = "") => {
    const request = ++listingRequest.current;
    if (refresh) setRefreshing(true); else if (cursor) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: nearby && !type && !search.trim() ? "100" : "24" });
      if (type) query.set("type", type);
      if (search.trim()) query.set("search", search.trim());
      if (cursor && !nearby) query.set("cursor", cursor);
      if (nearby) { query.set("latitude", String(nearby.latitude)); query.set("longitude", String(nearby.longitude)); query.set("radius_km", "100"); }
      const endpoint = nearby ? "nearby" : "listings";
      const response = await fetchWithTimeout(freshCatalogURL(`${API_URL}/api/v1/marketplace/${endpoint}?${query.toString()}`), { headers: { "Cache-Control": "no-cache" } });
      const body = await response.json().catch(() => ({}));
      if (request !== listingRequest.current) return;
      if (response.status >= 400 && response.status < 500) { setError(apiMessage(body, "Services are unavailable for this search")); return; }
      if (!response.ok) throw new Error(apiMessage(body, "Services are temporarily unavailable"));
      const incoming: Listing[] = Array.isArray(body.items) ? body.items : [];
      onlineListingsLoaded.current = true;
      setItems(current => cursor ? [...current, ...incoming.filter(item => !current.some(existing => existing.id === item.id))] : incoming);
      setSelected(current => {
        const updated = current && incoming.find(item => item.id === current.id);
        return updated ? { ...current, ...updated } : current;
      });
      setListingCursor(String(body.next_cursor || ""));
      if (nearby && !type && !search.trim()) {
        const snapshot = await writeNearbySnapshot(nearby, incoming);
        setCacheNotice(snapshot.items.length ? `Saved ${snapshot.items.length} nearby services for offline use` : "");
      } else {
        setCacheNotice("");
      }
    } catch (loadError) {
      const snapshot = await readNearbySnapshot<Listing>();
      if (request !== listingRequest.current) return;
      if (snapshot) {
        setNearby(snapshot.coordinates);
        setItems(filterNearbySnapshot(snapshot.items, type, search));
        setCacheNotice(`Offline results saved ${new Date(snapshot.fetchedAt).toLocaleString()}`);
        setError("");
      } else {
        setError(loadError instanceof Error ? loadError.message : "Services are temporarily unavailable");
      }
    } finally {
      if (request === listingRequest.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  }, [nearby, search, type]);

  async function refreshNearby() {
    setLoading(true);
    try {
      const position = await readNearbyPosition();
      if (position) setNearby(position);
    } catch (locationError) {
      Alert.alert("Nearby services", locationError instanceof Error ? locationError.message : "Your location could not be read.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (locationRequested) return;
    setLocationRequested(true);
    void (async () => {
      try {
        const position = await readNearbyPosition();
        if (position) setNearby(position);
      } catch {
        // Keep the full verified marketplace usable if location is temporarily unavailable.
      }
    })();
  }, [locationRequested, readNearbyPosition]);

  useEffect(() => {
    let active = true;
    void readNearbySnapshot<Listing>().then(snapshot => {
      if (!active || !snapshot || onlineListingsLoaded.current) return;
      setNearby(snapshot.coordinates);
      setItems(snapshot.items);
      setCacheNotice(`Saved results from ${new Date(snapshot.fetchedAt).toLocaleString()}`);
    });
    return () => { active = false; };
    // Initial hydration only; later filtering happens in loadListings.
  }, []);

  const loadRequests = useCallback(async (refresh = false, cursor = "") => {
    if (refresh) setRefreshing(true); else if (cursor) setLoadingMore(true); else setLoading(true);
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

  const loadConversations = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/conversations`, { headers: authHeaders });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Your messages could not be loaded"));
      setConversations(Array.isArray(body.items) ? body.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Your messages could not be loaded");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === "explore") void loadListings();
      else if (mode === "requests") void loadRequests();
      else void loadConversations();
    }, mode === "explore" ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadConversations, loadListings, loadRequests, mode]);

  useCatalogFreshness(async () => {
    await Promise.allSettled([mode === "explore" ? loadListings(true) : Promise.resolve(), selectedRef.current ? refreshSelectedListing(selectedRef.current.id) : Promise.resolve()]);
  });

  async function refreshSelectedListing(id: string) {
    const request = ++detailRequest.current;
    const response = await fetchWithTimeout(freshCatalogURL(`${API_URL}/api/v1/marketplace/listings/${id}`), { headers: { "Cache-Control": "no-cache" } });
    if (request !== detailRequest.current) return;
    if (response.status === 404) {
      setSelected(current => current?.id === id ? null : current);
      setItems(current => current.filter(item => item.id !== id));
      return;
    }
    if (!response.ok) throw new Error("Service details are temporarily unavailable");
    const updated = await response.json();
    if (request !== detailRequest.current) return;
    setSelected(current => current?.id === id ? updated : current);
    setItems(current => current.map(item => item.id === id ? { ...item, ...updated } : item));
  }

  async function startConversation() {
    if (!selected || !requestMessage.trim()) {
      Alert.alert("Write a message", "Tell the provider what you need before starting a conversation.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${selected.id}/conversations`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMessage.trim() })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Message could not be sent"));
      setRequestMessage("");
      setSelected(null);
      setMode("messages");
      await loadConversations();
    } catch (messageError) {
      Alert.alert("Unable to message provider", messageError instanceof Error ? messageError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(conversation: Conversation) {
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/conversations/${conversation.id}/messages`, { headers: authHeaders });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Conversation could not be loaded"));
      setConversationMessages(Array.isArray(body.items) ? body.items : []);
      setSelectedConversation({ ...conversation, unread_count: 0 });
      setConversations(current => current.map(item => item.id === conversation.id ? { ...item, unread_count: 0 } : item));
    } catch (messageError) {
      Alert.alert("Unable to open messages", messageError instanceof Error ? messageError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function sendConversationMessage() {
    if (!selectedConversation || !conversationDraft.trim()) return;
    setLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message: conversationDraft.trim() })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Message could not be sent"));
      setConversationDraft("");
      await openConversation(selectedConversation);
      void loadConversations();
    } catch (messageError) {
      Alert.alert("Unable to send message", messageError instanceof Error ? messageError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function openListing(item: Listing) {
    setSelected(item);
    setContact(await readCachedContact(item.id));
    setSafetyAcknowledged(false);
    setSlotId("");
    setSlots([]);
    setError("");
    try {
      await refreshSelectedListing(item.id);
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
      await writeCachedContact(selected.id, body);
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

  async function submitReview(request: BuyerRequest, rating: number) {
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${request.listing_id}/review`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, rating, review_text: "" })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Review could not be saved"));
      setReviewedRequests(current => ({ ...current, [request.id]: rating }));
      Alert.alert(
        "Thank you",
        body.xp_awarded ? `Your review helps other customers. You earned ${body.xp_awarded} XP.` : "Your updated review has been saved."
      );
    } catch (reviewError) {
      Alert.alert("Review unavailable", reviewError instanceof Error ? reviewError.message : "Please try again.");
    }
  }

  const heading = LISTING_TYPES.find(item => item.key === type)?.label || "Services";
  const detailBottomPadding = bottomInset + BOTTOM_NAV_HEIGHT + 32;

  if (selectedConversation) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
        <View style={styles.detailHeader}>
          <Pressable onPress={() => { setSelectedConversation(null); void loadConversations(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to messages">
            <Ionicons name="arrow-back" size={25} />
          </Pressable>
          <View style={styles.grow}><Text style={styles.detailHeaderTitle} numberOfLines={1}>{selectedConversation.listing_title}</Text><Text style={styles.meta}>{selectedConversation.counterpart_name}</Text></View>
        </View>
        <ScrollView style={styles.grow} contentContainerStyle={styles.messageThread}>
          {conversationMessages.map(message => (
            <View key={message.id} style={[styles.messageBubble, message.sender_type === "buyer" ? styles.messageMine : styles.messageTheirs]}>
              <Text style={message.sender_type === "buyer" ? styles.messageMineText : styles.body}>{message.body}</Text>
              <Text style={[styles.messageTime, message.sender_type === "buyer" && styles.messageMineTime]}>{new Date(message.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={[styles.messageComposer, { paddingBottom: bottomInset + 8 }]}>
          {!selectedConversation.subscription_active && <Text style={styles.subscriptionPaused}>The provider subscription is inactive, so messaging is temporarily paused.</Text>}
          <TextInput value={conversationDraft} onChangeText={setConversationDraft} editable={selectedConversation.subscription_active && !loading} placeholder="Write a message" multiline maxLength={2000} style={[styles.input, styles.messageInput]} />
          <Pressable disabled={!selectedConversation.subscription_active || loading || !conversationDraft.trim()} style={[styles.primary, (!selectedConversation.subscription_active || loading || !conversationDraft.trim()) && styles.disabled]} onPress={() => void sendConversationMessage()}>
            <Text style={styles.primaryText}>{loading ? "Sending…" : "Send message"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (selected) {
    const requiresSafetyAcknowledgement = !selected.direct_booking;
    const quantityCopy = bookingQuantityCopy(selected.listing_type);
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
              <Text style={styles.sectionTitle}>Choose a date and time</Text>
              {slots.length ? slots.map(slot => (
                <Pressable key={slot.id} onPress={() => setSlotId(current => current === slot.id ? "" : slot.id)} style={[styles.slot, slotId === slot.id && styles.slotActive]}>
                  <Ionicons name={slotId === slot.id ? "radio-button-on" : "radio-button-off"} size={20} color="#FF4747" />
                  <Text style={styles.grow}>{new Date(slot.starts_at).toLocaleString()} · {slot.remaining} booking {slot.remaining === 1 ? "spot" : "spots"} left</Text>
                </Pressable>
              )) : <Text style={styles.meta}>The provider has not added fixed times. Write your preferred date and time in the message below.</Text>}
              <Text style={styles.fieldLabel}>{quantityCopy.label}</Text>
              <Text style={styles.fieldHelp}>{quantityCopy.help}</Text>
              <TextInput value={partySize} onChangeText={setPartySize} keyboardType="number-pad" placeholder="Enter a number" accessibilityLabel={quantityCopy.label} style={styles.input} />
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{selected.direct_booking ? "Request booking" : "Send an enquiry"}</Text>
            <TextInput value={requestMessage} onChangeText={setRequestMessage} placeholder="Tell the provider what you need" multiline style={[styles.input, styles.textarea]} />
            <Pressable disabled={loading} style={[styles.primary, loading && styles.disabled]} onPress={submitRequest}>
              <Text style={styles.primaryText}>{loading ? "Sending…" : selected.direct_booking ? "Request booking" : "Send enquiry"}</Text>
            </Pressable>
            <Pressable disabled={loading || !requestMessage.trim()} style={[styles.secondary, (loading || !requestMessage.trim()) && styles.disabled]} onPress={() => void startConversation()}>
              <Text style={styles.secondaryText}>Message provider</Text>
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
        <Pressable style={[styles.modeButton, mode === "messages" && styles.modeButtonActive]} onPress={() => setMode("messages")}><Text style={[styles.modeText, mode === "messages" && styles.modeTextActive]}>Provider chat</Text></Pressable>
      </View>
      {mode === "explore" ? (
        <>
          <View style={styles.search}>
            <Ionicons name="search" size={20} color="#777" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Hotels, cars, property, services" style={styles.grow} returnKeyType="search" />
          </View>
          <View style={styles.nearbyActions}>
            <Pressable style={[styles.nearbyButton, nearby && styles.nearbyButtonActive]} onPress={() => void refreshNearby()}><Ionicons name={nearby ? "refresh" : "location-outline"} size={18} color={nearby ? "#FFFFFF" : "#FF4747"} /><Text style={[styles.nearbyText, nearby && styles.nearbyTextActive]}>{nearby ? "Refresh my location" : "Find services near me"}</Text></Pressable>
            {!!nearby && <Pressable style={styles.showAllButton} onPress={() => setNearby(null)}><Text style={styles.showAllText}>Show all</Text></Pressable>}
          </View>
          {!!nearby && <View style={styles.locationStrip}><Ionicons name="navigate-circle" size={16} color="#12805F" /><Text numberOfLines={1} style={styles.locationSummary}>{nearby.label || "Current location"} · 100 km{typeof nearby.accuracy === "number" ? ` · ±${Math.round(nearby.accuracy)} m` : ""}</Text></View>}
          {!!cacheNotice && <View style={styles.cacheStrip}><Ionicons name="cloud-done-outline" size={14} color="#496B60" /><Text numberOfLines={1} style={styles.cacheNotice}>{cacheNotice}</Text></View>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chips}>
            {LISTING_TYPES.map(item => <Pressable key={item.key} onPress={() => setType(item.key)} style={[styles.chip, type === item.key && styles.chipActive]}><Text maxFontSizeMultiplier={1.2} style={[styles.chipText, type === item.key && styles.chipTextActive]}>{item.label}</Text></Pressable>)}
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
                    {typeof item.distance_km === "number" && <Text style={styles.distance}>{item.distance_km.toFixed(1)} km away{item.is_available_now ? " · Available now" : ""}</Text>}
                    {!!item.review_count && <View style={styles.ratingRow}><Ionicons name="star" size={12} color="#E8A100" /><Text style={styles.rating}>{item.average_rating?.toFixed(1)} ({item.review_count})</Text></View>}
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={<EmptyState icon="business-outline" title="No matching verified listings" message={error || (nearby ? "No approved services were found within 100 km of the location shown above. Refresh your location or select Show all." : "Try another search or category.")} />}
              ListFooterComponent={loadingMore ? <ActivityIndicator color="#FF4747" style={styles.pageLoader} /> : null}
            />
          )}
        </>
      ) : mode === "requests" ? (loading && !requests.length ? <ActivityIndicator color="#FF4747" style={styles.loader} /> : (
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
              {!!item.party_size && <Text style={styles.requestDate}>For {item.party_size} {bookingQuantityCopy(item.listing_type).unit}{item.party_size === 1 ? "" : "s"}</Text>}
              {!!item.starts_at && <Text style={styles.requestDate}>{new Date(item.starts_at).toLocaleString()}</Text>}
              {!!item.message && <Text style={styles.body}>{item.message}</Text>}
              {item.status === "completed" && (
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>{(reviewedRequests[item.id] || item.review_rating) ? "Your rating" : "Rate this provider - earn 10 XP"}</Text>
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map(rating => (
                      <Pressable key={rating} onPress={() => void submitReview(item, rating)} accessibilityLabel={`Rate ${rating} stars`}>
                        <Ionicons name={rating <= (reviewedRequests[item.id] || item.review_rating || 0) ? "star" : "star-outline"} size={25} color="#E8A100" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No requests yet" message={error || "Bookings and enquiries you send will appear here."} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#FF4747" style={styles.pageLoader} /> : null}
        />
      )) : loading && !conversations.length ? <ActivityIndicator color="#FF4747" style={styles.loader} /> : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadConversations(true)} tintColor="#FF4747" />}
          contentContainerStyle={{ padding: 12, paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 24 }}
          renderItem={({ item }) => (
            <Pressable style={styles.requestCard} onPress={() => void openConversation(item)}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestTitle} numberOfLines={2}>{item.listing_title}</Text>
                {!!item.unread_count && <Text style={styles.status}>{item.unread_count} new</Text>}
              </View>
              <Text style={styles.meta}>{item.counterpart_name} · {new Date(item.last_message_at).toLocaleString()}</Text>
              <Text style={styles.body} numberOfLines={2}>{item.last_message}</Text>
              {!item.subscription_active && <Text style={styles.subscriptionPaused}>Provider subscription inactive — messaging paused</Text>}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No provider chats yet" message={error || "This area is for conversations with service providers. For Atlantic Express help, open Support from the main menu."} />}
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
  modeBar: { marginHorizontal: 10, marginTop: 4, padding: 3, borderRadius: 14, backgroundColor: "#EDEDED", flexDirection: "row" },
  modeButton: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  modeButtonActive: { backgroundColor: "#FFF" },
  modeText: { color: "#777", fontWeight: "800" },
  modeTextActive: { color: "#191919" },
  search: { minHeight: 38, marginHorizontal: 10, marginTop: 6, marginBottom: 4, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#DEDEDE" },
  reviewRow: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EEE" },
  reviewLabel: { color: "#444", fontWeight: "800", fontSize: 12, marginBottom: 6 },
  stars: { flexDirection: "row", gap: 8 },
  cacheStrip: { marginHorizontal: 12, marginBottom: 3, flexDirection: "row", alignItems: "center", gap: 5 },
  cacheNotice: { flex: 1, color: "#496B60", fontSize: 10, fontWeight: "700" },
  ratingRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { color: "#A66A00", fontSize: 11, fontWeight: "900" },
  nearbyActions: { marginHorizontal: 10, marginBottom: 2, flexDirection: "row", gap: 7 },
  nearbyButton: { flex: 1, minHeight: 36, borderRadius: 14, borderWidth: 1, borderColor: "#FF4747", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFF" },
  nearbyButtonActive: { backgroundColor: "#FF4747" },
  nearbyText: { color: "#FF4747", fontWeight: "900" },
  nearbyTextActive: { color: "#FFF" },
  showAllButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: "#D9D9D9", alignItems: "center", justifyContent: "center", backgroundColor: "#FFF" },
  showAllText: { color: "#333", fontWeight: "900" },
  locationStrip: { marginHorizontal: 12, marginBottom: 3, minHeight: 20, flexDirection: "row", alignItems: "center", gap: 5 },
  locationSummary: { flex: 1, color: "#2E5C4E", fontSize: 10, fontWeight: "800" },
  distance: { marginTop: 4, color: "#12805F", fontSize: 11, fontWeight: "900" },
  chipScroller: { height: 52, maxHeight: 52, flexGrow: 0 },
  chips: { height: 52, paddingHorizontal: 10, gap: 7, paddingVertical: 6, alignItems: "center" },
  chip: { height: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E5E5", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "#FF4747", borderColor: "#FF4747" },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "800", color: "#555", includeFontPadding: false },
  chipTextActive: { color: "#FFF" },
  listHeading: { paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  columns: { gap: 8 },
  card: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", marginBottom: 8, maxWidth: "49%", borderWidth: 1, borderColor: "#ECECEC" },
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
  fieldLabel: { color: "#191919", fontWeight: "900", marginTop: 14 },
  fieldHelp: { color: "#66736F", fontSize: 12, lineHeight: 18, marginTop: 3 },
  input: { borderWidth: 1, borderColor: "#DDD", borderRadius: 10, padding: 12, marginTop: 10, backgroundColor: "#FFF" },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  primary: { backgroundColor: "#FF4747", borderRadius: 16, padding: 14, alignItems: "center", marginTop: 12, borderBottomWidth: 3, borderBottomColor: "#D92F3A" },
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
  requestDate: { marginTop: 8, color: "#333", fontWeight: "700" },
  messageThread: { padding: 14, gap: 9 },
  messageBubble: { maxWidth: "84%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  messageMine: { alignSelf: "flex-end", backgroundColor: "#FF4747", borderBottomRightRadius: 4 },
  messageTheirs: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#E7E7E7" },
  messageMineText: { color: "#FFFFFF", lineHeight: 20 },
  messageTime: { color: "#888", fontSize: 10, marginTop: 5 },
  messageMineTime: { color: "#FFE3E3" },
  messageComposer: { backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E5E5" },
  messageInput: { minHeight: 54, maxHeight: 110, textAlignVertical: "top" },
  subscriptionPaused: { color: "#A5282E", fontSize: 12, fontWeight: "800", marginTop: 8 }
});
