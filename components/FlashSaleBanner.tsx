import { useTheme, useThemedStyles, ThemedText as Text } from "./ThemeProvider";
import React from "react";
import {View,  ScrollView, Pressable, StyleSheet} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Product } from "./types";
import { money } from "./utils";
import { ResilientImage } from "./ResilientImage";

interface Props {
  flashSales: Product[];
  onSelectProduct: (product: Product) => void;
  onViewAll: () => void;
}

export function FlashSaleBanner({ flashSales, onSelectProduct, onViewAll }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(baseStyles);
  if (flashSales.length === 0) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <Ionicons name="flash" size={16} color={theme.color("#FFFFFF")} />
        <Text style={styles.title}>Flash Sale</Text>
		<Pressable onPress={onViewAll} style={styles.viewAll}><Text style={styles.subtitle}>View all</Text><Ionicons name="chevron-forward" size={14} color={theme.color("#FFFFFF")} /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {flashSales.slice(0, 8).map((p) => (
          <Pressable
			key={p.id}
            style={styles.card}
			onPress={() => onSelectProduct(p)}
          >
            <ResilientImage
			  uris={p.image_urls}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.cardCopy}>
			<Text numberOfLines={1} style={styles.productTitle}>{p.title}</Text>
			<Text style={styles.price}>{money(p.price, p.currency)}</Text>
			{p.compare_at_price ? <Text style={styles.old}>{money(p.compare_at_price, p.currency)}</Text> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  banner: { backgroundColor: "#FF4747", paddingVertical: 8, paddingLeft: 14, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700", marginLeft: "auto" },
	viewAll: { marginLeft: "auto", marginRight: 12, flexDirection: "row", alignItems: "center" },
  scroll: { gap: 10, paddingRight: 14 },
  card: { width: 184, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", borderRadius: 10, padding: 6, overflow: "hidden" },
  cardCopy: { flex: 1, minWidth: 0 },
  image: { width: 60, height: 60, borderRadius: 6, backgroundColor: "#F3F3F3" },
	productTitle: { color: "#191919", fontSize: 12, fontWeight: "700", marginTop: 5 },
  price: { color: "#FF4747", fontSize: 12, fontWeight: "900", marginTop: 4 },
  old: { color: "#C62828", fontSize: 11, fontWeight: "800", textDecorationLine: "line-through" },
});
