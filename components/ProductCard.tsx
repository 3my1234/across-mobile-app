import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Product } from "./types";
import { money } from "./utils";
import { ResilientImage } from "./ResilientImage";
import { ReviewStars } from "./ReviewStars";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  product: Product;
  cartQuantity: number;
  onPress: () => void;
  onAdd?: () => void;
}

export function ProductCard({ product, cartQuantity, onPress, onAdd }: Props) {
  const currentPrice = Number(product.flash_sale_price || product.price);
  const comparePrice = Number(product.compare_at_price || 0);
  const discountPercent = comparePrice > currentPrice && comparePrice > 0
    ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
    : 0;
  const soldCount = Math.max(0, Number(product.sold_count || 0));
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <ResilientImage
        uris={product.image_urls}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{product.title}</Text>
        {!!product.category_path?.length && <Text style={styles.category} numberOfLines={1}>{product.category_path[product.category_path.length-1]}</Text>}
        <View style={styles.ratingRow}>
          <ReviewStars rating={product.average_rating} size={12} />
          <Text style={styles.ratingText}>
            {product.review_count > 0 ? `${product.average_rating.toFixed(1)} (${product.review_count})` : "New"}
          </Text>
        </View>
        {typeof product.distance_km === "number" && <Text style={styles.nearby}>{product.distance_km.toFixed(1)} km away</Text>}
        {product.fulfillment_mode === "merchant_cross_border" && product.stock_state !== "import_on_demand" && product.inventory_country_code && <Text style={styles.abroad}>Ships from {product.inventory_country_code}</Text>}
        <View style={styles.footer}>
          <View style={styles.priceCopy}>
            <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{money(currentPrice, product.currency)}</Text>
            {!!product.delivery_fee && <Text style={styles.metaText}>Delivered price</Text>}
            {comparePrice > currentPrice && (
              <View style={styles.discountRow}>
                <Text style={styles.compare}>{money(comparePrice, product.currency)}</Text>
                <Text style={styles.discountBadge}>-{discountPercent}%</Text>
              </View>
            )}
          </View>
          <Pressable hitSlop={6} accessibilityLabel={onAdd ? `Add ${product.title} to cart` : `View ${product.title}`} disabled={onAdd ? product.inventory_count <= 0 || cartQuantity >= product.inventory_count : false} onPress={event=>{event.stopPropagation();(onAdd || onPress)();}} style={[styles.cartButton,onAdd && (product.inventory_count<=0 || cartQuantity>=product.inventory_count) && {opacity:0.45}]}><Ionicons name="cart-outline" size={19} color="#191919"/>{cartQuantity>0 && <Text style={styles.cartCount}>{cartQuantity}</Text>}</Pressable>
        </View>
        <View style={styles.metaRow}>
          {soldCount > 0 && <Text style={styles.metaText}>{soldCount.toLocaleString()} sold</Text>}
          {product.inventory_count <= 5 && <Text style={styles.metaText}>{product.inventory_count > 0 ? `${product.inventory_count} left` : "Out of stock"}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, marginBottom: 4, overflow: "hidden", borderRadius: 0, backgroundColor: "#FFFFFF" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#F0F0F0" },
  body: { paddingHorizontal: 6, paddingVertical: 6 },
  title: { color: "#191919", fontSize: 12, fontWeight: "600", lineHeight: 17 },
  category: {color:"#595959",fontSize:11,lineHeight:16,marginTop:2},
  ratingRow: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { color: "#6F6F6F", fontSize: 11, fontWeight: "700" },
  nearby: { marginTop: 5, color: "#12805F", fontSize: 11, fontWeight: "900" },
  abroad: { marginTop: 5, color: "#52679A", fontSize: 11, fontWeight: "800" },
  footer: { marginTop: 5, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  priceCopy: {flex:1,minWidth:0},
  cartButton: {minWidth:34,minHeight:32,paddingHorizontal:5,borderWidth:1,borderColor:"#191919",borderRadius:16,alignItems:"center",justifyContent:"center",flexDirection:"row",gap:2},
  cartCount:{fontSize:10,color:"#191919",fontWeight:"700"},
  price: { color: "#FF4747", fontSize: 15, fontWeight: "900" },
  discountRow: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 6 },
  compare: { color: "#C62828", fontSize: 11, fontWeight: "900", textDecorationLine: "line-through", textDecorationColor: "#C62828" },
  discountBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, overflow: "hidden", color: "#FFFFFF", backgroundColor: "#D71920", fontSize: 9, fontWeight: "900" },
  badge: { marginTop: 6, color: "#FF4747", fontSize: 11, fontWeight: "900" },
  metaRow: { marginTop: 3, flexDirection: "row", justifyContent: "space-between", gap: 6 },
  metaText: { color: "#8C8C8C", fontSize: 11, fontWeight: "700" },
});
