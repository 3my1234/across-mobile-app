import React from "react";
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Product } from "./types";
import { money } from "./utils";

interface Props {
  flashSales: Product[];
  onSelectProduct: (product: Product) => void;
  onViewAll: () => void;
}

export function FlashSaleBanner({ flashSales, onSelectProduct, onViewAll }: Props) {
  if (flashSales.length === 0) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <Ionicons name="flash" size={20} color="#FFFFFF" />
        <Text style={styles.title}>Flash Sale</Text>
		<Pressable onPress={onViewAll} style={styles.viewAll}><Text style={styles.subtitle}>View all</Text><Ionicons name="chevron-forward" size={14} color="#FFFFFF" /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {flashSales.slice(0, 8).map((p) => (
          <Pressable
			key={p.id}
            style={styles.card}
			onPress={() => onSelectProduct(p)}
          >
            <Image
			  source={{ uri: p.image_urls?.[0] }}
              style={styles.image}
            />
			<Text numberOfLines={1} style={styles.productTitle}>{p.title}</Text>
			<Text style={styles.price}>{money(p.price)}</Text>
			{p.compare_at_price ? <Text style={styles.old}>{money(p.compare_at_price)}</Text> : null}
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
	viewAll: { marginLeft: "auto", marginRight: 12, flexDirection: "row", alignItems: "center" },
  scroll: { gap: 10, paddingRight: 14 },
  card: { width: 110, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, padding: 6, overflow: "hidden" },
  image: { width: 98, height: 98, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.2)" },
	productTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", marginTop: 5 },
  price: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", marginTop: 4 },
  old: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", textDecorationLine: "line-through" },
});
