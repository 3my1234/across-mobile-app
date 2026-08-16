import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Product } from "./types";
import { money } from "./utils";
import { ResilientImage } from "./ResilientImage";

interface Props {
  product: Product;
  cartQuantity: number;
  onPress: () => void;
}

export function ProductCard({ product, cartQuantity, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <ResilientImage
        uris={product.image_urls}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>{money(product.price)}</Text>
            {!!product.compare_at_price && product.compare_at_price > product.price && (
              <Text style={[styles.compare, product.is_flash_sale && styles.flashCompare]}>{money(product.compare_at_price)}</Text>
            )}
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{product.inventory_count > 0 ? "New" : "Limited"}</Text>
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
  flashCompare: { color: "#C62828", fontWeight: "900" },
  badge: { marginTop: 6, color: "#FF4747", fontSize: 11, fontWeight: "900" },
  metaRow: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", gap: 10 },
  metaText: { color: "#8C8C8C", fontSize: 11, fontWeight: "700" },
});
