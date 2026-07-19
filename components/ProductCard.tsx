import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Product } from "./types";
import { FALLBACK_IMAGES } from "./config";
import { money } from "./utils";

interface Props {
  product: Product;
  cartQuantity: number;
  onPress: () => void;
}

export function ProductCard({ product, cartQuantity, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image
        source={{ uri: product.image_urls[0] || FALLBACK_IMAGES[0] }}
        style={styles.image}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>{money(product.price)}</Text>
            {!!product.compare_at_price && product.compare_at_price > product.price && (
              <Text style={styles.compare}>{money(product.compare_at_price)}</Text>
            )}
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{product.inventory_count > 0 ? "New" : "Limited"}</Text>
          <Text style={styles.metaText}>★ 4.5</Text>
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
  footer: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  price: { color: "#FF4747", fontSize: 15, fontWeight: "900" },
  compare: { marginTop: 2, color: "#BFBFBF", fontSize: 11, fontWeight: "700", textDecorationLine: "line-through" },
  badge: { marginTop: 6, color: "#FF4747", fontSize: 11, fontWeight: "900" },
  metaRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  metaText: { color: "#8C8C8C", fontSize: 11, fontWeight: "700" },
});