import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, Image, ImageBackground,
  KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Product, Review, ReviewSummary } from "./types";
import { API_URL, LOGO, FALLBACK_IMAGES } from "./config";
import { money, normalizeMediaUrl, normalizeMediaUrls, uploadReviewImage, mapProduct } from "./utils";
import { AuthMode } from "./types";
import { s } from "./Styles";

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
  noticeText?: string;
  onModeChange: (m: AuthMode) => void;
  onSubmit: (p: string, b: Record<string, string>) => Promise<void>;
  onGoogle: () => Promise<void>;
}

export function AuthScreen({ mode, busy, noticeText, onModeChange, onSubmit, onGoogle }: AuthProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isWelcome = mode === "welcome";
  const title = mode === "signin" ? "Welcome back" : "Create your Atlantic Express account";

  async function submit() {
    if (mode === "signin") await onSubmit("/api/v1/auth/login", { email, password });
    else if (mode === "signup") await onSubmit("/api/v1/auth/signup", { full_name: fullName, email, phone, password });
  }

  return (
    <ImageBackground source={LOGO} resizeMode="contain" style={s.authBg} imageStyle={s.authBgImage}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.authSafe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.authKeyboard}>
          <ScrollView contentContainerStyle={s.authScroll} keyboardShouldPersistTaps="handled">
            <Image source={LOGO} style={s.authLogo} resizeMode="contain" />
            {isWelcome ? (
              <View style={s.authPanel}>
                <Text style={s.authTitle}>Shop China. Pay in Naira. Track to your door.</Text>
                <Text style={s.authCopy}>Sign in to access your cart, escrow protection, saved cards, and delivery tracking.</Text>
                {!!noticeText && (
                  <View style={s.authNotice}>
                    <Ionicons name="alert-circle-outline" size={16} color="#B54708" />
                    <Text style={s.authNoticeText}>{noticeText}</Text>
                  </View>
                )}
                <Pressable style={s.primaryButton} onPress={() => onModeChange("signup")}><Text style={s.primaryButtonText}>Create Account</Text></Pressable>
                <Pressable style={s.gmailButton} onPress={onGoogle} disabled={busy}><Ionicons name="logo-google" size={18} color="#101817" /><Text style={s.gmailButtonText}>{busy ? "Opening..." : "Sign in with Google"}</Text></Pressable>
                <Pressable style={s.textButton} onPress={() => onModeChange("signin")}><Text style={s.textButtonText}>I have an account</Text></Pressable>
              </View>
            ) : (
              <View style={s.authPanel}>
                <Text style={s.authTitle}>{title}</Text>
                {mode !== "signin" && <TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" autoCapitalize="words" style={s.input} />}
                <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={s.input} />
                {mode === "signup" && <TextInput value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" style={s.input} />}
                {mode !== "signin" && (<View style={s.passwordWrap}><TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={!showPassword} style={s.passwordInput} /><Pressable style={s.passwordToggle} onPress={() => setShowPassword(v => !v)}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#30423D" /></Pressable></View>)}
                <Pressable style={[s.primaryButton, busy && s.disabled]} disabled={busy} onPress={submit}><Text style={s.primaryButtonText}>{busy ? "Please wait..." : mode === "signin" ? "Sign In" : "Continue"}</Text></Pressable>
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
  onAdd: () => void;
  onRemove: () => void;
}

export function ProductDetailScreen({ product: initialProduct, token, cartQuantity, onClose, onAdd, onRemove }: DetailProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 16 : 8);
  const windowWidth = Dimensions.get("window").width;
  const [product, setProduct] = useState(initialProduct);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({ count: 0, average_rating: 0 });
  const [canReview, setCanReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const pulse = useRef(new Animated.Value(0)).current;
  const outOfStock = product.inventory_count <= 0;
  const atMax = cartQuantity >= product.inventory_count;

  useEffect(() => { loadDetail(); }, [initialProduct.id, token]);
  useEffect(() => {
    if (cartQuantity > 0 || outOfStock) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true })
    ]));
    anim.start(); return () => anim.stop();
  }, [outOfStock, pulse, cartQuantity]);

  async function loadDetail() {
    setLoading(true);
    try {
      const [pr, rr] = await Promise.all([
        fetch(`${API_URL}/api/v1/products/${initialProduct.id}`),
        fetch(`${API_URL}/api/v1/products/${initialProduct.id}/reviews`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      ]);
      if (pr.ok) { const d = await pr.json(); if (d.product) setProduct(mapProduct(d.product)); }
      if (rr.ok) { const d = await rr.json(); setReviews(d.reviews ?? []); setSummary(d.summary ?? { count: 0, average_rating: 0 }); }
      if (token) {
        const mr = await fetch(`${API_URL}/api/v1/products/${initialProduct.id}/reviews/mine`, { headers: { Authorization: `Bearer ${token}` } });
        if (mr.ok) { const d = await mr.json(); setCanReview(Boolean(d.can_review)); if (d.review) { setReviewRating(d.review.rating); setReviewText(d.review.review_text ?? ""); setReviewImages(d.review.media_urls ?? []); } }
      }
    } finally { setLoading(false); }
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
    setReviewBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/v1/products/${product.id}/reviews`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ rating: reviewRating, review_text: reviewText, media_urls: reviewImages }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Could not save");
      await loadDetail(); Alert.alert("Review saved", "Thanks! You earned ₦500 off your next order!");
    } catch (e) { Alert.alert("Failed", e instanceof Error ? e.message : ""); } finally { setReviewBusy(false); }
  }

  const images = product.image_urls?.length ? product.image_urls : [FALLBACK_IMAGES[0]];

  return (
    <View style={[styles.detailOverlay, { paddingTop: insets.top }]}>
      <View style={styles.detailSafe}>
        <View style={styles.detailHeader}>
          <Pressable style={styles.detailBackButton} onPress={onClose}><Ionicons name="arrow-back" size={22} color="#101817" /></Pressable>
          <Text style={styles.detailHeaderTitle}>Product details</Text>
          <View style={styles.detailHeaderSpacer} />
        </View>
        <ScrollView contentContainerStyle={[styles.detailScroll, { paddingBottom: bottomInset + 96 }]}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.detailGallery}>
            {images.map(uri => <Image key={uri} source={{ uri: normalizeMediaUrl(uri) }} style={[styles.detailImage, { width: windowWidth }]} />)}
          </ScrollView>
          <View style={styles.detailBody}>
            {product.is_flash_sale && <View style={styles.flashTag}><Text style={styles.flashTagText}>FLASH SALE</Text></View>}
            <Text style={styles.productHub}>{product.category_path?.[0] || product.origin_hub.city || "China"} hub</Text>
            <Text style={styles.detailTitle}>{product.title}</Text>
            <Text style={styles.detailSku}>SKU {product.sku}</Text>
            <View style={styles.detailPriceRow}>
              <Text style={styles.detailPrice}>{money(product.flash_sale_price || product.price)}</Text>
              {!!product.compare_at_price && product.compare_at_price > (product.flash_sale_price || product.price) && <Text style={styles.detailComparePrice}>{money(product.compare_at_price)}</Text>}
            </View>
            <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Origin</Text><Text style={styles.detailMetaValue}>{product.origin_hub.name || product.origin_hub.city || "China"}</Text></View>
            <View style={styles.detailMetaRow}><Text style={styles.detailMetaLabel}>Stock</Text><Text style={styles.detailMetaValue}>{outOfStock ? "Out" : `${product.inventory_count} units`}</Text></View>
            {!!product.description && (<View style={styles.detailDescriptionBlock}><Text style={styles.detailSectionTitle}>Description</Text><Text style={styles.detailDescription}>{product.description}</Text></View>)}
            <View style={styles.detailDescriptionBlock}>
              <Text style={styles.detailSectionTitle}>Reviews</Text>
              <Text style={styles.reviewSummaryText}>{summary.count > 0 ? `${summary.average_rating.toFixed(1)} avg · ${summary.count} reviews` : "No reviews yet"}</Text>
              {loading ? <ActivityIndicator color="#FF4747" style={{ marginTop: 12 }} /> : reviews.map(r => (
                <View key={r.id} style={styles.reviewCard}><View style={styles.reviewCardHead}><Text style={styles.reviewAuthor}>{r.is_mine ? "Your review" : r.author}</Text><Text style={styles.reviewStars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text></View>{!!r.review_text && <Text style={styles.reviewText}>{r.review_text}</Text>}</View>
              ))}
            </View>
            {canReview && (
              <View style={styles.reviewForm}>
                <Text style={styles.detailSectionTitle}>Your review</Text>
                <Text style={styles.muted}>Earn ₦500 off next order! Leave a review after delivery.</Text>
                <View style={styles.starRow}>{[1, 2, 3, 4, 5].map(s => <Pressable key={s} onPress={() => setReviewRating(s)}><Text style={styles.starButton}>{s <= reviewRating ? "★" : "☆"}</Text></Pressable>)}</View>
                <TextInput style={styles.reviewInput} value={reviewText} onChangeText={setReviewText} placeholder="Share your experience" multiline />
                <View style={styles.reviewActionRow}><Pressable style={[styles.reviewSecondaryButton, reviewBusy && styles.disabled]} onPress={pickReviewImage} disabled={reviewBusy}><Text style={styles.secondaryButtonText}>Add photo</Text></Pressable><Pressable style={[styles.detailCartButton, reviewBusy && styles.disabled]} onPress={saveReview} disabled={reviewBusy}><Text style={styles.primaryButtonText}>{reviewBusy ? "Saving..." : "Save"}</Text></Pressable></View>
              </View>
            )}
          </View>
        </ScrollView>
        <View style={[styles.detailActions, { paddingBottom: bottomInset + 12 }]}>
          <View style={styles.quantityRow}>
            <Pressable style={[styles.quantityButton, (cartQuantity === 0 || outOfStock) && styles.disabled]} onPress={onRemove} disabled={cartQuantity === 0 || outOfStock}><Ionicons name="remove" size={20} color="#101817" /></Pressable>
            <Text style={styles.quantityValue}>{cartQuantity}</Text>
            <Pressable style={[styles.quantityButton, (outOfStock || atMax) && styles.disabled]} onPress={onAdd} disabled={outOfStock || atMax}><Ionicons name="add" size={20} color="#101817" /></Pressable>
          </View>
          <View style={styles.detailActionColumn}>
            {cartQuantity === 0 && !outOfStock && (
              <Animated.View style={[styles.detailHintBubble, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] }) }] }]}>
                <Ionicons name="sparkles-outline" size={16} color="#FF4747" /><Text style={styles.detailHintText}>👆 Tap "Add to cart"</Text>
              </Animated.View>
            )}
            {cartQuantity > 0 && <View style={styles.detailSuccessBubble}><Ionicons name="checkmark-circle" size={16} color="#12805F" /><Text style={styles.detailSuccessText}>✅ Added! Keep shopping or tap Cart to pay.</Text></View>}
            <Pressable style={[styles.detailCartButton, outOfStock && styles.disabled]} onPress={() => { if (outOfStock) return; if (cartQuantity === 0) onAdd(); else onClose(); }} disabled={outOfStock}>
              <Animated.View style={{ transform: [{ scale: cartQuantity === 0 && !outOfStock ? pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) : 1 }] }}>
                <Text style={styles.primaryButtonText}>{outOfStock ? "Out of stock" : cartQuantity > 0 ? "Continue" : "Add to cart"}</Text>
              </Animated.View>
            </Pressable>
          </View>
        </View>
      </View>
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
  detailScroll: { paddingBottom: 140 },
  detailGallery: { height: 320, backgroundColor: "#E8EFEC" },
  detailImage: { width: 360, height: 320, backgroundColor: "#E8EFEC" },
  detailBody: { padding: 18 },
  detailTitle: { marginTop: 6, color: "#101817", fontSize: 24, fontWeight: "900", lineHeight: 30 },
  detailSku: { marginTop: 6, color: "#66736F", fontSize: 12, fontWeight: "800" },
  detailPriceRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  detailPrice: { color: "#101817", fontSize: 24, fontWeight: "900" },
  detailComparePrice: { color: "#8A9692", fontSize: 16, fontWeight: "800", textDecorationLine: "line-through" },
  detailMetaRow: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailMetaLabel: { color: "#66736F", fontWeight: "700" },
  detailMetaValue: { flexShrink: 1, textAlign: "right", color: "#101817", fontWeight: "900" },
  detailDescriptionBlock: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderColor: "#EDF1EF" },
  detailSectionTitle: { color: "#101817", fontSize: 16, fontWeight: "900" },
  detailDescription: { marginTop: 8, color: "#30423D", fontSize: 14, lineHeight: 22 },
  reviewSummaryText: { marginTop: 6, color: "#8C8C8C", fontSize: 13, fontWeight: "700" },
  reviewCard: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EDEDED" },
  reviewCardHead: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reviewAuthor: { color: "#191919", fontSize: 14, fontWeight: "900" },
  reviewStars: { color: "#FF4747", fontSize: 14, fontWeight: "900" },
  reviewText: { marginTop: 8, color: "#595959", fontSize: 13, lineHeight: 20 },
  reviewForm: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderColor: "#EDEDED" },
  starRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  starButton: { color: "#FF4747", fontSize: 28, fontWeight: "900" },
  reviewInput: { minHeight: 96, marginTop: 12, borderWidth: 1, borderColor: "#E8E8E8", borderRadius: 10, padding: 12, backgroundColor: "#FFFFFF", color: "#191919", textAlignVertical: "top" },
  reviewActionRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  reviewSecondaryButton: { minHeight: 46, minWidth: 110, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F1", paddingHorizontal: 14 },
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
});
