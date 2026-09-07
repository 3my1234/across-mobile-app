import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Product } from "./types";
import { money } from "./utils";
import { ResilientImage } from "./ResilientImage";
import { ReviewStars } from "./ReviewStars";

interface Props {
  product: Product;
  cartQuantity: number;
  onPress: () => void;
}

export function ProductCard({ product, cartQuantity, onPress }: Props) {
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
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
        <View style={styles.ratingRow}>
          <ReviewStars rating={product.average_rating} size={12} />
          <Text style={styles.ratingText}>
            {product.review_count > 0 ? `${product.average_rating.toFixed(1)} (${product.review_count})` : "New"}
          </Text>
        </View>
        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>{money(currentPrice)}</Text>
            {comparePrice > currentPrice && (
              <View style={styles.discountRow}>
                <Text style={styles.compare}>{money(comparePrice)}</Text>
                <Text style={styles.discountBadge}>-{discountPercent}%</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{soldCount.toLocaleString()} sold</Text>
          <Text style={styles.metaText}>{product.inventory_count > 0 ? `${product.inventory_count} left` : "Limited"}</Text>
        </View>
        {cartQuantity > 0 && <Text style={styles.badge}>{cartQuantity} in cart</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, marginBottom: 8, overflow: "hidden", borderRadius: 10, backgroundColor: "#FFFFFF" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#F0F0F0" },
  body: { padding: 10 },
  title: { minHeight: 36, color: "#191919", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  ratingRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 },
  ratingText: { color: "#6F6F6F", fontSize: 11, fontWeight: "700" },
  footer: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { color: "#FF4747", fontSize: 15, fontWeight: "900" },
  discountRow: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 6 },
  compare: { color: "#C62828", fontSize: 11, fontWeight: "900", textDecorationLine: "line-through", textDecorationColor: "#C62828" },
  discountBadge: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, overflow: "hidden", color: "#FFFFFF", backgroundColor: "#D71920", fontSize: 9, fontWeight: "900" },
  badge: { marginTop: 6, color: "#FF4747", fontSize: 11, fontWeight: "900" },
  metaRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  metaText: { color: "#8C8C8C", fontSize: 11, fontWeight: "700" },
});
