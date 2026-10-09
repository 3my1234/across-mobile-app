import { useTheme, useThemedStyles, ThemedText as Text, ThemedTextInput as TextInput } from "./ThemeProvider";
import {ProductSellerChat} from "./ProductSellerChat";
import React, { useState, useEffect, useRef } from "react";
import {ActivityIndicator, Alert, Image, ImageBackground,
  findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, SafeAreaView, ScrollView, Share, StyleSheet,  type TextInput as NativeTextInput, View, useWindowDimensions} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthMode, Product, Review, ReviewSummary } from "./types";
import { API_URL, LOGO, FALLBACK_IMAGES } from "./config";
import { money, uploadReviewImage, mapProduct, fetchWithTimeout } from "./utils";
import { saveProductReview } from "./productReview";
import { s as sharedStyles } from "./Styles";
import { ResilientImage } from "./ResilientImage";
import { COLORS } from "./theme";
import { ReviewStars } from "./ReviewStars";
import { ProductCard } from "./ProductCard";
import { freshCatalogURL, useCatalogFreshness } from "./catalogFreshness";
import { latestProductSnapshot } from "./catalogState";

const MOBILE_AUTH_BACKGROUND = require("../assets/mobile-background.png");

// ---- Launch Screen ----
export function LaunchScreen({ label }: { label?: string }) {
  const theme = useTheme();
  const s = useThemedStyles(sharedStyles);
  return (
    <SafeAreaView style={s.launch}>
      <Image source={LOGO} style={s.launchLogo} resizeMode="contain" />
      <ActivityIndicator size="small" color={theme.color("#12805F")} />
      <Text style={s.loadingText}>{label || "Checking your session"}</Text>
    </SafeAreaView>
  );
}

// ---- Missing Config Screen ----
export function MissingConfigScreen() {
  const s = useThemedStyles(sharedStyles);
  return (
    <SafeAreaView style={s.launch}>
      <Image source={LOGO} style={s.launchLogo} resizeMode="contain" />
      <Text style={s.authTitle}>Config missing</Text>
      <Text style={s.authCopy}>Set EXPO_PUBLIC_PRIVY_APP_ID in EAS build env.</Text>
    </SafeAreaView>
  );
}

// ---- Startup Error Screen ----
export function StartupErrorScreen({ message }: { message: string }) {
  const s = useThemedStyles(sharedStyles);
  return (
    <SafeAreaView style={s.launch}>
      <Image source={LOGO} style={s.launchLogo} resizeMode="contain" />
      <Text style={s.authTitle}>Error</Text>
      <Text style={s.authCopy}>{message}</Text>
    </SafeAreaView>
  );
}

// ---- Auth Screen ----
interface AuthProps {
  countryCode: string;
  buyerMarkets: { country_code: string; currency_code: string }[];
  onCountryChange: (countryCode: string) => void;
  mode: AuthMode;
  busy: boolean;
  googleReady: boolean;
  googleTimedOut: boolean;
  googleBusy: boolean;
  noticeText?: string;
  onModeChange: (m: AuthMode) => void;
  onSubmit: (p: string, b: Record<string, string>) => Promise<void>;
  onResend: (email: string) => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
  onGoogle: () => Promise<void>;
}

export function AuthScreen({ mode, countryCode, buyerMarkets, onCountryChange, busy, googleReady, googleTimedOut, googleBusy, noticeText, onModeChange, onSubmit, onResend, onForgotPassword, onGoogle }: AuthProps) {
  const theme = useTheme();
  const s = useThemedStyles(sharedStyles);
  const authInsets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authKeyboardVisible, setAuthKeyboardVisible] = useState(false);
  const authScrollRef = useRef<ScrollView | null>(null);
  const isWelcome = mode === "welcome";
  const title = mode === "signin" ? "Welcome back" : "Create your Atlantic Express account";

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setAuthKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setAuthKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  async function submit() {
    if (mode === "signin") await onSubmit("/api/v1/auth/login", { email, password });
    else if (mode === "signup") await onSubmit("/api/v1/auth/signup", { full_name: fullName, email, phone, password });
  }

  function revealAuthForm(target: number) {
    setTimeout(() => authScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 120, true), Platform.OS === "android" ? 120 : 180);
  }

  return (
    <ImageBackground source={MOBILE_AUTH_BACKGROUND} resizeMode="cover" blurRadius={2} style={s.authBg} imageStyle={s.authBgImage}>
      <View pointerEvents="none" style={s.authBackdrop} />
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <View style={[s.authSafe, { paddingTop: authInsets.top, paddingBottom: authInsets.bottom, paddingLeft: authInsets.left, paddingRight: authInsets.right }]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.authKeyboard}>
          <ScrollView ref={authScrollRef} contentInsetAdjustmentBehavior="never" contentContainerStyle={[s.authScroll, isWelcome && s.authWelcomeScroll, authKeyboardVisible && { paddingBottom: 220 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets>
            <View style={s.authBrand}>
              <Image source={LOGO} style={[s.authLogo, !isWelcome && s.authLogoCompact]} resizeMode="contain" />
              <Text style={s.authEyebrow}>ATLANTIC EXPRESS</Text>
            </View>
            {isWelcome ? (
              <>
                <View style={s.authHero}>
                  <Text style={s.authWelcomeTitle} maxFontSizeMultiplier={1.2}>Discover local and international products, connect with nearby providers, pay securely, and track every order in one place.</Text>
                </View>
                <View style={s.authPanel}>
                {!!noticeText && (
                  <View style={s.authNotice}>
                    <Ionicons name="alert-circle-outline" size={16} color={theme.color("#B54708")} />
                    <Text style={s.authNoticeText}>{noticeText}</Text>
                  </View>
                )}
                <Pressable style={s.authPrimaryButton} onPress={() => onModeChange("signup")}>
                  <Text style={s.primaryButtonText}>Create free account</Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.color("#FFFFFF")} />
                </Pressable>
                <View style={s.authDivider}>
                  <View style={s.authDividerLine} />
                  <Text style={s.authDividerText}>or continue with</Text>
                  <View style={s.authDividerLine} />
                </View>
                <Pressable
                  style={[s.gmailButton, googleBusy && s.disabled]}
                  onPress={onGoogle}
                  disabled={googleBusy}
                  accessibilityLabel={googleReady ? "Sign in with Google" : googleTimedOut ? "Retry Google sign-in" : "Google sign-in is loading"}
                  accessibilityState={{ disabled: googleBusy, busy: (!googleReady && !googleTimedOut) || googleBusy }}
                >
                  {(!googleReady && !googleTimedOut) || googleBusy ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name={googleReady ? "logo-google" : "refresh"} size={18} color={theme.color("#101817")} />}
                  <Text style={s.gmailButtonText}>{googleBusy ? "Opening Google…" : googleReady ? "Sign in with Google" : googleTimedOut ? "Retry Google sign-in" : "Connecting Google sign-in…"}</Text>
                </Pressable>
                {!googleReady && googleTimedOut && (
                  <View style={s.authInlineMessage}>
                    <Ionicons name="information-circle-outline" size={17} color={theme.color("#667085")} />
                    <Text style={s.authInlineMessageText}>Google is taking longer than expected. Retry, or sign in securely with email.</Text>
                  </View>
                )}
                <Pressable style={s.authEmailButton} onPress={() => onModeChange("signin")}>
                  <Ionicons name="mail-outline" size={18} color={theme.color("#202725")} />
                  <Text style={s.authEmailButtonText}>Sign in with email</Text>
                </Pressable>
                <Text style={s.authTerms}>By continuing, you agree to Atlantic Express&apos; terms and privacy policy.</Text>
                </View>
              </>
            ) : (
              <View style={s.authPanel}>
                <Text style={s.authTitle}>{title}</Text>
                <Text style={s.authFormCopy}>{mode === "signin" ? "Access your orders, messages, saved details, and provider requests." : "Join the marketplace to shop, book services, pay securely, and track your orders."}</Text>
                {mode === "signup" && !!noticeText && <Text style={s.authFormCopy}>{noticeText}</Text>}
                {mode === "signup" && <><Text style={s.authFormCopy}>Delivery country and checkout currency</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>{buyerMarkets.map(market => <Pressable key={market.country_code} onPress={() => onCountryChange(market.country_code)} style={[s.secondaryButton, { marginRight: 8, borderColor: theme.color(countryCode === market.country_code ? COLORS.primary : "#D0D5DD", "borderColor") }]}><Text style={s.secondaryButtonText}>{market.country_code} · {market.currency_code}</Text></Pressable>)}</ScrollView></>}
                {mode !== "signin" && <TextInput value={fullName} onChangeText={setFullName} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Full name" autoCapitalize="words" style={s.input} />}
                <TextInput value={email} onChangeText={setEmail} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={s.input} />
                {mode === "signup" && <TextInput value={phone} onChangeText={setPhone} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Phone" keyboardType="phone-pad" style={s.input} />}
                <View style={s.passwordWrap}><TextInput value={password} onChangeText={setPassword} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Password" secureTextEntry={!showPassword} style={s.passwordInput} /><Pressable style={s.passwordToggle} onPress={() => setShowPassword(v => !v)}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.color("#30423D")} /></Pressable></View>
                <Pressable style={[s.primaryButton, busy && s.disabled]} disabled={busy} onPress={submit}><Text style={s.primaryButtonText}>{busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Continue"}</Text></Pressable>
                {mode === "signin" && <Pressable style={s.textButton} disabled={busy} onPress={() => onForgotPassword(email)}><Text style={s.textButtonText}>Forgot password?</Text></Pressable>}
                {mode === "signin" && <Pressable style={s.textButton} disabled={busy} onPress={() => onResend(email)}><Text style={s.textButtonText}>Resend verification email</Text></Pressable>}
                <Pressable style={s.textButton} onPress={() => onModeChange("welcome")}><Text style={s.textButtonText}>Back</Text></Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

// ---- Product Detail Screen ----
interface DetailProps {
  product: Product;
  destination: { country_code: string; state: string; city: string };
  token: string | null;
  cartQuantity: number;
  onClose: () => void;
  onAdd: (product: Product) => void;
  onRemove: (product: Product) => void;
  onProductChange: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  getCartQuantity: (sku: string) => number;
}

export function ProductDetailScreen({ product: initialProduct, destination, token, cartQuantity, onClose, onAdd, onRemove, onProductChange, onSelectProduct, getCartQuantity }: DetailProps) {
  const theme = useTheme();
  const styles = useThemedStyles(baseStyles);
  const [sellerChat,setSellerChat]=useState(false);
  const contactSeller=()=>{if(!token){Alert.alert("Sign in required","Sign in to message this seller.");return;}setSellerChat(true);};
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const [product, setProduct] = useState(initialProduct);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCursor, setReviewCursor] = useState("");
  const [reviewHasMore, setReviewHasMore] = useState(false);
  const [reviewLoadingMore, setReviewLoadingMore] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary>({ count: initialProduct.review_count, average_rating: initialProduct.average_rating });
  const [canReview, setCanReview] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [galleryPhotos, setGalleryPhotos] = useState<string[] | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "reviews" | "recommended">("overview");
  const [actionBarHeight, setActionBarHeight] = useState(120);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const detailScrollRef = useRef<ScrollView | null>(null);
  const reviewInputRef = useRef<NativeTextInput | null>(null);
  const sectionOffsets = useRef({ overview: 0, reviews: 0, recommended: 0 });
  const sectionJump = useRef(false);
  const snapshotRequest = useRef(0);
  const reviewRequest = useRef(0);
  const reviewSaving = useRef(false);
  const recommendationRequest = useRef(0);
  const outOfStock = product.inventory_count <= 0;
  const atMax = cartQuantity >= product.inventory_count;
  const isLocalMerchantProduct = product.fulfillment_mode === "merchant_local";
  const isCrossBorderMerchantProduct = product.fulfillment_mode === "merchant_cross_border";
  const originLabel = [product.inventory_city, product.inventory_country_code].filter(Boolean).join(", ")
    || product.origin_hub.name
    || product.origin_hub.city
    || "International";
  const deliveryAreaLabel = (product.delivery_areas || []).map(area => [area.city, area.state, area.country_code].filter(Boolean).join(", ")).join("; ");

  useEffect(() => {
    setProduct(initialProduct);
    setGalleryIndex(0);
    setHeroIndex(0);
    setGalleryOpen(false);
    setGalleryPhotos(null);
    setShowAllPhotos(false);
    setActiveSection("overview");
    sectionJump.current = false;
    sectionOffsets.current = { overview: 0, reviews: 0, recommended: 0 };
    detailScrollRef.current?.scrollTo({y:0,animated:false});
    void loadDetail(true);
    return () => { snapshotRequest.current += 1; recommendationRequest.current += 1; reviewRequest.current += 1; };
    // The product id and session token are the intentional request keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct.id, token, destination.country_code, destination.state, destination.city]);
  useEffect(() => { setProduct(initialProduct); }, [initialProduct]);
  useCatalogFreshness(async () => {
    await Promise.allSettled([loadProductSnapshot(true), loadRecommendations()]);
  });
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);


  async function loadProductSnapshot(force = true) {
    const request = ++snapshotRequest.current;
    const params = new URLSearchParams(destination);
    const url = `${API_URL}/api/v1/products/${initialProduct.id}?${params}`;
    const response = await fetchWithTimeout(force ? freshCatalogURL(url) : url, { headers: force ? { "Cache-Control": "no-cache" } : undefined });
    if (request !== snapshotRequest.current) return;
    if (response.status === 404) { onClose(); return; }
    if (!response.ok) throw new Error("Product details are temporarily unavailable");
    const data = await response.json();
    if (request !== snapshotRequest.current || !data.product) return;
    const mapped = mapProduct(data.product);
    setProduct(current => latestProductSnapshot(current, mapped));
    onProductChange(mapped);
  }

  async function loadRecommendations() {
    const request = ++recommendationRequest.current;
    setRecommendationsLoading(true);
    setRecommendationsError("");
    const params = new URLSearchParams({ limit: "10", ...destination });
    try {
      const response = await fetchWithTimeout(freshCatalogURL(`${API_URL}/api/v1/products/${initialProduct.id}/recommendations?${params}`), { headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error("Related products could not be loaded. Tap to retry.");
      const data = await response.json();
      if (request === recommendationRequest.current) setRecommendations((data?.products ?? []).map(mapProduct));
    } catch (error) {
      if (request === recommendationRequest.current) setRecommendationsError(error instanceof Error ? error.message : "Related products could not be loaded. Tap to retry.");
    } finally { if (request === recommendationRequest.current) setRecommendationsLoading(false); }
  }

  async function loadDetail(force = true) {
    if (reviewSaving.current) return;
    const request = ++reviewRequest.current;
    setLoading(true);
    setReviewLoadingMore(false);
    setReviewError("");
    setCanReview(false);
    setHasExistingReview(false);
    setReviewRating(5);
    setReviewText("");
    setReviewImages([]);
    const productTask = loadProductSnapshot(force);
    const reviewTask = (async () => {
      const rr = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/reviews?limit=25&fresh=${Date.now()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Cache-Control": "no-cache" }
      });
      if (!rr.ok) throw new Error("Reviews are temporarily unavailable");
      if (rr.ok) {
        const d = await rr.json();
        if (request !== reviewRequest.current) return;
        setReviews(d.reviews ?? []);
        setSummary(d.summary ?? { count: 0, average_rating: 0 });
        setReviewCursor(d.page?.next_cursor ?? "");
        setReviewHasMore(Boolean(d.page?.has_more));
      }
    })().catch(error => {
      if (request !== reviewRequest.current) return;
      setReviewError(error instanceof Error ? error.message : "Reviews are temporarily unavailable");
    }).finally(() => { if (request === reviewRequest.current) setLoading(false); });
    const recommendationTask = loadRecommendations();
    const myReviewTask = (async () => {
      if (token) {
        const mr = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/reviews/mine?fresh=${Date.now()}`, { headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" } });
        if (mr.ok) {
          const d = await mr.json();
          if (request !== reviewRequest.current) return;
          setCanReview(Boolean(d.can_review));
          setHasExistingReview(Boolean(d.review));
          if (d.review) {
            setReviewRating(d.review.rating);
            setReviewText(d.review.review_text ?? "");
            setReviewImages(d.review.media_urls ?? []);
          }
        }
      }
    })();
    await Promise.allSettled([productTask, reviewTask, recommendationTask, myReviewTask]);
  }

  async function loadMoreReviews() {
    if (!reviewHasMore || !reviewCursor || reviewLoadingMore) return;
    const request = reviewRequest.current;
    setReviewLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "25", cursor: reviewCursor });
      params.set("fresh", String(Date.now()));
      const response = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/reviews?${params.toString()}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error("Could not load more reviews");
      const data = await response.json();
      if (request !== reviewRequest.current) return;
      const incoming: Review[] = data.reviews ?? [];
      setReviews(current => {
        const known = new Set(current.map(review => review.id));
        return [...current, ...incoming.filter(review => !known.has(review.id))];
      });
      setReviewCursor(data.page?.next_cursor ?? "");
      setReviewHasMore(Boolean(data.page?.has_more));
    } catch (error) {
      if (request !== reviewRequest.current) return;
      Alert.alert("Reviews", error instanceof Error ? error.message : "Please try again");
    } finally {
      if (request === reviewRequest.current) setReviewLoadingMore(false);
    }
  }

  async function pickReviewImage() {
    if (!token || reviewImages.length >= 4) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    setReviewBusy(true);
    try {
      const asset = res.assets[0];
      const url = await uploadReviewImage(token, asset.uri, asset.mimeType || "image/jpeg", asset.fileName || "review.jpg");
      setReviewImages(items => [...items, url]);
    } catch (e) { Alert.alert("Upload failed", e instanceof Error ? e.message : ""); } finally { setReviewBusy(false); }
  }

  async function saveReview() {
    if (!token || reviewSaving.current) return;
    reviewSaving.current = true;
    const request = ++reviewRequest.current;
    const wasUpdating = hasExistingReview;
    setLoading(false);
    setReviewBusy(true);
    try {
      const d = await saveProductReview(product.id, token, { rating: reviewRating, review_text: reviewText, media_urls: reviewImages });
      if (request !== reviewRequest.current) return;
      if (d.review) {
        setReviews(current => [d.review, ...current.filter(item => item.id !== d.review.id)]);
      }
      if (d.summary) {
        setSummary(d.summary);
        setProduct(current => ({ ...current, review_count: Number(d.summary.count || 0), average_rating: Number(d.summary.average_rating || 0) }));
      }
      setReviewError("");
      setCanReview(true);
      setHasExistingReview(true);
      Alert.alert(
        wasUpdating ? "Review updated" : "Review published",
        d.review_reward_claimed ? "Thanks! You earned 10 XP. Use it against Atlantic Express service fees on eligible NGN product orders; seller prices, delivery and gateway charges remain payable." : wasUpdating ? "Your changes are now live." : "Your verified review is now live."
      );
    } catch (e) { if (request === reviewRequest.current) Alert.alert("Review confirmation", e instanceof Error ? e.message : ""); } finally { reviewSaving.current = false; if (request === reviewRequest.current) setReviewBusy(false); }
  }

  const images = product.image_urls?.length ? product.image_urls : [FALLBACK_IMAGES[0]];

  function revealReviewEditor() {
    sectionJump.current = false;
    setTimeout(() => {
      const node = findNodeHandle(reviewInputRef.current);
      if (node) detailScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(node, 120, true);
    }, Platform.OS === "android" ? 320 : 180);
  }

  function scrollToSection(section: keyof typeof sectionOffsets.current) {
    sectionJump.current = true;
    setActiveSection(section);
    detailScrollRef.current?.scrollTo({ y: section === "overview" ? 0 : Math.max(0, sectionOffsets.current.overview + sectionOffsets.current[section]), animated: false });
  }

  if(sellerChat && token)return <View style={[styles.detailOverlay,{paddingTop:insets.top}]}><ProductSellerChat key={`${token}:${product.id}`} product={product} token={token} onClose={()=>setSellerChat(false)}/></View>;
  const allowsCheckout=product.payment_mode!=="contact",allowsContact=product.payment_mode==="contact" || product.payment_mode==="both";
  return (
    <View style={[styles.detailOverlay, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.detailSafe} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.detailHeader}>
          <Pressable style={styles.detailBackButton} accessibilityLabel="Back to products" onPress={onClose}><Ionicons name="chevron-back" size={23} color={theme.color("#191919")} /></Pressable>
          <View style={styles.sectionTabs}>
            {(["overview", "reviews", "recommended"] as const).map(section=><Pressable key={section} accessibilityRole="tab" accessibilityState={{selected:activeSection===section}} style={styles.sectionTab} onPress={()=>scrollToSection(section)}><Text maxFontSizeMultiplier={1.2} style={[styles.sectionTabText,activeSection===section && styles.sectionTabActive]}>{section === "overview" ? "Overview" : section === "reviews" ? "Reviews" : "Recommended"}</Text>{activeSection===section && <View style={styles.sectionUnderline}/>}</Pressable>)}
          </View>
          <Pressable style={styles.detailBackButton} accessibilityLabel="Share product" onPress={()=>void Share.share({message:`${product.title} — ${money(product.flash_sale_price || product.price,product.currency)}. Find it in Atlantic Express: https://atlxpres.com`}).catch(()=>{})}><Ionicons name="share-outline" size={21} color={theme.color("#191919")} /></Pressable>
        </View>
        <ScrollView ref={detailScrollRef} scrollEventThrottle={100} onScrollBeginDrag={()=>{sectionJump.current=false;}} onScroll={event=>{if(sectionJump.current)return;const y=event.nativeEvent.contentOffset.y+48-sectionOffsets.current.overview;const section=y>=sectionOffsets.current.recommended && sectionOffsets.current.recommended>0 ? "recommended" : y>=sectionOffsets.current.reviews && sectionOffsets.current.reviews>0 ? "reviews" : "overview";setActiveSection(section);}} contentContainerStyle={[styles.detailScroll, { paddingBottom: keyboardVisible ? 180 : actionBarHeight + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadDetail(true); }} tintColor="#FF4747" />}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={[styles.detailGallery,{height:windowWidth}]}
            onMomentumScrollEnd={event => setHeroIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth))}
          >
            {images.map((uri, index) => (
              <Pressable key={`${uri}-${index}`} onPress={() => { setGalleryIndex(index); setGalleryPhotos(null); setGalleryOpen(true); }} accessibilityLabel={`Open product image ${index + 1} of ${images.length}`}>
                <ResilientImage uri={uri} style={[styles.detailImage, { width: windowWidth, height:windowWidth }]} resizeMode="contain" />
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.galleryCount,{top:windowWidth-40}]}><Text style={styles.galleryCountText}>{Math.min(heroIndex,images.length-1) + 1}/{images.length}</Text></View>
          <View style={styles.detailBody} onLayout={event => { sectionOffsets.current.overview = event.nativeEvent.layout.y; }}>
            {product.is_flash_sale && <View style={styles.flashTag}><Text style={styles.flashTagText}>FLASH SALE</Text></View>}
            <Text style={styles.productHub}>{isLocalMerchantProduct ? "Available locally from seller" : isCrossBorderMerchantProduct ? "International seller" : "Seller fulfilment unavailable"}</Text>
            <Text style={styles.detailTitle}>{product.title}</Text>
            <View style={styles.productSocialRow}><Text style={styles.productSocialText}>{Number(product.sold_count || 0).toLocaleString()} sold</Text><Pressable accessibilityLabel="Read customer reviews" onPress={()=>scrollToSection("reviews")} style={styles.productRating}><Text style={styles.productSocialText}>{product.review_count>0 ? product.average_rating.toFixed(1) : "New"}</Text><ReviewStars rating={product.average_rating} size={13}/><Text style={styles.productSocialText}>({product.review_count})</Text></Pressable></View>
            <View style={styles.detailPriceRow}>
              <Text style={styles.detailPrice}>{money(product.flash_sale_price || product.price, product.currency)}</Text>
              {!!product.compare_at_price && product.compare_at_price > (product.flash_sale_price || product.price) && <Text style={styles.detailComparePrice}>{money(product.compare_at_price, product.currency)}</Text>}
            </View>
            {!!product.delivery_fee && <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Price breakdown</Text><Text style={styles.detailMetaValue}>{money((product.flash_sale_price || product.price) - product.delivery_fee, product.currency)} product + {money(product.delivery_fee, product.currency)} delivery</Text></View>}
            <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Ships from</Text><Text style={styles.detailMetaValue}>{originLabel}</Text></View>
            {deliveryAreaLabel ? <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Delivers to</Text><Text style={styles.detailMetaValue}>{deliveryAreaLabel}</Text></View> : null}
            <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Stock</Text><Text style={styles.detailMetaValue}>{outOfStock ? "Out" : `${product.inventory_count} units`}</Text></View>


            {!!product.inventory_location && (
              <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Dispatch location</Text><Text style={styles.detailMetaValue}>{product.inventory_location}</Text></View>
            )}
            {!!product.delivery_max_days && (
              <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Delivery estimate</Text><Text style={styles.detailMetaValue}>{product.delivery_min_days || 0}-{product.delivery_max_days} days after processing</Text></View>
            )}
            <View style={styles.detailDescriptionBlock}>
              <Text style={styles.detailSectionTitle}>How to buy</Text>
              {allowsCheckout && <Text style={styles.detailDescription}>Pay securely through Flutterwave. Choose card or bank transfer at checkout where available. Your payment is confirmed first; the seller&apos;s bank payout usually takes one business day for local payments or five business days for international payments, and can take longer. This payout timing is separate from delivery.</Text>}
              {allowsContact && <><Text style={styles.detailDescription}>Message the seller to agree payment and delivery. Payments arranged directly are outside Atlantic Express checkout and will not appear as paid orders in Track.</Text><Pressable style={styles.photoExpand} onPress={contactSeller}><Text style={styles.secondaryButtonText}>Message seller</Text></Pressable></>}
            </View>
            <View style={styles.detailDescriptionBlock} onLayout={event => { sectionOffsets.current.reviews = event.nativeEvent.layout.y; }}>
              <Text style={styles.detailSectionTitle}>Reviews</Text>
              <View style={styles.reviewSummaryRow}>
                <Text style={styles.reviewSummaryScore}>{summary.count>0 ? summary.average_rating.toFixed(1) : "—"}</Text>
                <ReviewStars rating={summary.average_rating} size={18}/>
                <Text style={styles.reviewSummaryText}>({summary.count.toLocaleString()})</Text>
              </View>
              {summary.count>0 && <View style={styles.verifiedBanner}><Ionicons name="shield-checkmark" size={17} color={theme.color("#12805F")}/><Text style={styles.verifiedBannerText}>Reviews from verified purchases</Text></View>}
              {loading ? <ActivityIndicator color={theme.color("#FF4747")} style={{marginTop:12}}/> : reviews.map(r=><View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewCardHead}><View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{(r.author || "Buyer").trim().charAt(0).toUpperCase()}</Text></View><Text style={styles.reviewAuthor}>{r.is_mine ? "Your review" : r.author}</Text><Text style={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</Text></View>
                <View style={styles.reviewRatingLine}><ReviewStars rating={r.rating} size={15}/><Text style={styles.verifiedText}>Verified purchase</Text></View>
                {!!r.review_text && <Text style={styles.reviewText}>{r.review_text}</Text>}
                {!!r.media_urls?.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewMediaRow}>{r.media_urls.map((uri,index)=><Pressable key={`${r.id}-${index}`} accessibilityLabel={`View review photo ${index+1}`} onPress={()=>{setGalleryPhotos(r.media_urls);setGalleryIndex(index);setGalleryOpen(true);}}><ResilientImage uri={uri} style={styles.reviewMedia} resizeMode="cover"/></Pressable>)}</ScrollView>}
                <Pressable accessibilityLabel="Share this review" style={styles.reviewShare} onPress={()=>void Share.share({message:`${r.author} rated ${product.title} ${r.rating}/5 on Atlantic Express. ${r.review_text}\nhttps://atlxpres.com`}).catch(()=>{})}><Ionicons name="share-outline" size={15} color={theme.color("#595959")}/><Text style={styles.reviewShareText}>Share</Text></Pressable>
              </View>)}
              {!loading && !reviewError && reviews.length===0 && <Text style={styles.reviewText}>No reviews yet. Verified buyers can share their experience after delivery.</Text>}
              {!loading && !!reviewError && <Text style={styles.reviewError}>{reviewError}</Text>}
              {reviewHasMore && <Pressable style={[styles.reviewMoreButton, reviewLoadingMore && styles.disabled]} disabled={reviewLoadingMore} onPress={loadMoreReviews}><Text style={styles.secondaryButtonText}>{reviewLoadingMore ? "Loading..." : "Load more reviews"}</Text></Pressable>}
            </View>
            {canReview && (
              <View style={styles.reviewForm}>
                <Text style={styles.detailSectionTitle}>{hasExistingReview ? "Update your review" : "Your review"}</Text>
                <Text style={styles.muted}>{hasExistingReview ? "Revise your rating, comment, or photos whenever your experience changes." : "Earn 10 XP for your first verified review after delivery. Use XP only against Atlantic Express service fees on eligible NGN product orders."}</Text>
                <View style={styles.starRow}><ReviewStars rating={reviewRating} size={32} disabled={reviewBusy} onChange={setReviewRating} /></View>
                <TextInput ref={reviewInputRef} editable={!reviewBusy} style={styles.reviewInput} value={reviewText} onChangeText={setReviewText} onFocus={revealReviewEditor} placeholder="Share your experience" multiline textAlignVertical="top" />
                <View style={styles.reviewActionRow}><Pressable style={[styles.reviewSecondaryButton, reviewBusy && styles.disabled]} onPress={pickReviewImage} disabled={reviewBusy}><Text style={styles.secondaryButtonText}>Add photo</Text></Pressable><Pressable style={[styles.detailCartButton, reviewBusy && styles.disabled]} onPress={saveReview} disabled={reviewBusy}><Text style={styles.primaryButtonText}>{reviewBusy ? "Saving..." : hasExistingReview ? "Update review" : "Post review"}</Text></Pressable></View>
              </View>
            )}
            <View style={styles.productDetailsSection}>
              <Text style={styles.detailSectionTitle}>Product details</Text>
              {!!product.category_path?.length && <View style={styles.specRow}><Text style={styles.detailMetaLabel}>Category</Text><Text style={styles.specValue}>{product.category_path.join(" / ")}</Text></View>}
              <View style={styles.specRow}><Text style={styles.detailMetaLabel}>Product code</Text><Text style={styles.specValue}>{product.sku}</Text></View>
              {!!product.description && <Text style={styles.detailDescription}>{product.description}</Text>}
            </View>
            <View style={styles.productPhotoStack}>
              {(showAllPhotos ? images : images.slice(0,3)).map((uri,index)=><Pressable key={`description-${uri}-${index}`} accessibilityLabel={`View product photo ${index+1}`} onPress={()=>{setGalleryPhotos(null);setGalleryIndex(index);setGalleryOpen(true);}}><ProductPhoto uri={uri}/></Pressable>)}
              {images.length>3 && <Pressable style={styles.photoExpand} onPress={()=>setShowAllPhotos(value=>!value)}><Text style={styles.sectionTabText}>{showAllPhotos ? "Show fewer photos" : `See all ${images.length} photos`}</Text><Ionicons name={showAllPhotos ? "chevron-up" : "chevron-down"} size={16}/></Pressable>}
            </View>
            <View style={styles.recommendationSection} onLayout={event => { sectionOffsets.current.recommended = event.nativeEvent.layout.y; }}>
              <Text style={styles.detailSectionTitle}>Recommended for you</Text>
              <Text style={styles.recommendationHint}>Related products selected from the live catalogue.</Text>
              {!!recommendationsError && <Pressable onPress={()=>void loadRecommendations()}><Text style={styles.reviewError}>{recommendationsError}</Text></Pressable>}
              {recommendations.length === 0 ? recommendationsLoading ? <ActivityIndicator color={theme.color("#FF4747")} style={{padding:20}}/> : !recommendationsError && <Text style={styles.recommendationEmpty}>No related products available yet.</Text> : (
                <View style={styles.recommendationGrid}>
                  {recommendations.map(item=><View key={item.id} style={styles.recommendationCard}><ProductCard product={item} cartQuantity={getCartQuantity(item.sku)} onPress={()=>onSelectProduct(item)} onAdd={()=>onAdd(item)}/></View>)}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        {!keyboardVisible && <View onLayout={event => setActionBarHeight(event.nativeEvent.layout.height)} style={[styles.detailActions, { paddingBottom: bottomInset + 12 }]}>
          {allowsCheckout && <View style={styles.quantityRow}>
            <Pressable style={[styles.quantityButton, (cartQuantity === 0 || outOfStock) && styles.disabled]} onPress={() => onRemove(product)} disabled={cartQuantity === 0 || outOfStock}><Ionicons name="remove" size={20} color={theme.color("#101817")} /></Pressable>
            <Text style={styles.quantityValue}>{cartQuantity}</Text>
            <Pressable style={[styles.quantityButton, (outOfStock || atMax) && styles.disabled]} onPress={() => onAdd(product)} disabled={outOfStock || atMax}><Ionicons name="add" size={20} color={theme.color("#101817")} /></Pressable>
          </View>}
          {product.payment_mode==="both" && <Pressable accessibilityLabel="Message seller" onPress={contactSeller} style={{minHeight:44,minWidth:44,alignItems:"center",justifyContent:"center"}}><Ionicons name="chatbubble-outline" size={24} color={theme.color("#191919")}/></Pressable>}
          <Pressable style={[styles.detailCartButton,allowsCheckout && outOfStock && styles.disabled]} onPress={()=>{if(!allowsCheckout){contactSeller();return;}if(outOfStock)return;if(cartQuantity===0)onAdd(product);else onClose();}} disabled={allowsCheckout && outOfStock}><Text style={styles.primaryButtonText}>{!allowsCheckout ? "Message seller" : outOfStock ? "Out of stock" : cartQuantity>0 ? "Added · Keep shopping" : "Add to cart"}</Text></Pressable>
        </View>}
      </KeyboardAvoidingView>
      <Modal visible={galleryOpen} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => setGalleryOpen(false)}>
        <View style={[styles.galleryModal, { paddingTop: insets.top, paddingBottom: bottomInset }]}>
          <View style={styles.galleryModalHeader}>
            <Pressable style={styles.galleryClose} onPress={() => setGalleryOpen(false)} accessibilityLabel="Close image gallery"><Ionicons name="close" size={26} color={theme.color("#FFFFFF")} /></Pressable>
            <Text style={styles.galleryModalCount}>{galleryIndex + 1}/{(galleryPhotos || images).length}</Text>
            <View style={styles.galleryHeaderSpacer} />
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * windowWidth, y: 0 }}
            onMomentumScrollEnd={event => setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth))}
          >
            {(galleryPhotos || images).map((uri, index) => <ResilientImage key={`full-${uri}-${index}`} uri={uri} style={{ width: windowWidth, height: Math.max(320, windowHeight - insets.top - bottomInset - 132) }} resizeMode="contain" />)}
          </ScrollView>
          <Pressable style={styles.galleryAddButton} onPress={() => { setGalleryOpen(false); if(!allowsCheckout){contactSeller();return;} if (cartQuantity === 0 && !outOfStock) onAdd(product); }} disabled={allowsCheckout && outOfStock}>
            <Text style={styles.primaryButtonText}>{!allowsCheckout ? "Message seller" : outOfStock ? "Out of stock" : cartQuantity > 0 ? "Already in cart" : "Add to cart"}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function ProductPhoto({uri}:{uri:string}) {
  const theme = useTheme();
  const [ratio,setRatio]=useState(1);
  return <ResilientImage uri={uri} resizeMode="contain" style={{width:"100%",aspectRatio:ratio,backgroundColor: theme.color("#F7F7F7", "backgroundColor")}} onLoad={event=>{const {width,height}=event.nativeEvent.source;if(width>0 && height>0)setRatio(width/height);}}/>;
}

const baseStyles = StyleSheet.create({
  sectionTabActive:{color:"#191919",fontWeight:"800"},
  sectionUnderline:{position:"absolute",bottom:3,height:3,width:22,borderRadius:2,backgroundColor:"#191919"},
  productSocialRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6,marginTop:8},
  productSocialText:{fontSize:11,color:"#595959"},
  productRating:{flexDirection:"row",alignItems:"center",gap:4,minHeight:28},
  verifiedBanner:{marginTop:8,backgroundColor:"#F0F8F1",borderRadius:4,padding:8,flexDirection:"row",alignItems:"center",gap:6},
  verifiedBannerText:{fontSize:12,color:"#315B3B"},
  reviewAvatar:{width:28,height:28,borderRadius:14,backgroundColor:"#EAF1ED",alignItems:"center",justifyContent:"center"},
  reviewAvatarText:{fontSize:12,fontWeight:"700",color:"#315B3B"},
  reviewDate:{fontSize:11,color:"#888"},
  reviewRatingLine:{flexDirection:"row",alignItems:"center",gap:8,marginTop:5},
  reviewShare:{flexDirection:"row",alignItems:"center",gap:4,alignSelf:"flex-start",minHeight:32,marginTop:6},
  reviewShareText:{fontSize:11,color:"#595959"},
  specRow:{flexDirection:"row",alignItems:"flex-start",gap:12,marginTop:8},
  specValue:{flex:1,fontSize:12,lineHeight:18,color:"#191919"},
  productPhotoStack:{marginHorizontal:-12,gap:4},
  photoExpand:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6},

  detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF", zIndex: 20 },
  detailSafe: { flex: 1 },
  detailHeader: {height:48,flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",borderBottomWidth:1,borderColor:"#EEE"},
  detailBackButton: {width:40,height:44,alignItems:"center",justifyContent:"center"},
  detailHeaderTitle: { color: "#101817", fontSize: 16, fontWeight: "900" },
  detailHeaderSpacer: { width: 42 },
  sectionTabs: {flex:1,flexDirection:"row",alignItems:"center"},
  sectionTab: {flex:1,minWidth:0,height:44,alignItems:"center",justifyContent:"center"},
  sectionTabText: {color:"#595959",fontSize:12,fontWeight:"600"},
  detailScroll: { paddingBottom: 140 },
  detailGallery: { height: 320, backgroundColor: "#E8EFEC" },
  detailImage: { width: 360, height: 320, backgroundColor: "#E8EFEC" },
  galleryCount: { position: "absolute", top: 280, right: 14, minWidth: 48, height: 28, paddingHorizontal: 10, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)" },
  galleryCountText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  detailBody: {paddingHorizontal:12,paddingTop:12,paddingBottom:0},
  detailTitle: {color:"#191919",fontSize:15,fontWeight:"600",lineHeight:21,marginTop:4},
  detailSku: { marginTop: 6, color: "#66736F", fontSize: 12, fontWeight: "800" },
  detailPriceRow: {marginTop:8,flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},
  detailPrice: {color:"#191919",fontSize:22,fontWeight:"800"},
  detailComparePrice: {color:"#888",fontSize:13,fontWeight:"600",textDecorationLine:"line-through"},
  detailMetaRow: {marginTop:8,flexDirection:"row",justifyContent:"space-between",gap:12},
  detailMetaLabel: {color:"#66736F",fontSize:12,lineHeight:18,fontWeight:"500"},
  detailMetaValue: {flex:1,textAlign:"right",color:"#191919",fontSize:12,lineHeight:18,fontWeight:"600"},
  detailDescriptionBlock: {marginTop:14,paddingTop:14,borderTopWidth:6,borderColor:"#F5F5F5",marginHorizontal:-12,paddingHorizontal:12},
  productDetailsSection: {marginTop:14,paddingTop:14,borderTopWidth:6,borderColor:"#F5F5F5",marginHorizontal:-12,paddingHorizontal:12,paddingBottom:14},
  detailSectionTitle: {color:"#191919",fontSize:15,fontWeight:"700",lineHeight:21},
  detailDescription: {marginTop:10,color:"#333",fontSize:13,lineHeight:20},
  reviewSummaryRow: {marginTop:8,flexDirection:"row",alignItems:"center",gap:6},
  reviewSummaryScore: {color:"#191919",fontSize:21,fontWeight:"700"},
  reviewSummaryCopy: { flex: 1, gap: 3 },
  reviewSummaryText: {color:"#595959",fontSize:12},
  reviewError: { marginTop: 12, color: "#B42318", fontSize: 13, fontWeight: "700" },
  reviewCard: {paddingVertical:12,borderBottomWidth:1,borderColor:"#EEE",backgroundColor:"#FFF"},
  reviewCardHead: {flexDirection:"row",alignItems:"center",gap:6,flexWrap:"wrap"},
  reviewAuthor: {color:"#191919",fontSize:13,fontWeight:"600",flexShrink:1},
  ratingStars: { flexDirection: "row", alignItems: "center", gap: 2 },
  verifiedRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { color: "#12805F", fontSize: 11, fontWeight: "800" },
  reviewText: {marginTop:8,color:"#333",fontSize:13,lineHeight:20},
  reviewMediaRow: { gap: 8, paddingTop: 10, paddingRight: 4 },
  reviewMedia: { width: 88, height: 88, borderRadius: 8, backgroundColor: "#F0F0F0" },
  reviewForm: {marginTop:12,paddingTop:12,borderTopWidth:1,borderColor:"#EEE"},
  starRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  starPressable: { minWidth: 40, minHeight: 44, alignItems: "center", justifyContent: "center" },
  reviewInput: { minHeight: 96, marginTop: 12, borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF", color: "#191919", textAlignVertical: "top" },
  reviewActionRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  reviewSecondaryButton: { minHeight: 46, minWidth: 110, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F1", paddingHorizontal: 14 },
  reviewMoreButton: { alignSelf: "center", minHeight: 44, marginTop: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F1", paddingHorizontal: 18 },
  detailActions: {position:"absolute",left:0,right:0,bottom:0,paddingHorizontal:12,paddingTop:8,borderTopWidth:1,borderColor:"#EEE",backgroundColor:"#FFF",flexDirection:"row",alignItems:"center",gap:10},
  detailActionColumn: { flex: 1, gap: 10 },
  detailHintBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFF1F1", borderWidth: 1, borderColor: "#FFD0D0" },
  detailHintText: { flex: 1, color: "#FF4747", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  detailSuccessBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#EAF8F2", borderWidth: 1, borderColor: "#CBEBDD" },
  detailSuccessText: { flex: 1, color: "#12805F", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  flashTag: { backgroundColor: "#FF4747", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
  flashTagText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  productHub: { color: "#8C8C8C", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  muted: {marginTop:6,color:"#66736F",fontSize:12,lineHeight:18},
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButtonText: { color: "#FF4747", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  quantityRow: {flexDirection:"row",alignItems:"center",gap:4,borderWidth:1,borderColor:"#DDD",borderRadius:8},
  quantityButton: {width:34,height:40,alignItems:"center",justifyContent:"center"},
  quantityValue: {minWidth:18,textAlign:"center",fontSize:14,fontWeight:"700"},
  detailCartButton: {flex:1,minHeight:46,borderRadius:24,paddingHorizontal:12,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4747"},
  recommendationSection: {marginTop:12,paddingTop:12,borderTopWidth:6,borderColor:"#F5F5F5",marginHorizontal:-12,paddingHorizontal:4},
  recommendationHint: { marginTop: 5, color: "#8C8C8C", fontSize: 12, lineHeight: 18 },
  recommendationEmpty: { marginTop: 14, color: "#8C8C8C", fontSize: 13 },
  recommendationGrid: {marginTop:10,flexDirection:"row",flexWrap:"wrap",gap:4},
  recommendationCard: {width:"49%",overflow:"hidden",backgroundColor:"#FFF"},
  recommendationImage: { width: "100%", aspectRatio: 1, backgroundColor: "#F0F0F0" },
  recommendationTitle: { minHeight: 38, marginTop: 8, paddingHorizontal: 9, color: "#191919", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  recommendationPrice: { marginTop: 5, paddingHorizontal: 9, color: "#FF4747", fontSize: 14, fontWeight: "900" },
  galleryModal: { flex: 1, backgroundColor: "#000000" },
  galleryModalHeader: { height: 56, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  galleryClose: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  galleryModalCount: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  galleryHeaderSpacer: { width: 44 },
  galleryAddButton: { height: 54, marginHorizontal: 18, marginTop: 12, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#FF4747" },
});
