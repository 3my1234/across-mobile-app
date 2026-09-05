import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, Image, ImageBackground,
  findNodeHandle, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthMode, Product, Review, ReviewSummary } from "./types";
import { API_URL, LOGO, FALLBACK_IMAGES } from "./config";
import { money, uploadReviewImage, mapProduct, fetchWithTimeout } from "./utils";
import { s } from "./Styles";
import { ResilientImage } from "./ResilientImage";
import { COLORS } from "./theme";
import { ReviewStars } from "./ReviewStars";

// ---- Launch Screen ----
export function LaunchScreen({ label }: { label?: string }) {
  return (
    <SafeAreaView style={s.launch}>
      <Image source={LOGO} style={s.launchLogo} resizeMode="contain" />
      <ActivityIndicator size="small" color="#12805F" />
      <Text style={s.loadingText}>{label || "Checking your session"}</Text>
    </SafeAreaView>
  );
}

// ---- Missing Config Screen ----
export function MissingConfigScreen() {
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

export function AuthScreen({ mode, busy, googleReady, googleTimedOut, googleBusy, noticeText, onModeChange, onSubmit, onResend, onForgotPassword, onGoogle }: AuthProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const authScrollRef = useRef<ScrollView | null>(null);
  const isWelcome = mode === "welcome";
  const title = mode === "signin" ? "Welcome back" : "Create your Atlantic Express account";

  async function submit() {
    if (mode === "signin") await onSubmit("/api/v1/auth/login", { email, password });
    else if (mode === "signup") await onSubmit("/api/v1/auth/signup", { full_name: fullName, email, phone, password });
  }

  function revealAuthForm(target: number) {
    setTimeout(() => authScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 96, true), Platform.OS === "android" ? 320 : 180);
  }

  return (
    <ImageBackground source={LOGO} resizeMode="contain" style={s.authBg} imageStyle={s.authBgImage}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.authSafe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.authKeyboard}>
          <ScrollView ref={authScrollRef} contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets>
            <Image source={LOGO} style={s.authLogo} resizeMode="contain" />
            {isWelcome ? (
              <View style={s.authPanel}>
                <Text style={s.authTitle}>Shop China. Pay in Naira. Track to your door.</Text>
                <Text style={s.authCopy}>Sign in to access your cart, secure payments, saved details, and delivery tracking.</Text>
                {!!noticeText && (
                  <View style={s.authNotice}>
                    <Ionicons name="alert-circle-outline" size={16} color="#B54708" />
                    <Text style={s.authNoticeText}>{noticeText}</Text>
                  </View>
                )}
                <Pressable style={s.primaryButton} onPress={() => onModeChange("signup")}><Text style={s.primaryButtonText}>Create Account</Text></Pressable>
                <Pressable
                  style={[s.gmailButton, googleBusy && s.disabled]}
                  onPress={onGoogle}
                  disabled={googleBusy}
                  accessibilityLabel={googleReady ? "Sign in with Google" : googleTimedOut ? "Retry Google sign-in" : "Google sign-in is loading"}
                  accessibilityState={{ disabled: googleBusy, busy: (!googleReady && !googleTimedOut) || googleBusy }}
                >
                  {(!googleReady && !googleTimedOut) || googleBusy ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name={googleReady ? "logo-google" : "refresh"} size={18} color="#101817" />}
                  <Text style={s.gmailButtonText}>{googleBusy ? "Opening Google…" : googleReady ? "Sign in with Google" : googleTimedOut ? "Retry Google sign-in" : "Connecting Google sign-in…"}</Text>
                </Pressable>
                {!googleReady && googleTimedOut && <Text style={s.authCopy}>Google took longer than expected. Check your connection, retry, or use email sign-in.</Text>}
                <Pressable style={s.textButton} onPress={() => onModeChange("signin")}><Text style={s.textButtonText}>I have an account</Text></Pressable>
              </View>
            ) : (
              <View style={s.authPanel}>
                <Text style={s.authTitle}>{title}</Text>
                {mode !== "signin" && <TextInput value={fullName} onChangeText={setFullName} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Full name" autoCapitalize="words" style={s.input} />}
                <TextInput value={email} onChangeText={setEmail} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={s.input} />
                {mode === "signup" && <TextInput value={phone} onChangeText={setPhone} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Phone" keyboardType="phone-pad" style={s.input} />}
                <View style={s.passwordWrap}><TextInput value={password} onChangeText={setPassword} onFocus={event => revealAuthForm(event.nativeEvent.target)} placeholder="Password" secureTextEntry={!showPassword} style={s.passwordInput} /><Pressable style={s.passwordToggle} onPress={() => setShowPassword(v => !v)}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#30423D" /></Pressable></View>
                <Pressable style={[s.primaryButton, busy && s.disabled]} disabled={busy} onPress={submit}><Text style={s.primaryButtonText}>{busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Continue"}</Text></Pressable>
                {mode === "signin" && <Pressable style={s.textButton} disabled={busy} onPress={() => onForgotPassword(email)}><Text style={s.textButtonText}>Forgot password?</Text></Pressable>}
                {mode === "signin" && <Pressable style={s.textButton} disabled={busy} onPress={() => onResend(email)}><Text style={s.textButtonText}>Resend verification email</Text></Pressable>}
                <Pressable style={s.textButton} onPress={() => onModeChange("welcome")}><Text style={s.textButtonText}>Back</Text></Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ---- Product Detail Screen ----
interface DetailProps {
  product: Product;
  token: string | null;
  cartQuantity: number;
  onClose: () => void;
  onAdd: (product: Product) => void;
  onRemove: (product: Product) => void;
  onProductChange: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
}

export function ProductDetailScreen({ product: initialProduct, token, cartQuantity, onClose, onAdd, onRemove, onProductChange, onSelectProduct }: DetailProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);
  const windowWidth = Dimensions.get("window").width;
  const windowHeight = Dimensions.get("window").height;
  const [product, setProduct] = useState(initialProduct);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCursor, setReviewCursor] = useState("");
  const [reviewHasMore, setReviewHasMore] = useState(false);
  const [reviewLoadingMore, setReviewLoadingMore] = useState(false);
  const [summary, setSummary] = useState<ReviewSummary>({ count: 0, average_rating: 0 });
  const [canReview, setCanReview] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewError, setReviewError] = useState("");
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [actionBarHeight, setActionBarHeight] = useState(120);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const detailScrollRef = useRef<ScrollView | null>(null);
  const reviewInputRef = useRef<TextInput | null>(null);
  const sectionOffsets = useRef({ overview: 0, reviews: 0, recommended: 0 });
  const pulse = useRef(new Animated.Value(0)).current;
  const outOfStock = product.inventory_count <= 0;
  const atMax = cartQuantity >= product.inventory_count;

  useEffect(() => {
    setProduct(initialProduct);
    setGalleryIndex(0);
    setGalleryOpen(false);
    loadDetail();
    // The product id and session token are the intentional request keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct.id, token]);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (cartQuantity > 0 || outOfStock) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })
    ]));
    anim.start(); return () => anim.stop();
  }, [outOfStock, pulse, cartQuantity]);

  async function loadDetail(force = false) {
    setLoading(true);
    setReviewError("");
    setCanReview(false);
    setHasExistingReview(false);
    setReviewRating(5);
    setReviewText("");
    setReviewImages([]);
    const productTask = (async () => {
      const fresh = force ? `?fresh=${Date.now()}` : "";
      const pr = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}${fresh}`, { headers: force ? { "Cache-Control": "no-cache" } : undefined });
      if (pr.ok) { const d = await pr.json(); if (d.product) { const mapped = mapProduct(d.product); setProduct(mapped); onProductChange(mapped); } }
    })();
    const reviewTask = (async () => {
      const rr = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/reviews?limit=25&fresh=${Date.now()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Cache-Control": "no-cache" }
      });
      if (!rr.ok) throw new Error("Reviews are temporarily unavailable");
      if (rr.ok) {
        const d = await rr.json();
        setReviews(d.reviews ?? []);
        setSummary(d.summary ?? { count: 0, average_rating: 0 });
        setReviewCursor(d.page?.next_cursor ?? "");
        setReviewHasMore(Boolean(d.page?.has_more));
      }
    })().catch(error => {
      setReviewError(error instanceof Error ? error.message : "Reviews are temporarily unavailable");
    }).finally(() => setLoading(false));
    const recommendationTask = (async () => {
      const rec = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/recommendations?limit=10`);
      if (rec.ok) {
        const d = await rec.json();
        setRecommendations((d.products ?? []).map(mapProduct));
      } else {
        setRecommendations([]);
      }
    })();
    const myReviewTask = (async () => {
      if (token) {
        const mr = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/reviews/mine?fresh=${Date.now()}`, { headers: { Authorization: `Bearer ${token}`, "Cache-Control": "no-cache" } });
        if (mr.ok) {
          const d = await mr.json();
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
    setReviewLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "25", cursor: reviewCursor });
      params.set("fresh", String(Date.now()));
      const response = await fetchWithTimeout(`${API_URL}/api/v1/products/${initialProduct.id}/reviews?${params.toString()}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Cache-Control": "no-cache" } });
      if (!response.ok) throw new Error("Could not load more reviews");
      const data = await response.json();
      const incoming: Review[] = data.reviews ?? [];
      setReviews(current => {
        const known = new Set(current.map(review => review.id));
        return [...current, ...incoming.filter(review => !known.has(review.id))];
      });
      setReviewCursor(data.page?.next_cursor ?? "");
      setReviewHasMore(Boolean(data.page?.has_more));
    } catch (error) {
      Alert.alert("Reviews", error instanceof Error ? error.message : "Please try again");
    } finally {
      setReviewLoadingMore(false);
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
    if (!token) return;
    const wasUpdating = hasExistingReview;
    setReviewBusy(true);
    try {
      const r = await fetchWithTimeout(`${API_URL}/api/v1/products/${product.id}/reviews`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ rating: reviewRating, review_text: reviewText, media_urls: reviewImages }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Could not save");
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
        d.review_reward_claimed ? "Thanks! You earned ₦500 off your next order!" : wasUpdating ? "Your changes are now live." : "Your verified review is now live."
      );
    } catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : ""); } finally { setReviewBusy(false); }
  }

  const images = product.image_urls?.length ? product.image_urls : [FALLBACK_IMAGES[0]];

  function revealReviewEditor() {
    setTimeout(() => {
      const node = findNodeHandle(reviewInputRef.current);
      if (node) detailScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(node, 120, true);
    }, Platform.OS === "android" ? 320 : 180);
  }

  function scrollToSection(section: keyof typeof sectionOffsets.current) {
    detailScrollRef.current?.scrollTo({ y: Math.max(0, sectionOffsets.current[section] - 54), animated: true });
  }

  return (
    <View style={[styles.detailOverlay, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={styles.detailSafe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.detailHeader}>
          <Pressable style={styles.detailBackButton} onPress={onClose}><Ionicons name="arrow-back" size={22} color="#101817" /></Pressable>
          <Text style={styles.detailHeaderTitle}>Product details</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>
        <View style={styles.sectionTabs}>
          <Pressable style={styles.sectionTab} onPress={() => scrollToSection("overview")}><Text style={styles.sectionTabText}>Overview</Text></Pressable>
          <Pressable style={styles.sectionTab} onPress={() => scrollToSection("reviews")}><Text style={styles.sectionTabText}>Reviews</Text></Pressable>
          <Pressable style={styles.sectionTab} onPress={() => scrollToSection("recommended")}><Text style={styles.sectionTabText}>Recommended</Text></Pressable>
        </View>
        <ScrollView ref={detailScrollRef} contentContainerStyle={[styles.detailScroll, { paddingBottom: keyboardVisible ? 180 : actionBarHeight + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadDetail(true); }} tintColor="#FF4747" />}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.detailGallery}
            onMomentumScrollEnd={event => setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth))}
          >
            {images.map((uri, index) => (
              <Pressable key={`${uri}-${index}`} onPress={() => { setGalleryIndex(index); setGalleryOpen(true); }} accessibilityLabel={`Open product image ${index + 1} of ${images.length}`}>
                <ResilientImage uri={uri} style={[styles.detailImage, { width: windowWidth }]} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.galleryCount}><Text style={styles.galleryCountText}>{galleryIndex + 1}/{images.length}</Text></View>
          <View style={styles.detailBody} onLayout={event => { sectionOffsets.current.overview = event.nativeEvent.layout.y; }}>
            {product.is_flash_sale && <View style={styles.flashTag}><Text style={styles.flashTagText}>FLASH SALE</Text></View>}
            <Text style={styles.productHub}>{product.category_path?.[0] || product.origin_hub.city || "China"} hub</Text>
            <Text style={styles.detailTitle}>{product.title}</Text>
            <Text style={styles.detailSku}>SKU {product.sku}</Text>
            <View style={styles.detailPriceRow}>
              <Text style={styles.detailPrice}>{money(product.flash_sale_price || product.price)}</Text>
              {!!product.compare_at_price && product.compare_at_price > (product.flash_sale_price || product.price) && <Text style={[styles.detailComparePrice, product.is_flash_sale && styles.detailFlashComparePrice]}>{money(product.compare_at_price)}</Text>}
            </View>
            <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Origin</Text><Text style={styles.detailMetaValue}>{product.origin_hub.name || product.origin_hub.city || "China"}</Text></View>
            <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Stock</Text><Text style={styles.detailMetaValue}>{outOfStock ? "Out" : `${product.inventory_count} units`}</Text></View>
            <View style={styles.detailMetaRow}>
              <Text style={styles.detailMetaLabel}>Fulfilment</Text>
              <Text style={styles.detailMetaValue}>{product.fulfillment_mode === "merchant_local" ? "Local merchant delivery" : product.fulfillment_mode === "merchant_cross_border" ? "International merchant delivery" : "Atlantic Express import"}</Text>
            </View>
            {!!(product.inventory_location || product.inventory_city || product.inventory_country_code) && (
              <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Ships from</Text><Text style={styles.detailMetaValue}>{[product.inventory_location, product.inventory_city, product.inventory_country_code].filter(Boolean).join(", ")}</Text></View>
            )}
            {!!product.delivery_max_days && (
              <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Delivery estimate</Text><Text style={styles.detailMetaValue}>{product.delivery_min_days || 0}-{product.delivery_max_days} days after processing</Text></View>
            )}
            <View style={styles.detailDescriptionBlock} onLayout={event => { sectionOffsets.current.reviews = event.nativeEvent.layout.y + sectionOffsets.current.overview; }}>
              <Text style={styles.detailSectionTitle}>Reviews</Text>
              <View style={styles.reviewSummaryRow}>
                <Text style={styles.reviewSummaryScore}>{summary.count > 0 ? summary.average_rating.toFixed(1) : "—"}</Text>
                <View style={styles.reviewSummaryCopy}>
                  {summary.count > 0 && <ReviewStars rating={summary.average_rating} size={18} />}
                  <Text style={styles.reviewSummaryText}>{summary.count > 0 ? `${summary.count} verified review${summary.count === 1 ? "" : "s"}` : "No reviews yet"}</Text>
                </View>
              </View>
              {loading ? <ActivityIndicator color="#FF4747" style={{ marginTop: 12 }} /> : reviews.map(r => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewCardHead}><Text style={styles.reviewAuthor}>{r.is_mine ? "Your review" : r.author}</Text><ReviewStars rating={r.rating} size={15} /></View>
                  <View style={styles.verifiedRow}><Ionicons name="shield-checkmark" size={14} color="#12805F" /><Text style={styles.verifiedText}>Verified purchase</Text></View>
                  {!!r.review_text && <Text style={styles.reviewText}>{r.review_text}</Text>}
                  {!!r.media_urls?.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewMediaRow}>{r.media_urls.map((uri, index) => <ResilientImage key={`${r.id}-${index}`} uri={uri} style={styles.reviewMedia} resizeMode="cover" />)}</ScrollView>}
                </View>
              ))}
              {!loading && !!reviewError && <Text style={styles.reviewError}>{reviewError}</Text>}
              {reviewHasMore && <Pressable style={[styles.reviewMoreButton, reviewLoadingMore && styles.disabled]} disabled={reviewLoadingMore} onPress={loadMoreReviews}><Text style={styles.secondaryButtonText}>{reviewLoadingMore ? "Loading..." : "Load more reviews"}</Text></Pressable>}
            </View>
            {canReview && (
              <View style={styles.reviewForm}>
                <Text style={styles.detailSectionTitle}>{hasExistingReview ? "Update your review" : "Your review"}</Text>
                <Text style={styles.muted}>{hasExistingReview ? "Revise your rating, comment, or photos whenever your experience changes." : "Earn ₦500 off next order! Leave a review after delivery."}</Text>
                <View style={styles.starRow}><ReviewStars rating={reviewRating} size={32} onChange={setReviewRating} /></View>
                <TextInput ref={reviewInputRef} style={styles.reviewInput} value={reviewText} onChangeText={setReviewText} onFocus={revealReviewEditor} placeholder="Share your experience" multiline textAlignVertical="top" />
                <View style={styles.reviewActionRow}><Pressable style={[styles.reviewSecondaryButton, reviewBusy && styles.disabled]} onPress={pickReviewImage} disabled={reviewBusy}><Text style={styles.secondaryButtonText}>Add photo</Text></Pressable><Pressable style={[styles.detailCartButton, reviewBusy && styles.disabled]} onPress={saveReview} disabled={reviewBusy}><Text style={styles.primaryButtonText}>{reviewBusy ? "Saving..." : hasExistingReview ? "Update review" : "Post review"}</Text></Pressable></View>
              </View>
            )}
            {!!product.description && (
              <View style={styles.productDetailsSection}>
                <Text style={styles.detailSectionTitle}>Product details</Text>
                <Text style={styles.detailDescription}>{product.description}</Text>
              </View>
            )}
            <View style={styles.recommendationSection} onLayout={event => { sectionOffsets.current.recommended = event.nativeEvent.layout.y + sectionOffsets.current.overview; }}>
              <Text style={styles.detailSectionTitle}>Recommended for you</Text>
              <Text style={styles.recommendationHint}>Related products selected from the live catalogue.</Text>
              {recommendations.length === 0 ? <Text style={styles.recommendationEmpty}>No related products available yet.</Text> : (
                <View style={styles.recommendationGrid}>
                  {recommendations.map(item => (
                    <Pressable key={item.id} style={styles.recommendationCard} onPress={() => onSelectProduct(item)}>
                      <ResilientImage uris={item.image_urls} style={styles.recommendationImage} resizeMode="cover" />
                      <Text style={styles.recommendationTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.recommendationPrice}>{money(item.flash_sale_price || item.price)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        {!keyboardVisible && <View onLayout={event => setActionBarHeight(event.nativeEvent.layout.height)} style={[styles.detailActions, { paddingBottom: bottomInset + 12 }]}>
          <View style={styles.quantityRow}>
            <Pressable style={[styles.quantityButton, (cartQuantity === 0 || outOfStock) && styles.disabled]} onPress={() => onRemove(product)} disabled={cartQuantity === 0 || outOfStock}><Ionicons name="remove" size={20} color="#101817" /></Pressable>
            <Text style={styles.quantityValue}>{cartQuantity}</Text>
            <Pressable style={[styles.quantityButton, (outOfStock || atMax) && styles.disabled]} onPress={() => onAdd(product)} disabled={outOfStock || atMax}><Ionicons name="add" size={20} color="#101817" /></Pressable>
          </View>
          <View style={styles.detailActionColumn}>
            {cartQuantity === 0 && !outOfStock && (
              <Animated.View style={[styles.detailHintBubble, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] }) }] }]}>
                <Ionicons name="sparkles-outline" size={16} color="#FF4747" /><Text style={styles.detailHintText}>👆 Tap Add to cart</Text>
              </Animated.View>
            )}
            {cartQuantity > 0 && <View style={styles.detailSuccessBubble}><Ionicons name="checkmark-circle" size={16} color="#12805F" /><Text style={styles.detailSuccessText}>✅ Added! Keep shopping or tap Cart to pay.</Text></View>}
            <Pressable style={[styles.detailCartButton, outOfStock && styles.disabled]} onPress={() => { if (outOfStock) return; if (cartQuantity === 0) onAdd(product); else onClose(); }} disabled={outOfStock}>
              <Animated.View style={{ transform: [{ scale: cartQuantity === 0 && !outOfStock ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) : 1 }] }}>
                <Text style={styles.primaryButtonText}>{outOfStock ? "Out of stock" : cartQuantity > 0 ? "Continue" : "Add to cart"}</Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>}
      </KeyboardAvoidingView>
      <Modal visible={galleryOpen} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => setGalleryOpen(false)}>
        <View style={[styles.galleryModal, { paddingTop: insets.top, paddingBottom: bottomInset }]}>
          <View style={styles.galleryModalHeader}>
            <Pressable style={styles.galleryClose} onPress={() => setGalleryOpen(false)} accessibilityLabel="Close image gallery"><Ionicons name="close" size={26} color="#FFFFFF" /></Pressable>
            <Text style={styles.galleryModalCount}>{galleryIndex + 1}/{images.length}</Text>
            <View style={styles.galleryHeaderSpacer} />
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * windowWidth, y: 0 }}
            onMomentumScrollEnd={event => setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth))}
          >
            {images.map((uri, index) => <ResilientImage key={`full-${uri}-${index}`} uri={uri} style={{ width: windowWidth, height: Math.max(320, windowHeight - insets.top - bottomInset - 132) }} resizeMode="contain" />)}
          </ScrollView>
          <Pressable style={styles.galleryAddButton} onPress={() => { setGalleryOpen(false); if (cartQuantity === 0 && !outOfStock) onAdd(product); }} disabled={outOfStock}>
            <Text style={styles.primaryButtonText}>{outOfStock ? "Out of stock" : cartQuantity > 0 ? "Already in cart" : "Add to cart"}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#F5F5F5", zIndex: 20 },
  detailSafe: { flex: 1 },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  detailBackButton: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D9E0DD" },
  detailHeaderTitle: { color: "#101817", fontSize: 16, fontWeight: "900" },
  detailHeaderSpacer: { width: 42 },
  sectionTabs: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderColor: "#EDEDED" },
  sectionTab: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  sectionTabText: { color: "#30423D", fontSize: 13, fontWeight: "900" },
  detailScroll: { paddingBottom: 140 },
  detailGallery: { height: 320, backgroundColor: "#E8EFEC" },
  detailImage: { width: 360, height: 320, backgroundColor: "#E8EFEC" },
  galleryCount: { position: "absolute", top: 280, right: 14, minWidth: 48, height: 28, paddingHorizontal: 10, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.65)" },
  galleryCountText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  detailBody: { padding: 18 },
  detailTitle: { marginTop: 6, color: "#101817", fontSize: 24, fontWeight: "900", lineHeight: 30 },
  detailSku: { marginTop: 6, color: "#66736F", fontSize: 12, fontWeight: "800" },
  detailPriceRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  detailPrice: { color: "#101817", fontSize: 24, fontWeight: "900" },
  detailComparePrice: { color: "#8A9692", fontSize: 16, fontWeight: "800", textDecorationLine: "line-through" },
  detailFlashComparePrice: { color: "#C62828", fontWeight: "900" },
  detailMetaRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailMetaLabel: { color: "#66736F", fontWeight: "700" },
  detailMetaValue: { flexShrink: 1, textAlign: "right", color: "#101817", fontWeight: "900" },
  detailDescriptionBlock: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderColor: "#EDF1EF" },
  productDetailsSection: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderColor: "#EDF1EF" },
  detailSectionTitle: { color: "#101817", fontSize: 16, fontWeight: "900" },
  detailDescription: { marginTop: 8, color: "#30423D", fontSize: 14, lineHeight: 22 },
  reviewSummaryRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  reviewSummaryScore: { color: "#191919", fontSize: 30, fontWeight: "900" },
  reviewSummaryCopy: { flex: 1, gap: 3 },
  reviewSummaryText: { color: "#8C8C8C", fontSize: 13, fontWeight: "700" },
  reviewError: { marginTop: 12, color: "#B42318", fontSize: 13, fontWeight: "700" },
  reviewCard: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDEDED" },
  reviewCardHead: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reviewAuthor: { color: "#191919", fontSize: 14, fontWeight: "900" },
  ratingStars: { flexDirection: "row", alignItems: "center", gap: 2 },
  verifiedRow: { marginTop: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { color: "#12805F", fontSize: 11, fontWeight: "800" },
  reviewText: { marginTop: 8, color: "#595959", fontSize: 13, lineHeight: 20 },
  reviewMediaRow: { gap: 8, paddingTop: 10, paddingRight: 4 },
  reviewMedia: { width: 88, height: 88, borderRadius: 8, backgroundColor: "#F0F0F0" },
  reviewForm: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderColor: "#EDEDED" },
  starRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  starPressable: { minWidth: 40, minHeight: 44, alignItems: "center", justifyContent: "center" },
  reviewInput: { minHeight: 96, marginTop: 12, borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF", color: "#191919", textAlignVertical: "top" },
  reviewActionRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  reviewSecondaryButton: { minHeight: 46, minWidth: 110, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F1", paddingHorizontal: 14 },
  reviewMoreButton: { alignSelf: "center", minHeight: 44, marginTop: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F1", paddingHorizontal: 18 },
  detailActions: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, borderTopWidth: 1, borderColor: "#D9E0DD", backgroundColor: "#F8FBFA", flexDirection: "row", alignItems: "center", gap: 12 },
  detailActionColumn: { flex: 1, gap: 10 },
  detailHintBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FFF1F1", borderWidth: 1, borderColor: "#FFD0D0" },
  detailHintText: { flex: 1, color: "#FF4747", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  detailSuccessBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#EAF8F2", borderWidth: 1, borderColor: "#CBEBDD" },
  detailSuccessText: { flex: 1, color: "#12805F", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  flashTag: { backgroundColor: "#FF4747", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
  flashTagText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  productHub: { color: "#8C8C8C", fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  muted: { marginTop: 8, color: "#8C8C8C", fontSize: 14, lineHeight: 20 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButtonText: { color: "#FF4747", fontWeight: "900" },
  disabled: { opacity: 0.5 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quantityButton: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D9E0DD" },
  quantityValue: { minWidth: 28, textAlign: "center", color: "#101817", fontSize: 18, fontWeight: "900" },
  detailCartButton: { flex: 1, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FF4747" },
  recommendationSection: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderColor: "#EDEDED" },
  recommendationHint: { marginTop: 5, color: "#8C8C8C", fontSize: 12, lineHeight: 18 },
  recommendationEmpty: { marginTop: 14, color: "#8C8C8C", fontSize: 13 },
  recommendationGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  recommendationCard: { width: "48%", overflow: "hidden", borderRadius: 10, paddingBottom: 10, backgroundColor: "#FFFFFF" },
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
