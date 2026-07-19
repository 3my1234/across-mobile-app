import React from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Product } from "./types";
import { FALLBACK_IMAGES } from "./config";
import { money } from "./utils";

interface Props {
  flashSales: Product[];
  onSelectProduct: (product: Product) => void;
}

export function FlashSaleBanner({ flashSales, onSelectProduct }: Props) {
  const items = flashSales.length > 0
    ? flashSales
    : Array.from({ length: 5 }, (_, i) => null);

  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <Ionicons name="flash" size={20} color="#FFFFFF" />
        <Text style={styles.title}>Flash Sale</Text>
        <Text style={styles.subtitle}>Limited time deals</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {items.map((p, i) => (
          <Pressable
            key={p?.id ?? i}
            style={styles.card}
            onPress={() => p ? onSelectProduct(p) : null}
          >
            <Image
              source={{ uri: p?.image_urls?.[0] || FALLBACK_IMAGES[i % 3] }}
              style={styles.image}
            />
            <Text style={styles.price}>{money(p?.flash_sale_price || p?.price || 1000 * (i + 1))}</Text>
            {p?.compare_at_price ? <Text style={styles.old}>{money(p.compare_at_price)}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#FF4747", paddingVertical: 12, paddingLeft: 14, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700", marginLeft: "auto" },
  scroll: { gap: 10, paddingRight: 14 },
  card: { width: 110, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, padding: 6, overflow: "hidden" },
  image: { width: 98, height: 98, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.2)" },
  price: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", marginTop: 4 },
  old: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", textDecorationLine: "line-through" },
});