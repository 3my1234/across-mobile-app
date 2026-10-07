import { ProviderConversation } from "./ProviderConversation";
import { servicePriceLabel } from "./servicePricing";
import { ReviewStars } from "./ReviewStars";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
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
import { ServiceReviews } from "./ServiceReviews";
import { fetchWithTimeout, fetchJSONWithTimeout, fetchHistoryJSON } from "./utils";
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
  contact_available?: boolean;
  attributes?: { price_mode?: string; price_notes?: string };
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
  review_text?: string | null;
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
  const conversationsRef = useRef(conversations); conversationsRef.current = conversations;
  const [conversationListCursor, setConversationListCursor] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationCursor, setConversationCursor] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatBusy = useRef(false);
  const chatOpening = useRef(false);
  const [openingChat, setOpeningChat] = useState(false);
  const threadRequest = useRef(0);
  const threadInFlight = useRef(false);
  const chatActor = useRef(token); chatActor.current = token;
  const threadLoader = useRef(loadConversationMessages); threadLoader.current = loadConversationMessages;
  const requestsGeneration = useRef(0);
  const conversationsGeneration = useRef(0);
  const conversationsRead = useRef<{actor: string | null; generation: number} | null>(null);
  const conversationRef = useRef(selectedConversation); conversationRef.current = selectedConversation;
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
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating?: number; text?: string }>>({});
  const [savingReview, setSavingReview] = useState<string | null>(null);
  const reviewSubmitBusy = useRef(false);
  const [highlyRated, setHighlyRated] = useState(false);
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
      if (highlyRated) query.set("min_rating", "4");
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
      if (nearby && !type && !search.trim() && !highlyRated) {
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
        setItems(filterNearbySnapshot(snapshot.items, type, search).filter(item => !highlyRated || ((item.review_count || 0) > 0 && (item.average_rating || 0) >= 4)));
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
  }, [nearby, search, type, highlyRated]);

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
    const generation = ++requestsGeneration.current, actor = token;
    if (refresh) setRefreshing(true); else if (cursor) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "24" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/requests?${query.toString()}`, { headers: authHeaders });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Your requests could not be loaded"));
      if (generation !== requestsGeneration.current || actor !== chatActor.current) return;
      const incoming: BuyerRequest[] = Array.isArray(body.items) ? body.items : [];
      setRequests(current => cursor ? [...current, ...incoming.filter(item => !current.some(existing => existing.id === item.id))] : incoming);
      setRequestCursor(String(body.next_cursor || ""));
    } catch (loadError) {
      if (generation !== requestsGeneration.current || actor !== chatActor.current) return;
      setError(loadError instanceof Error ? loadError.message : "Your requests could not be loaded");
    } finally {
      if (generation === requestsGeneration.current && actor === chatActor.current) {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      }
    }
  }, [authHeaders, token]);

  const loadConversations = useCallback(async (refresh = false, cursor = "") => {
    if (conversationsRead.current?.actor === token && conversationsRead.current.generation === conversationsGeneration.current) return;
    const generation = ++conversationsGeneration.current, actor = token;
    conversationsRead.current = {actor, generation};
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const {response,body} = await fetchHistoryJSON(`${API_URL}/api/v1/marketplace/conversations?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { headers: authHeaders });
      if (!response.ok) throw new Error(apiMessage(body, "Your messages could not be loaded"));
      if (generation !== conversationsGeneration.current || actor !== chatActor.current) return;
      const hadHistory = conversationsRef.current.length > 0;
      setConversations(current => {
        const merged = new Map<string, Conversation>(); [...current, ...(Array.isArray(body.items) ? body.items : [])].forEach(item => merged.set(item.id, item));
        return [...merged.values()].sort((a,b) => b.last_message_at.localeCompare(a.last_message_at) || b.id.localeCompare(a.id));
      });
      if (cursor || !hadHistory) setConversationListCursor(body.next_cursor || "");
    } catch (loadError) {
      if (generation !== conversationsGeneration.current || actor !== chatActor.current) return;
      setError(loadError instanceof Error ? loadError.message : "Your messages could not be loaded");
    } finally {
      if (conversationsRead.current?.generation === generation) conversationsRead.current = null;
      if (generation === conversationsGeneration.current && actor === chatActor.current) {
      setLoading(false);
      setRefreshing(false);
      }
    }
  }, [authHeaders, token]);

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
    if (!selected || chatOpening.current) return;
    chatOpening.current = true;
    const listing = selected, actor = token;
    setOpeningChat(true);
    try {
      const { response, body } = await fetchHistoryJSON(`${API_URL}/api/v1/marketplace/conversations?listing_id=${encodeURIComponent(listing.id)}`, {headers:authHeaders});
      if (!response.ok) throw new Error(apiMessage(body, "Could not open provider chat"));
      if (chatActor.current !== actor || selectedRef.current?.id !== listing.id) return;
      const existing = (body.items || []).find((item: Conversation)=>item.listing_id === listing.id);
      const conversation: Conversation = existing || {id:"",listing_id:listing.id,listing_title:listing.title,counterpart_name:listing.provider_name,status:"open",last_message:"",last_message_at:"",unread_count:0,subscription_active:listing.contact_available !== false};
      await openConversation(conversation);
    } catch (messageError) { if(chatActor.current===actor && selectedRef.current?.id===listing.id) Alert.alert("Unable to open messages", messageError instanceof Error ? messageError.message : "Please try again."); }
    finally { if(chatActor.current===actor){chatOpening.current=false;setOpeningChat(false);} }
  }

  async function loadConversationMessages(conversation: Conversation, cursor = "", quiet = false) {
    if(!conversation.id)return;
    const request = ++threadRequest.current, actor=token;
    threadInFlight.current=true;
    if(!quiet)setChatLoading(true);
    try {
      const query=new URLSearchParams({limit:"50"});if(cursor)query.set("cursor",cursor);
      const {response,body}=await fetchHistoryJSON(`${API_URL}/api/v1/marketplace/conversations/${conversation.id}/messages?${query}`,{headers:authHeaders});
      if(!response.ok)throw new Error(apiMessage(body,"Messages could not be loaded"));
      if(request!==threadRequest.current || actor!==chatActor.current || conversationRef.current?.id!==conversation.id)return;
      const incoming: ConversationMessage[]=Array.isArray(body.items)?body.items:[];
      setConversationMessages(current=>{
        const merged=cursor?[...incoming,...current]:[...current,...incoming];
        return Array.from(new Map(merged.map(message=>[message.id,message])).values()).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||(a.id<b.id ? -1 : a.id>b.id ? 1 : 0));
      });
      if(!quiet || cursor)setConversationCursor(body.next_cursor || "");
      setChatError("");
    } catch(messageError){if(request===threadRequest.current&&actor===chatActor.current)setChatError(messageError instanceof Error?messageError.message:"Messages could not be loaded");}
    finally{if(request===threadRequest.current){threadInFlight.current=false;setChatLoading(false);}}
  }

  async function openConversation(conversation: Conversation) {
    threadRequest.current++;
    setConversationMessages([]);setConversationCursor("");setChatError("");
    conversationRef.current=conversation;
    setSelectedConversation({...conversation,unread_count:0});
    setConversations(current=>current.map(item=>item.id===conversation.id?{...item,unread_count:0}:item));
    if(conversation.id)await loadConversationMessages(conversation);
  }

  async function sendConversationMessage(text: string) {
    const conversation=conversationRef.current, actor=token;
    if(!conversation || !text.trim() || chatBusy.current)return;
    chatBusy.current=true;setChatSending(true);setChatError("");
    try {
      const endpoint=conversation.id?`/marketplace/conversations/${conversation.id}/messages`:`/marketplace/listings/${conversation.listing_id}/conversations`;
      const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1${endpoint}`,{method:"POST",headers:{...authHeaders,"Content-Type":"application/json"},body:JSON.stringify({message:text.trim()})});
      if(!response.ok)throw new Error(apiMessage(body,"Message could not be sent"));
      if(actor!==chatActor.current)return;
      if(conversationRef.current?.listing_id !== conversation.listing_id){void loadConversations(true);return;}
      const active={...conversation,id:conversation.id || body.id};
      conversationRef.current=active;setSelectedConversation(active);
      await loadConversationMessages(active);
      void loadConversations(true);
    } catch(messageError){if(actor===chatActor.current)setChatError(messageError instanceof Error?messageError.message:"Message could not be sent");throw messageError;}
    finally{if(actor===chatActor.current){chatBusy.current=false;setChatSending(false);}}
  }

  useEffect(()=>{
    chatOpening.current=false;setOpeningChat(false);
    threadRequest.current++;threadInFlight.current=false;chatBusy.current=false;setConversationCursor("");setSelectedConversation(null);conversationRef.current=null;setConversationMessages([]);setConversations([]);conversationsRef.current=[];setConversationListCursor("");setChatError("");setChatSending(false);setChatLoading(false);
  },[token]);
  useEffect(()=>{
    let stopped=false, busy=false;
    const refresh=async()=>{
      if(stopped||busy||!token||AppState.currentState!=="active"||chatBusy.current||threadInFlight.current)return;
      busy=true;
      try{if(conversationRef.current?.id)await threadLoader.current(conversationRef.current,"",true);else if(mode==="messages")await loadConversations(true);else if(mode==="requests")await loadRequests(true);}
      finally{busy=false;}
    };
    const timer=setInterval(()=>void refresh(),5000);
    const foreground=AppState.addEventListener("change",state=>{if(state==="active")void refresh();});
    return()=>{stopped=true;clearInterval(timer);foreground.remove();};
  },[token,mode,selectedConversation?.id,authHeaders,loadConversations,loadRequests]);

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

  async function submitReview(request: BuyerRequest, rating: number, text: string) {
    if (reviewSubmitBusy.current) return;
    reviewSubmitBusy.current = true;
    setSavingReview(request.id);
    try {
      const response = await fetchWithTimeout(`${API_URL}/api/v1/marketplace/listings/${request.listing_id}/review`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: request.id, rating, review_text: text.trim() })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body, "Review could not be saved"));
      setReviewedRequests(current => ({ ...current, [request.id]: rating }));
      setRequests(current => current.map(item => item.id === request.id ? { ...item, review_rating: rating, review_text: text.trim() } : item));
      setReviewDrafts(current => { const next = { ...current }; delete next[request.id]; return next; });
      void loadListings(true);
      Alert.alert(
        "Thank you",
        body.xp_awarded ? `Your review helps other customers. You earned ${body.xp_awarded} XP. Use it to reduce only Atlantic Express service fees on eligible NGN product orders; seller prices, delivery and gateway charges remain payable.` : "Your updated review has been saved."
      );
    } catch (reviewError) {
      Alert.alert("Review unavailable", reviewError instanceof Error ? reviewError.message : "Please try again.");
    } finally {
      reviewSubmitBusy.current = false;
      setSavingReview(null);
    }
  }

  const heading = LISTING_TYPES.find(item => item.key === type)?.label || "Services";
  const detailBottomPadding = bottomInset + BOTTOM_NAV_HEIGHT + 32;

  if (selectedConversation) {
    return <ProviderConversation key={`${token}:${selectedConversation.listing_id}`} title={selectedConversation.listing_title} provider={selectedConversation.counterpart_name} messages={conversationMessages} busy={chatSending} loading={chatLoading} paused={!selectedConversation.subscription_active} error={chatError} hasEarlier={!!conversationCursor} bottomInset={bottomInset}
      onClose={()=>{threadRequest.current++;threadInFlight.current=false;conversationRef.current=null;setSelectedConversation(null);void loadConversations(true);}}
      onSend={sendConversationMessage} onEarlier={()=>{if(conversationCursor&&!threadInFlight.current)void loadConversationMessages(selectedConversation,conversationCursor);}} onRefresh={()=>void loadConversationMessages(selectedConversation)}/>;
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
              <ResilientImage key={`${uri}-${index}`} uri={uri} style={[styles.hero, { width: viewportWidth }]} resizeMode="contain" />
            ))}
          </ScrollView>
          {(selected.media_urls?.length || 0) > 1 && <Text style={styles.meta}>Swipe to view all {selected.media_urls.length} photos</Text>}
          <View style={styles.section}>
            <Text style={styles.kicker}>{selected.listing_type.replaceAll("_", " ")} · verified provider</Text>
            <Text style={styles.title}>{selected.title}</Text>
            <Text style={styles.price}>{servicePriceLabel(selected)}{selected.price != null && selected.pricing_unit ? ` / ${selected.pricing_unit}` : ""}</Text>
            {!!selected.attributes?.price_notes && <Text style={styles.meta}>{selected.attributes.price_notes}</Text>}
            <Text style={styles.meta}>{selected.provider_name} · {selected.city}, {selected.state}</Text>
            <View style={styles.ratingRow}><ReviewStars rating={selected.average_rating || 0} size={14} /><Text style={styles.rating}>{selected.review_count ? `${selected.average_rating?.toFixed(1)} · ${selected.review_count} customer reviews` : "No customer reviews yet"}</Text></View>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this service</Text>
            <Text style={styles.body}>{selected.description}</Text>
          </View>
          <ServiceReviews listingId={selected.id} />
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
            <Pressable disabled={openingChat} style={[styles.secondary, openingChat && styles.disabled]} onPress={() => void startConversation()}>
              <Text style={styles.secondaryText}>{openingChat ? "Opening chat..." : "Message provider"}</Text>
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
        <Pressable style={[styles.modeButton, mode === "explore" && styles.modeButtonActive]} onPress={() => setMode("explore")}><Text maxFontSizeMultiplier={1.2} style={[styles.modeText, mode === "explore" && styles.modeTextActive]}>Explore</Text></Pressable>
        <Pressable style={[styles.modeButton, mode === "requests" && styles.modeButtonActive]} onPress={() => setMode("requests")}><Text maxFontSizeMultiplier={1.2} style={[styles.modeText, mode === "requests" && styles.modeTextActive]}>My requests</Text></Pressable>
        <Pressable style={[styles.modeButton, mode === "messages" && styles.modeButtonActive]} onPress={() => setMode("messages")}><Text maxFontSizeMultiplier={1.2} style={[styles.modeText, mode === "messages" && styles.modeTextActive]}>Provider chat</Text></Pressable>
      </View>
      {mode === "explore" ? (
        <>
          <View style={styles.searchTools}>
            <View style={styles.search}><Ionicons name="search" size={18} color="#777" /><TextInput value={search} onChangeText={setSearch} placeholder="Search services" style={styles.searchInput} returnKeyType="search" /></View>
            <Pressable hitSlop={4} accessibilityLabel={nearby ? "Refresh my location" : "Find services near me"} style={[styles.nearbyButton, nearby && styles.nearbyButtonActive]} onPress={() => void refreshNearby()}><Ionicons name={nearby ? "refresh" : "location-outline"} size={16} color={nearby ? "#FFFFFF" : "#FF4747"} /><Text maxFontSizeMultiplier={1.2} style={[styles.nearbyText, nearby && styles.nearbyTextActive]}>Near me</Text></Pressable>
          </View>
          {(nearby || cacheNotice) && <View style={styles.locationStrip}><Text numberOfLines={1} style={styles.locationSummary}>{nearby ? `${nearby.label || "Current location"} · 100 km` : "All locations"}{cacheNotice ? ` · ${cacheNotice}` : ""}</Text>{nearby && <Pressable hitSlop={8} onPress={() => setNearby(null)}><Text style={styles.showAllText}>Show all</Text></Pressable>}</View>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller} contentContainerStyle={styles.chips}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: highlyRated }} accessibilityLabel="Filter services rated four stars and above" onPress={() => setHighlyRated(value => !value)} style={[styles.chip, highlyRated && styles.chipActive]}><Text maxFontSizeMultiplier={1.2} style={[styles.chipText, highlyRated && styles.chipTextActive]}>4+ stars</Text></Pressable>
            {LISTING_TYPES.map(item => <Pressable key={item.key} onPress={() => setType(item.key)} style={[styles.chip, type === item.key && styles.chipActive]}><Text maxFontSizeMultiplier={1.2} style={[styles.chipText, type === item.key && styles.chipTextActive]}>{item.label}</Text></Pressable>)}
          </ScrollView>
          <View style={styles.listHeading}><Text style={styles.sectionTitle}>{heading}</Text><Text style={styles.meta}>{items.length} verified listings</Text></View>
          {loading && !items.length ? <ActivityIndicator color="#FF4747" style={styles.loader} /> : (
            <FlatList
              style={styles.results}
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
                  <View style={styles.cardGallery}>
                    {(item.media_urls?.length ? item.media_urls.slice(0,4) : [""]).map((uri,index)=><ResilientImage key={`${uri}:${index}`} uri={uri} style={item.media_urls?.length>1 ? [styles.cardGalleryTile,item.media_urls.length===2 && {height:160},item.media_urls.length===3 && index===2 && {width:"100%"}] : styles.cardGallerySingle} resizeMode="cover"/>)}
                    {item.media_urls?.length>4 && <Text style={styles.morePhotos}>+{item.media_urls.length-4} photos</Text>}
                  </View>
                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardPrice}>{servicePriceLabel(item)}</Text>
                    <Text numberOfLines={1} style={styles.meta}>{item.city} · {item.provider_name}</Text>
                    {typeof item.distance_km === "number" && <Text numberOfLines={1} style={styles.distance}>{item.distance_km.toFixed(1)} km away{item.is_available_now ? " · Available now" : ""}</Text>}
                    <View style={styles.ratingRow}><ReviewStars rating={item.average_rating || 0} size={10} /><Text style={styles.rating}>{item.review_count ? `${item.average_rating?.toFixed(1)} (${item.review_count})` : "New · no reviews"}</Text></View>
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
                  <ReviewStars rating={reviewDrafts[item.id]?.rating || reviewedRequests[item.id] || item.review_rating || 0} size={28} disabled={!!savingReview} onChange={rating => setReviewDrafts(current => ({ ...current, [item.id]: { ...current[item.id], rating } }))} />
                  <Text style={styles.meta}>10 XP for your first review. Use XP against Atlantic Express service fees on eligible NGN product orders.</Text>
                  <TextInput accessibilityLabel="Your service review" editable={!savingReview} multiline maxLength={1000} placeholder="Tell other customers about your experience (optional)" value={reviewDrafts[item.id]?.text ?? item.review_text ?? ""} onChangeText={text => setReviewDrafts(current => ({ ...current, [item.id]: { ...current[item.id], text } }))} style={[styles.input, styles.textarea]} />
                  <Pressable disabled={!!savingReview || !(reviewDrafts[item.id]?.rating || reviewedRequests[item.id] || item.review_rating)} style={[styles.primary, (!!savingReview || !(reviewDrafts[item.id]?.rating || reviewedRequests[item.id] || item.review_rating)) && styles.disabled]} onPress={() => void submitReview(item, reviewDrafts[item.id]?.rating || reviewedRequests[item.id] || item.review_rating || 0, reviewDrafts[item.id]?.text ?? item.review_text ?? "")}><Text style={styles.primaryText}>{savingReview === item.id ? "Saving review…" : item.review_rating ? "Update review" : "Submit review"}</Text></Pressable>
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
          ListHeaderComponent={error && conversations.length ? <Text accessibilityRole="alert" style={styles.fieldHelp}>{error}</Text> : null}
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
          ListFooterComponent={<View>{!!error && <Pressable disabled={loading || refreshing} onPress={() => void loadConversations(true)} style={styles.secondary}><Text style={styles.secondaryText}>Try again</Text></Pressable>}{!!conversationListCursor && <Pressable disabled={loading || refreshing} onPress={() => void loadConversations(true, conversationListCursor)} style={styles.secondary}><Text style={styles.secondaryText}>Load earlier conversations</Text></Pressable>}</View>}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title={error ? "Conversations could not be loaded" : "No provider chats yet"} message={error || "Your bookings, enquiries and messages appear here. Open a service and tap Message provider to start chatting. For Atlantic Express help, open Support."} />}
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
  results: { flex: 1 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 8, color: "#191919" },
  loader: { marginTop: 50 },
  pageLoader: { marginVertical: 18 },
  modeBar: { flexShrink: 0, marginHorizontal: 10, marginTop: 4, padding: 2, borderRadius: 12, backgroundColor: "#EDEDED", flexDirection: "row" },
  modeButton: { flex: 1, minHeight: 36, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  modeButtonActive: { backgroundColor: "#FFF" },
  modeText: { color: "#777", fontSize: 12, fontWeight: "800", textAlign: "center" },
  modeTextActive: { color: "#191919" },
  searchTools: { flexShrink: 0, flexDirection: "row", gap: 6, marginHorizontal: 10, marginVertical: 4 },
  search: { flex: 1, minHeight: 36, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#DEDEDE" },
  reviewRow: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#EEE" },
  reviewLabel: { color: "#444", fontWeight: "800", fontSize: 12, marginBottom: 6 },
  ratingRow: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  rating: { color: "#A66A00", fontSize: 11, fontWeight: "900" },
  nearbyButton: { paddingHorizontal: 10, minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: "#FF4747", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#FFF" },
  nearbyButtonActive: { backgroundColor: "#FF4747" },
  nearbyText: { color: "#FF4747", fontSize: 12, fontWeight: "900" },
  nearbyTextActive: { color: "#FFF" },
  showAllText: { color: "#333", fontSize: 12, fontWeight: "900" },
  locationStrip: { flexShrink: 0, marginHorizontal: 12, marginBottom: 2, minHeight: 20, flexDirection: "row", alignItems: "center", gap: 5 },
  locationSummary: { flex: 1, color: "#C9353B", fontSize: 10, fontWeight: "800" },
  distance: { marginTop: 4, color: "#12805F", fontSize: 11, fontWeight: "900" },
  chipScroller: { height: 42, minHeight: 42, flexGrow: 0, flexShrink: 0 },
  chips: { minHeight: 42, paddingHorizontal: 10, gap: 6, paddingVertical: 4, alignItems: "center" },
  chip: { flexDirection: "row", gap: 4, minHeight: 34, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E5E5", alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: "#FF4747", borderColor: "#FF4747" },
  chipText: { fontSize: 12, lineHeight: 18, fontWeight: "800", color: "#555", includeFontPadding: false },
  chipTextActive: { color: "#FFF" },
  listHeading: { flexShrink: 0, paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  columns: { gap: 8 },
  card: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", marginBottom: 8, maxWidth: "49%", borderWidth: 1, borderColor: "#ECECEC" },
  cardGallery: {height:160,flexDirection:"row",flexWrap:"wrap",overflow:"hidden",backgroundColor:"#EEE"},
  cardGalleryTile: {width:"50%",height:80},
  cardGallerySingle: {width:"100%",height:160},
  morePhotos: {position:"absolute",right:4,bottom:4,backgroundColor:"#102C25",color:"#FFF",padding:4,borderRadius:4,fontSize:10},
  cardImage: { width: "100%", aspectRatio: 1.35, backgroundColor: "#EEE" },
  cardBody: { padding: 8 },
  cardTitle: { fontSize: 13, lineHeight: 17, fontWeight: "800", color: "#191919" },
  cardPrice: { fontSize: 15, fontWeight: "900", color: "#FF4747", marginTop: 3 },
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
