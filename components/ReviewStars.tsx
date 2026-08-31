import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const ACTIVE_STAR = "#FFB400";
const INACTIVE_STAR = "#D7D7D7";

type Props = {
  rating: number;
  size?: number;
  onChange?: (rating: number) => void;
};

export function ReviewStars({ rating, size = 16, onChange }: Props) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <View style={styles.row} accessibilityLabel={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(star => {
        const selected = star <= rounded;
        // Text glyphs avoid an Android release-build icon-font fallback that
        // rendered stars with the font's default black fill.
        const glyph = (
          <Text
            allowFontScaling={false}
            style={[styles.star, { color: selected ? ACTIVE_STAR : INACTIVE_STAR, fontSize: size, lineHeight: size + 3 }]}
          >
            {selected ? "★" : "☆"}
          </Text>
        );
        return onChange ? (
          <Pressable
            key={star}
            style={styles.pressable}
            hitSlop={6}
            onPress={() => onChange(star)}
            accessibilityRole="button"
            accessibilityLabel={`${star} star rating`}
            accessibilityState={{ selected }}
          >
            {glyph}
          </Pressable>
        ) : <React.Fragment key={star}>{glyph}</React.Fragment>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  star: { fontFamily: "sans-serif", fontWeight: "400", includeFontPadding: false, textAlign: "center" },
  pressable: { minWidth: 30, minHeight: 30, alignItems: "center", justifyContent: "center" },
});
