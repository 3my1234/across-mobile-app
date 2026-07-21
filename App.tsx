import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert, Animated, Dimensions, FlatList, Image,
  Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePrivy, PrivyProvider, useLoginWithOAuth } from "@privy-io/expo";
import { Component, ReactNode } from "react";

import { Product, CartItem, Quote, OrderSummary, Tab, AuthMode, AppStage, SupportTicket, SupportMessage } from "./components/types";
import { API_URL, TOKEN_KEY, EXPIRY_KEY, LOGO, FLUTTERWAVE_LOGO, FALLBACK_IMAGES, TRACKING_STAGES, BOTTOM_NAV_HEIGHT, defaultCategories } from "./components/config";
import { money, fetchWithTimeout, sleep } from "./components/utils";
import { FlashSaleBanner } from "./components/FlashSaleBanner";
import { ProductCard } from "./components/ProductCard";
import { NAV_ITEMS } from "./components/NavItems";
import { LaunchScreen, MissingConfigScreen, StartupErrorScreen, AuthScreen, ProductDetailScreen } from "./components/Screens";
import { s } from "./components/Styles";

WebBrowser.maybeCompleteAuthSession();
const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "";
const SESSION_TIMEOUT = 8000;

export default function App() {
  if (!PRIVY_APP_ID || !PRIVY_CLIENT_ID) return <SafeAreaProvider><MissingConfigScreen /></SafeAreaProvider>;
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}><AcrossApp /></PrivyProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(err: unknown) { return { error: err instanceof Error ? err.message : "Startup error" }; }
  render() { return this.state.error ? <StartupErrorScreen message={this.state.error} /> : this.props.children; }
}

function AcrossApp() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);
  const winWidth = Dimensions.get("window").width;
  const homeColumns = winWidth < 390 ? 2 : 3;
  const { user: privyUser, isReady: privyReady, getAccessToken, logout: privyLogout } = usePrivy();
  const { login: loginWithOAuth, state: oauthState } = useLoginWithOAuth();
  const [stage, setStage] = useState<AppStage>("booting");
  const [authMode, setAuthMode] = useState<AuthMode>("welcome");
  const [token, setToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentState, setPaymentState] = useState<"idle" | "waiting" | "settled" | "failed">("idle");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollY = useRef(new Animated.Value(0)).current;
  const bootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [xpBalance, setXpBalance] = useState(0);
  const [xpClaimed, setXpClaimed] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileRegion, setProfileRegion] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profilePostalCode, setProfilePostalCode] = useState("");
  const [profileDob, setProfileDob] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [detectedCountryCode, setDetectedCountryCode] = useState("");
  const [detectedCountryName, setDetectedCountryName] = useState("");

  const categories = useMemo(() => {
    const names = new Set<string>();
    names.add("All");
    products.forEach(p => { if (p.category_path?.[0]?.trim()) names.add(p.category_path[0].trim()); });
    return Array.from(names);
  }, [products]);

  const flashSales = useMemo(() => products.filter(p => p.is_flash_sale), [products]);
  const visibleProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== "All") {
      filtered = filtered.filter(p => p.category_path?.some(c => c.toLowerCase() === selectedCategory.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.category_path?.some(c => c.toLowerCase().includes(q)) || p.sku.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const totals = useMemo(() => {
    const items = cart.reduce((sum, i) => sum + i.quantity, 0);
    const amount = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const customs = amount * 0.2;
    const vat = items > 0 ? 100 : 0;
    return { items, amount, customs, vat, payablePreview: amount + customs + vat };
  }, [cart]);

  useEffect(() => {
    restoreSession();
    bootTimer.current = setTimeout(() => setStage(prev => prev === "booting" ? "auth" : prev), SESSION_TIMEOUT);
    return () => { if (bootTimer.current) clearTimeout(bootTimer.current); };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        if (!mounted) return;
        setDetectedCountryCode(String(data.country_code || "").toUpperCase());
        setDetectedCountryName(String(data.country_name || ""));
        if (data.country_name && !profileRegion) setProfileRegion(String(data.country_name));
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (privyReady && privyUser && oauthBusy && stage === "auth") finishPrivyLogin();
  }, [privyReady, privyUser, oauthBusy]);

  useEffect(() => {
    if (!oauthState) return;
    if (oauthState.status === "error") {
      setOauthBusy(false); setBusy(false);
      Alert.alert("Sign-in failed", (oauthState as any)?.error?.message || (oauthState as any)?.error || "Google sign-in failed");
    }
  }, [oauthState]);

  useEffect(() => {
    if (stage !== "app" || !token) return;
    void claimDailyXP(token, false);
    void loadXPBalance(token);
    void loadOrders(token);
    void loadNotifications(token);
    void loadProfile(token);
    const interval = setInterval(() => { void loadNotifications(token); }, 10000);
    return () => clearInterval(interval);
  }, [stage, token]);

  async function restoreSession() {
    setStage("booting");
    try {
      const [storedToken, expiry] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(EXPIRY_KEY)]);
      if (!storedToken || !expiry || Date.now() >= Number(expiry) * 1000) { await clearSession(); setStage("auth"); return; }
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      const r = await fetch(`${API_URL}/api/v1/auth/session`, { headers: { Authorization: `Bearer ${storedToken}` }, signal: controller.signal });
      if (!r.ok) { await clearSession(); setStage("auth"); return; }
      setToken(storedToken);
      await loadProducts();
      loadProfile(storedToken).catch(() => {});
      setStage("app");
    } catch { await clearSession(); setStage("auth"); }
  }

  async function loadNotifications(authToken: string | null = token) {
    if (!authToken) return;
    try {
      const [listR, countR] = await Promise.all([
        fetch(`${API_URL}/api/v1/notifications`, { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(`${API_URL}/api/v1/notifications/unread-count`, { headers: { Authorization: `Bearer ${authToken}` } })
      ]);
      if (listR.ok) setNotifications((await listR.json()).notifications || []);
      if (countR.ok) setUnreadCount((await countR.json()).unread_count || 0);
    } catch {}
  }

  async function markNotificationRead(id: string) {
    if (!token) return;
    try { await fetch(`${API_URL}/api/v1/notifications/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); await loadNotifications(); } catch {}
  }

  async function markAllRead() {
    if (!token) return;
    try { await fetch(`${API_URL}/api/v1/notifications/read-all`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }); await loadNotifications(); } catch {}
  }

  async function saveSession(s: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, s.access_token);
    await SecureStore.setItemAsync(EXPIRY_KEY, String(s.expires_at));
    setToken(s.access_token);
    await loadProducts();
    loadProfile(s.access_token).catch(() => {});
    setStage("app");
  }

  async function clearSession() {
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(EXPIRY_KEY)]);
    setToken(null);
    setProducts([]);
    setCart([]);
    setQuote(null);
    setPaymentState("idle");
    setPaymentMessage("");
    setOrders([]);
    setXpBalance(0);
    setXpClaimed(false);
    setSupportTickets([]);
    setSupportSubject("");
    setSupportMessage("");
    setSelectedTicket(null);
    setTicketMessages([]);
    setNotifications([]);
    setUnreadCount(0);
    setShowNotifications(false);
    setProfile(null);
    setProfileName("");
    setProfilePhone("");
    setProfileRegion("");
    setProfileAddress("");
    setProfileCity("");
    setProfileState("");
    setProfilePostalCode("");
    setProfileDob("");
    setProfileAvatar("");
    setEditingProfile(false);
    setSelectedProduct(null);
    setSearchQuery("");
    setSelectedCategory("All");
    stopPaymentPolling();
  }

  async function logout() {
    await clearSession();
    try { await privyLogout(); await WebBrowser.dismissAuthSession(); } catch {}
    setAuthMode("welcome"); setStage("auth");
  }

  async function loadProducts() {
    try { const r = await fetch(`${API_URL}/api/v1/products`); if (r.ok) setProducts((await r.json()).products ?? []); } catch { try { const r = await fetch(`${API_URL}/api/v1/products`); if (r.ok) setProducts((await r.json()).products ?? []); } catch {} }
  }

  const refreshHomeData = useCallback(async () => {
    setRefreshing(true);
    try { const r = await fetch(`${API_URL}/api/v1/products`); if (r.ok) setProducts((await r.json()).products ?? []); } catch {}
    finally { setRefreshing(false); }
  }, []);

  async function authenticate(path: string, payload: Record<string, string>) {
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) }, body: JSON.stringify(payload) });
      const d = await readResponseBody(r);
      if (d.requires_email_verification) {
        setAuthMode("signin");
        Alert.alert("Verify your email", "We sent you a verification email. Confirm it before signing in.");
        return;
      }
      if (r.status === 409) {
        Alert.alert("Account conflict", d?.message || "An account already uses these details.", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in", onPress: () => setAuthMode("signin") },
          { text: "Resend email", onPress: () => { void resendVerification(payload.email || ""); } }
        ]);
        return;
      }
      if (!r.ok) throw new Error(formatHttpError(r, d, "Auth failed"));
      await saveSession(d);
    } catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : ""); } finally { setBusy(false); }
  }

  async function resendVerification(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert("Email required", "Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/v1/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const d = await readResponseBody(r);
      if (!r.ok) throw new Error(formatHttpError(r, d, "Could not resend verification"));
      Alert.alert("Verification email", d?.message || "If the account exists, a verification email has been sent.");
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Could not resend verification");
    } finally {
      setBusy(false);
    }
  }

  async function authenticateWithGoogle() {
    if (!PRIVY_APP_ID || PRIVY_APP_ID.startsWith("REPLACE_ME")) { Alert.alert("Privy not configured"); return; }
    setOauthBusy(true); setBusy(true);
    try {
      if (privyReady && privyUser) { await finishPrivyLogin(); return; }
      await loginWithOAuth({ provider: "google", redirectUri: "/oauth" });
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.toLowerCase().includes("already logged in") && privyUser) { await finishPrivyLogin(); return; }
      setOauthBusy(false); setBusy(false); Alert.alert("Sign-in failed", msg || "Please try again");
    }
  }

  async function finishPrivyLogin() {
    setBusy(true);
    try {
      const privyToken = await getPrivyAccessTokenWithRetry();
      if (!privyToken) throw new Error("Could not get access token");
      const r = await fetchWithTimeout(`${API_URL}/api/v1/auth/privy/verify`, { method: "POST", headers: { "Content-Type": "application/json", ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) }, body: JSON.stringify({ privy_token: privyToken }) });
      const d = await readResponseBody(r);
      if (!r.ok) throw new Error(formatHttpError(r, d, "Verification failed"));
      await saveSession(d); setOauthBusy(false);
    } catch (e) { setOauthBusy(false); Alert.alert("Sign-in failed", e instanceof Error ? e.message : ""); } finally { setBusy(false); }
  }

  async function getPrivyAccessTokenWithRetry() {
    for (let i = 0; i < 10; i++) { const t = await getAccessToken().catch(() => null); if (t) return t; await sleep(500); }
    return null;
  }

  async function readResponseBody(response: Response) {
    const text = await response.text().catch(() => "");
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function formatHttpError(response: Response, body: any, fallback: string) {
    const message = body?.message || body?.error || body?.detail || body?.msg || fallback;
    return `${message} (HTTP ${response.status})`;
  }

  function getCartQuantity(sku: string) { return cart.find(i => i.product.sku === sku)?.quantity ?? 0; }
  function addToCart(p: Product) {
    setQuote(null);
    const q = getCartQuantity(p.sku);
    const capped = Math.min(q + 1, p.inventory_count);
    setCart(items => { const e = items.find(i => i.product.sku === p.sku); if (!e) return [...items, { product: p, quantity: capped }]; return items.map(i => i.product.sku === p.sku ? { ...i, quantity: capped } : i); });
  }
  function removeFromCart(p: Product) {
    const q = getCartQuantity(p.sku);
    if (q <= 1) { setCart(items => items.filter(i => i.product.sku !== p.sku)); return; }
    setCart(items => items.map(i => i.product.sku === p.sku ? { ...i, quantity: i.quantity - 1 } : i));
  }

  async function checkout() {
    if (!token || cart.length === 0) return;
    setBusy(true); try {
      const items = cart.map(i => ({ product_id: i.product.id, sku: i.product.sku, quantity: i.quantity, origin_hub_id: i.product.origin_hub?.id || "", variant: {} }));
      const r = await fetch(`${API_URL}/api/v1/checkout/quote`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) }, body: JSON.stringify({ country_code: "NG", items }) });
      if (r.status === 401) { await logout(); return; }
      if (!r.ok) { const errData = await r.json().catch(() => ({})); throw new Error(errData.message || "Checkout failed"); }
      const q = await r.json() as Quote;
      setQuote(q);
      await payWithFlutterwave(q);
    } catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : ""); } finally { setBusy(false); }
  }

  async function payWithFlutterwave(quoteData?: Quote) {
    const q = quoteData || quote;
    if (!token || !q) return; setBusy(true);
    try {
      const redirectUrl = "across://payments/flutterwave";
      const r = await fetch(`${API_URL}/api/v1/payments/flutterwave/checkout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) }, body: JSON.stringify({ order_id: q.order_id, amount: String(q.grand_total), currency: q.currency, redirect_url: redirectUrl }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Payment setup failed");
      const checkoutLink = d.checkout_link || d.response?.data?.link;
      if (!checkoutLink) throw new Error("Payment link unavailable");
      setPaymentState("waiting"); setPaymentMessage("Opening Flutterwave checkout...");
      const result = await WebBrowser.openAuthSessionAsync(checkoutLink, redirectUrl);
      if (result.type === "cancel" || result.type === "dismiss") {
        setPaymentState("failed"); setPaymentMessage("Payment cancelled. Cart kept for retry.");
        return;
      }
      setPaymentState("waiting"); setPaymentMessage("Checkout closed. Verifying payment...");
      stopPaymentPolling();
      const success = await pollPaymentStatus(q.order_id);
      if (success) {
        setCart([]); // Clear cart on success
        setQuote(null);
        Alert.alert("Payment Successful!", "Your order has been placed. Check Track tab for updates.");
        setActiveTab("track");
      }
    } catch (e) {
      setPaymentState("failed");
      setPaymentMessage(e instanceof Error ? e.message : "Payment failed");
      Alert.alert("Payment Failed", e instanceof Error ? e.message : "");
    } finally { setBusy(false); }
  }

  function stopPaymentPolling() { if (paymentPollTimer.current) { clearTimeout(paymentPollTimer.current); paymentPollTimer.current = null; } }

  async function pollPaymentStatus(orderId: string, attempts = 0): Promise<boolean> {
    if (!token) return false;
    try {
      const r = await fetch(`${API_URL}/api/v1/orders/${orderId}/payment-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("status unavailable");
      const d = await r.json();
      const state = String(d.payment_state || "pending");
      if (state === "settled" || state === "released") {
        setPaymentState("settled"); setPaymentMessage("Payment confirmed!");
        await Promise.all([loadNotifications(token), loadXPBalance(token), loadOrders(token)]);
        return true;
      }
      setPaymentState("waiting"); setPaymentMessage("Waiting for Flutterwave to confirm.");
      if (attempts < 30) {
        await new Promise(resolve => { paymentPollTimer.current = setTimeout(resolve, 3000); });
        return pollPaymentStatus(orderId, attempts + 1);
      } else {
        setPaymentState("failed"); setPaymentMessage("Payment initiated, but confirmation is still pending.");
        return false;
      }
    } catch {
      setPaymentState("failed"); setPaymentMessage("Could not confirm payment yet.");
      return false;
    }
  }

  async function claimDailyXP(authToken: string | null = token, showFeedback = true) {
    if (!authToken) return;
    if (showFeedback) setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/v1/xp/daily-login`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
      const d = await readResponseBody(r);
      if (!r.ok) throw new Error(formatHttpError(r, d, "Could not claim daily XP"));
      setXpClaimed(true);
      await Promise.all([loadXPBalance(authToken), loadNotifications(authToken)]);
      if (showFeedback) Alert.alert(d.claimed ? "XP Earned!" : "Already claimed", d.message || "Daily XP updated");
    } catch (e) {
      if (showFeedback) Alert.alert("Failed", e instanceof Error ? e.message : "Could not claim daily XP");
    } finally {
      if (showFeedback) setBusy(false);
    }
  }

  async function loadXPBalance(authToken: string | null = token) {
    if (!authToken) return;
    try { const r = await fetch(`${API_URL}/api/v1/xp/balance`, { headers: { Authorization: `Bearer ${authToken}` } }); if (r.ok) { const d = await r.json(); setXpBalance(d.xp || 0); } } catch {}
  }

  async function loadOrders(authToken: string | null = token) {
    if (!authToken) return;
    try {
      const r = await fetch(`${API_URL}/api/v1/orders`, { headers: { Authorization: `Bearer ${authToken}` } });
      if (r.ok) setOrders((await r.json()).orders || []);
    } catch {}
  }

  async function refreshOrders() {
    setRefreshing(true);
    try { await loadOrders(); } finally { setRefreshing(false); }
  }

  async function loadSupportTickets() {
    if (!token) return;
    try { const r = await fetch(`${API_URL}/api/v1/support/tickets`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const d = await r.json(); setSupportTickets(d.tickets || []); } } catch {}
  }

  async function createSupportTicket() {
    if (!token || !supportSubject.trim() || !supportMessage.trim()) return; setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/v1/support/tickets`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ subject: supportSubject.trim(), message: supportMessage.trim() }) });
      if (!r.ok) throw new Error("Failed to create ticket");
      setSupportSubject(""); setSupportMessage(""); Alert.alert("Ticket Created", "We'll get back to you soon."); await loadSupportTickets();
    } catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : ""); } finally { setBusy(false); }
  }

  async function loadTicketMessages(ticketId: string) {
    if (!token) return;
    try { const r = await fetch(`${API_URL}/api/v1/support/tickets/${ticketId}/messages`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) { const d = await r.json(); setTicketMessages(d.messages || []); } } catch {}
  }

  // ---- Profile ----
  async function loadProfile(authToken: string | null = token) {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_URL}/api/v1/profile`, { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await readResponseBody(response);
      if (!response.ok) throw new Error(formatHttpError(response, data, "Could not load profile"));
      setProfile(data);
      setProfileName(data.full_name || "");
      setProfilePhone(data.phone || "");
      setProfileRegion(data.region || "");
      setProfileAddress(data.address || "");
      setProfileCity(data.city || "");
      setProfileState(data.state || "");
      setProfilePostalCode(data.postal_code || "");
      setProfileDob(data.date_of_birth ? data.date_of_birth.slice(0, 10) : "");
      setProfileAvatar(data.avatar_url || "");
    } catch (error) {
      console.warn("Profile load failed", error);
    }
  }

  async function saveProfile() {
    if (!token) { Alert.alert("Session expired", "Please sign in again."); return; }
    setBusy(true);
    try {
      const body: any = {
        full_name: profileName.trim(),
        phone: profilePhone.trim(),
        region: profileRegion.trim(),
        address: profileAddress.trim(),
        city: profileCity.trim(),
        state: profileState.trim(),
        postal_code: profilePostalCode.trim(),
        date_of_birth: profileDob.trim()
      };
      if (profileAvatar.startsWith("https://") || profileAvatar.startsWith("http://")) body.avatar_url = profileAvatar;
      const response = await fetch(`${API_URL}/api/v1/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) },
        body: JSON.stringify(body)
      });
      const data = await readResponseBody(response);
      if (!response.ok) throw new Error(formatHttpError(response, data, "Failed to save profile"));
      Alert.alert("Saved", "Your profile has been updated.");
      setEditingProfile(false);
      await loadProfile(token);
    } catch (error) {
      Alert.alert("Profile not saved", error instanceof Error ? error.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }

  async function pickAvatar() {
    if (!token) { Alert.alert("Session expired", "Please sign in again."); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission needed", "Allow access to your photo library."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const previousAvatar = profileAvatar;
    const mimeType = asset.mimeType || "image/jpeg";
    const filename = asset.fileName || `avatar-${Date.now()}.jpg`;
    setProfileAvatar(asset.uri);
    setBusy(true);
    try {
      const presignResponse = await fetch(`${API_URL}/api/v1/uploads/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filename, mimeType, scope: "profile" })
      });
      const presign = await readResponseBody(presignResponse);
      if (!presignResponse.ok) throw new Error(formatHttpError(presignResponse, presign, "Upload preparation failed"));
      if (!presign.uploadUrl || !(presign.viewUrl || presign.publicUrl)) throw new Error("Upload service returned an incomplete response");

      const blob = await fetch(asset.uri).then(response => response.blob());
      const uploadResponse = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: blob });
      if (!uploadResponse.ok) throw new Error(`Image upload failed (HTTP ${uploadResponse.status})`);

      const avatarUrl = presign.viewUrl || presign.publicUrl;
      const saveResponse = await fetch(`${API_URL}/api/v1/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(detectedCountryCode ? { "X-Client-Country-Code": detectedCountryCode } : {}) },
        body: JSON.stringify({ avatar_url: avatarUrl })
      });
      const saveData = await readResponseBody(saveResponse);
      if (!saveResponse.ok) throw new Error(formatHttpError(saveResponse, saveData, "Profile picture could not be saved"));
      setProfileAvatar(avatarUrl);
      await loadProfile(token);
    } catch (error) {
      setProfileAvatar(previousAvatar);
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (stage === "app" && token && !profileRegion && detectedCountryName) {
      setProfileRegion(detectedCountryName);
    }
  }, [stage, token, profileRegion, detectedCountryName]);

  const countryNotice = detectedCountryCode && detectedCountryCode !== "NG"
    ? `Service is currently available in Nigeria only. Detected ${detectedCountryName || detectedCountryCode}.`
    : "";

  if (stage === "booting") return <LaunchScreen />;
  if (stage === "auth") return <AuthScreen mode={authMode} busy={busy} noticeText={countryNotice} onModeChange={setAuthMode} onSubmit={authenticate} onResend={resendVerification} onGoogle={authenticateWithGoogle} />;

  const LOGO_FULL_HEIGHT = 52;
  const logoHeight = scrollY.interpolate({ inputRange: [0, LOGO_FULL_HEIGHT], outputRange: [LOGO_FULL_HEIGHT, 0], extrapolate: "clamp" });
  const logoOpacity = scrollY.interpolate({ inputRange: [0, LOGO_FULL_HEIGHT], outputRange: [1, 0], extrapolate: "clamp" });
  const searchTranslate = scrollY.interpolate({ inputRange: [0, LOGO_FULL_HEIGHT], outputRange: [0, -40], extrapolate: "clamp" });

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Notification Bell */}
      <View style={{ position: "absolute", top: insets.top + 4, right: 12, zIndex: 100 }}>
        <Pressable onPress={() => setShowNotifications(v => !v)} style={{ padding: 6 }}>
          <Ionicons name={unreadCount > 0 ? "notifications" : "notifications-outline"} size={24} color="#191919" />
          {unreadCount > 0 && (
            <View style={{ position: "absolute", top: 2, right: 2, backgroundColor: "#FF4747", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "900" }}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {showNotifications && (
        <View style={{ position: "absolute", top: insets.top + 48, right: 8, left: 8, backgroundColor: "#FFFFFF", borderRadius: 12, zIndex: 99, maxHeight: 400, borderWidth: 1, borderColor: "#EDEDED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderBottomWidth: 1, borderColor: "#EDEDED" }}>
            <Text style={{ fontWeight: "900", fontSize: 16 }}>Notifications</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {unreadCount > 0 && <Pressable onPress={markAllRead}><Text style={{ color: "#FF4747", fontSize: 12, fontWeight: "700" }}>Mark all read</Text></Pressable>}
              <Pressable onPress={() => setShowNotifications(false)}><Ionicons name="close" size={20} color="#8C8C8C" /></Pressable>
            </View>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {notifications.length === 0 ? <Text style={{ padding: 20, textAlign: "center", color: "#8C8C8C" }}>No notifications yet</Text>
            : notifications.slice(0, 30).map(n => (
              <Pressable key={n.id} style={{ padding: 12, borderBottomWidth: 1, borderColor: "#F0F0F0", backgroundColor: n.is_read ? "#FFFFFF" : "#FFF5F5" }} onPress={() => markNotificationRead(n.id)}>
                <Text style={{ fontWeight: "800", fontSize: 13 }}>{n.title}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: "#595959" }}>{n.body}</Text>
                <Text style={{ marginTop: 2, fontSize: 10, color: "#BFBFBF" }}>{new Date(n.created_at).toLocaleString()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Home header */}
      {activeTab === "home" && (
        <View style={{ backgroundColor: "#FFFFFF", zIndex: 10 }}>
          <Animated.View style={{ height: logoHeight, opacity: logoOpacity, overflow: "hidden", paddingHorizontal: 14, justifyContent: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Image source={LOGO} style={{ width: 32, height: 32 }} resizeMode="contain" />
              <View>
                <Text style={{ color: "#191919", fontSize: 17, fontWeight: "900" }}>Atlantic Express</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <Ionicons name="location-outline" size={12} color="#8C8C8C" />
                  <Text style={{ color: "#8C8C8C", fontSize: 11, fontWeight: "700" }}>Deliver to Nigeria</Text>
                </View>
              </View>
            </View>
          </Animated.View>
          <Animated.View style={{ transform: [{ translateY: searchTranslate }], backgroundColor: "#FFFFFF" }}>
            <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 999, paddingHorizontal: 14, height: 38, backgroundColor: "#F5F5F5" }}>
                <Ionicons name="search" size={18} color="#8C8C8C" />
                <TextInput style={{ flex: 1, color: "#191919", fontWeight: "600" }} placeholder="Search products, categories..." placeholderTextColor="#8C8C8C" value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && <Pressable onPress={() => setSearchQuery("")}><Ionicons name="close-circle" size={18} color="#8C8C8C" /></Pressable>}
              </View>
            </View>
            <View style={{ paddingBottom: 6, borderBottomWidth: 1, borderColor: "#EDEDED" }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
                {categories.map(cat => (
                  <Pressable key={cat} style={[{ height: 32, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E8E8E8", backgroundColor: "#FFFFFF" }, selectedCategory === cat && { borderColor: "#FF4747", backgroundColor: "#FFF1F1" }]} onPress={() => setSelectedCategory(cat)}>
                    <Text style={[{ color: "#595959", fontWeight: "800", fontSize: 12 }, selectedCategory === cat && { color: "#FF4747" }]}>{cat}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      )}

      {activeTab !== "home" && (
        <View style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderColor: "#EDEDED" }}>
          <Text style={{ color: "#191919", fontSize: 22, fontWeight: "900" }}>{NAV_ITEMS.find(i => i.key === activeTab)?.label ?? "Atlantic Express"}</Text>
          <Text style={{ marginTop: 2, color: "#8C8C8C", fontSize: 13, fontWeight: "700" }}>{activeTab === "cart" ? `${totals.items} items` : "Atlantic Express"}</Text>
        </View>
      )}

      <View style={s.content}>
        {activeTab === "home" && (
          <Animated.FlatList data={visibleProducts} keyExtractor={item => item.id} numColumns={homeColumns}
            contentContainerStyle={[s.productList, { paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 16 }]} columnWrapperStyle={s.productRow}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHomeData} tintColor="#FF4747" />}
            ListHeaderComponent={<><View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6, backgroundColor: "#FFFFFF" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "#191919", fontSize: 13, fontWeight: "800" }}>Trending now</Text>
                <Text style={{ color: "#8C8C8C", fontSize: 12, fontWeight: "700" }}>{visibleProducts.length} items</Text>
              </View>
            </View><FlashSaleBanner flashSales={flashSales} onSelectProduct={setSelectedProduct} /></>}
            renderItem={({ item }) => <ProductCard product={item} cartQuantity={getCartQuantity(item.sku)} onPress={() => setSelectedProduct(item)} />} />
        )}

        {activeTab === "cart" && (
          <ScrollView contentContainerStyle={[s.screenPad, { paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 16 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHomeData} tintColor="#FF4747" />}>
            {cart.length === 0 ? (
              <View style={s.emptyPanel}><Ionicons name="cart-outline" size={42} color="#BFBFBF" /><Text style={s.emptyPanelTitle}>Your cart is empty</Text><Pressable style={s.primaryButton} onPress={() => setActiveTab("home")}><Text style={s.primaryButtonText}>Shop</Text></Pressable></View>
            ) : (
              <>{cart.map(item => (<View key={item.product.sku} style={s.cartItemCard}><Image source={{ uri: item.product.image_urls[0] || FALLBACK_IMAGES[0] }} style={s.cartItemImage} /><View style={s.cartItemBody}><Text style={s.cartItemTitle} numberOfLines={2}>{item.product.title}</Text><Text style={s.price}>{money(item.product.price)}</Text><View style={s.quantityRow}><Pressable style={s.quantityButton} onPress={() => removeFromCart(item.product)}><Ionicons name="remove" size={18} color="#191919" /></Pressable><Text style={s.quantityValue}>{item.quantity}</Text><Pressable style={[s.quantityButton, item.quantity >= item.product.inventory_count && s.disabled]} onPress={() => addToCart(item.product)} disabled={item.quantity >= item.product.inventory_count}><Ionicons name="add" size={18} color="#191919" /></Pressable></View></View></View>))}
              <View style={s.panel}>
                <View style={s.metric}><Text style={s.metricLabel}>Subtotal</Text><Text style={s.metricValue}>{money(totals.amount)}</Text></View>
                <View style={s.metric}><Text style={s.metricLabel}>Customs (20%)</Text><Text style={s.metricValue}>{money(totals.customs)}</Text></View>
                <View style={s.metric}><Text style={s.metricLabel}>VAT</Text><Text style={s.metricValue}>{money(totals.vat)}</Text></View>
                <View style={s.metric}><Text style={s.metricLabel}>Total</Text><Text style={[s.metricValue, s.accentText]}>{quote ? money(quote.grand_total) : money(totals.payablePreview)}</Text></View>
                <Pressable style={[s.primaryButton, busy && s.disabled]} onPress={checkout} disabled={busy}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Image source={FLUTTERWAVE_LOGO} style={{ width: 20, height: 20, resizeMode: "contain" }} />
                    <Text style={s.primaryButtonText}>{busy ? "Processing..." : "Pay using Flutterwave"}</Text>
                  </View>
                </Pressable>
                {paymentMessage ? <Text style={{ marginTop: 10, color: paymentState === "failed" ? "#B42318" : "#30423D", fontWeight: "700" }}>{paymentMessage}</Text> : null}
              </View></>
            )}
          </ScrollView>
        )}

        {activeTab === "account" && (
          <ScrollView contentContainerStyle={[s.screenPad, { paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 16 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHomeData} tintColor="#FF4747" />}>
            <View style={s.accountHero}>
              <Pressable onPress={pickAvatar}>
                {profileAvatar ? <Image source={{ uri: profileAvatar }} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "#F0F0F0" }} />
                : <View style={s.accountAvatar}><Ionicons name="person" size={28} color="#FFF" /></View>}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={s.accountName}>{profileName || "Atlantic Express buyer"}</Text>
                <Text style={s.accountMeta}>{profileRegion || "Nigeria"} · {profilePhone || "Add phone"}</Text>
              </View>
              <Pressable onPress={() => setEditingProfile(true)} style={{ padding: 8 }}><Ionicons name="create-outline" size={22} color="#FF4747" /></Pressable>
            </View>
            {editingProfile && (
              <View style={s.panel}>
                <Text style={s.panelTitle}>Edit Profile</Text>
                <Pressable onPress={pickAvatar} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <Ionicons name="camera-outline" size={24} color="#FF4747" />
                  <Text style={{ color: "#FF4747", fontWeight: "700" }}>Change profile picture</Text>
                </Pressable>
                <TextInput style={s.input} value={profileName} onChangeText={setProfileName} placeholder="Full name" />
                <TextInput style={s.input} value={profilePhone} onChangeText={setProfilePhone} placeholder="Phone number" keyboardType="phone-pad" />
                <TextInput style={s.input} value={profileRegion} onChangeText={setProfileRegion} placeholder="Region" />
                <TextInput style={s.input} value={profileAddress} onChangeText={setProfileAddress} placeholder="Street address" />
                <TextInput style={s.input} value={profileCity} onChangeText={setProfileCity} placeholder="City" />
                <TextInput style={s.input} value={profileState} onChangeText={setProfileState} placeholder="State" />
                <TextInput style={s.input} value={profilePostalCode} onChangeText={setProfilePostalCode} placeholder="Postal code" />
                <TextInput style={s.input} value={profileDob} onChangeText={setProfileDob} placeholder="Date of birth (YYYY-MM-DD)" />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable style={[s.secondaryButton, { flex: 1 }]} onPress={() => setEditingProfile(false)}><Text style={s.secondaryButtonText}>Cancel</Text></Pressable>
                  <Pressable style={[s.primaryButtonSmall, { flex: 1 }, busy && s.disabled]} onPress={saveProfile} disabled={busy}><Text style={s.primaryButtonText}>{busy ? "..." : "Save"}</Text></Pressable>
                </View>
              </View>
            )}
            <View style={s.panel}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View><Text style={s.kicker}>XP Rewards</Text><Text style={{ fontSize: 24, fontWeight: "900", color: "#FF4747" }}>{xpBalance} XP</Text><Text style={{ color: "#8C8C8C", fontSize: 13, fontWeight: "700" }}>= ₦{xpBalance} discount</Text></View>
                <Pressable style={[s.primaryButtonSmall, { minWidth: 100 }, xpClaimed && s.disabled]} onPress={() => { void claimDailyXP(); }} disabled={xpClaimed || busy}><Text style={s.primaryButtonText}>{xpClaimed ? "Claimed" : busy ? "..." : "Claim 1 XP"}</Text></Pressable>
              </View>
            </View>
            <View style={s.quickLinks}>
              {[{ tab: "track" as Tab, label: "Track", icon: "airplane-outline" as const, meta: "Your orders" },
                { tab: "support" as Tab, label: "Support", icon: "chatbubble-ellipses-outline" as const, meta: "Contact us" }
              ].map(link => (
                <Pressable key={link.tab} style={s.quickLinkCard} onPress={() => setActiveTab(link.tab)}>
                  <Ionicons name={link.icon} size={22} color="#FF4747" /><View style={s.quickLinkCopy}><Text style={s.quickLinkTitle}>{link.label}</Text><Text style={s.quickLinkMeta}>{link.meta}</Text></View>
                  <Ionicons name="chevron-forward" size={18} color="#BFBFBF" />
                </Pressable>
              ))}
            </View>
            <Pressable style={s.logoutButton} onPress={logout}><Ionicons name="log-out-outline" size={18} color="#FF4747" /><Text style={s.logoutButtonText}>Sign out</Text></Pressable>
          </ScrollView>
        )}

        {activeTab === "track" && (
          <ScrollView contentContainerStyle={[s.screenPad, { paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 16 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshOrders} tintColor="#FF4747" />}>
            <View style={s.panel}><Text style={s.kicker}>Orders</Text><Text style={s.panelTitle}>Purchase history and tracking</Text></View>
            {orders.length === 0 ? (
              <View style={s.panel}><Text style={{ color: "#8C8C8C" }}>No orders found yet. Pull down to refresh after payment.</Text></View>
            ) : orders.map(order => {
              const currentIndex = Math.max(0, (TRACKING_STAGES as readonly string[]).indexOf(order.current_tracking_stage));
              return (
                <View key={order.id} style={s.panel}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.panelTitle}>{order.items_summary || `${order.item_count} item(s)`}</Text>
                      <Text style={{ marginTop: 4, color: "#8C8C8C", fontSize: 12 }}>{new Date(order.created_at).toLocaleString()}</Text>
                    </View>
                    <Text style={{ color: order.order_status === "Paid" ? "#12805F" : "#B54708", fontWeight: "900" }}>{order.order_status}</Text>
                  </View>
                  <Text style={{ marginTop: 10, color: "#191919", fontWeight: "900" }}>{money(order.total_amount)}</Text>
                  {!!order.package_label && <Text style={{ marginTop: 4, color: "#66736F", fontSize: 12 }}>Package: {order.package_label}</Text>}
                  <View style={[s.timeline, { marginTop: 16 }]}>{TRACKING_STAGES.map((stageName, index) => {
                    const done = index <= currentIndex;
                    return (<View key={stageName} style={s.timelineItem}>
                      <View style={[s.dot, done && s.doneDot]} />
                      {index !== TRACKING_STAGES.length - 1 && <View style={[s.line, done && s.doneLine]} />}
                      <View style={s.timelineText}><Text style={s.timelineTitle}>{stageName}</Text>{stageName === order.current_tracking_stage && <Text style={{ color: "#12805F", fontSize: 12, fontWeight: "800" }}>Current stage</Text>}</View>
                    </View>);
                  })}</View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {activeTab === "support" && (
          <ScrollView contentContainerStyle={[s.screenPad, { paddingBottom: bottomInset + BOTTOM_NAV_HEIGHT + 16 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSupportTickets()} tintColor="#FF4747" />}>
            {selectedTicket ? (
              <View style={s.panel}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={s.panelTitle}>{selectedTicket.subject}</Text>
                  <Pressable onPress={() => { setSelectedTicket(null); setTicketMessages([]); }}><Ionicons name="close" size={22} color="#8C8C8C" /></Pressable>
                </View>
                <Text style={s.kicker}>Status: {selectedTicket.status}</Text>
                {ticketMessages.map((m, i) => (
                  <View key={i} style={{ marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: m.sender_type === "admin" ? "#EAF8F2" : "#FFFFFF", borderWidth: 1, borderColor: "#EDEDED" }}>
                    <Text style={{ fontWeight: "700", fontSize: 12, color: "#66736F" }}>{m.sender_type === "admin" ? "Admin" : "You"}</Text>
                    <Text style={{ marginTop: 4, color: "#191919", fontSize: 14 }}>{m.message}</Text>
                    <Text style={{ marginTop: 4, color: "#8C8C8C", fontSize: 11 }}>{new Date(m.created_at).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View>
                <View style={s.panel}>
                  <Text style={s.kicker}>Support</Text><Text style={s.panelTitle}>Create a Ticket</Text>
                  <TextInput style={s.input} value={supportSubject} onChangeText={setSupportSubject} placeholder="Subject" />
                  <TextInput style={[s.input, { minHeight: 80 }]} value={supportMessage} onChangeText={setSupportMessage} placeholder="Describe your issue..." multiline />
                  <Pressable style={[s.primaryButton, busy && s.disabled]} onPress={createSupportTicket} disabled={busy}><Text style={s.primaryButtonText}>{busy ? "..." : "Submit Ticket"}</Text></Pressable>
                </View>
                <View style={s.panel}>
                  <Text style={s.panelTitle}>Your Tickets</Text>
                  {supportTickets.length === 0 ? <Text style={{ color: "#8C8C8C", marginTop: 8 }}>No tickets yet.</Text>
                  : supportTickets.map(ticket => (
                    <Pressable key={ticket.id} style={s.quickLinkCard} onPress={async () => { setSelectedTicket(ticket); await loadTicketMessages(ticket.id); }}>
                      <View style={s.quickLinkCopy}><Text style={s.quickLinkTitle}>{ticket.subject}</Text><Text style={s.quickLinkMeta}>{ticket.status} · {new Date(ticket.created_at).toLocaleDateString()}</Text></View>
                      <Ionicons name="chevron-forward" size={18} color="#BFBFBF" />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      <View style={[s.bottomNavWrap, { paddingBottom: bottomInset }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bottomNav}>
          {NAV_ITEMS.map(item => { const active = activeTab === item.key; const badge = item.key === "cart" && totals.items > 0 ? totals.items : 0; return (
            <Pressable key={item.key} style={s.bottomNavItem} onPress={() => setActiveTab(item.key)}>
              <View style={s.bottomNavIconWrap}><Ionicons name={active ? item.activeIcon : item.icon} size={22} color={active ? "#FF4747" : "#8C8C8C"} />{badge > 0 && <View style={s.bottomNavBadge}><Text style={s.bottomNavBadgeText}>{badge > 99 ? "99+" : badge}</Text></View>}</View>
              <Text style={[s.bottomNavLabel, active && s.bottomNavLabelActive]}>{item.label}</Text>
            </Pressable>
          ); })}
        </ScrollView>
      </View>

      {selectedProduct && <ProductDetailScreen product={selectedProduct} token={token} cartQuantity={getCartQuantity(selectedProduct.sku)} onClose={() => setSelectedProduct(null)} onAdd={() => addToCart(selectedProduct)} onRemove={() => removeFromCart(selectedProduct)} />}
    </View>
  );
}
