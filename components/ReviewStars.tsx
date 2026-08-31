import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const ACTIVE_STAR = "#FFB400";
const INACTIVE_STAR = "#D7D7D7";
const STAR_PATH = "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.51l-5.88 3.1 1.12-6.55-4.76-4.64 6.58-.96L12 2.5z";

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
        const glyph = (
          <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
            <Path
              d={STAR_PATH}
              fill={selected ? ACTIVE_STAR : "transparent"}
              stroke={selected ? ACTIVE_STAR : INACTIVE_STAR}
              strokeWidth={selected ? 1.25 : 1.7}
              strokeLinejoin="round"
            />
          </Svg>
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
  pressable: { minWidth: 30, minHeight: 30, alignItems: "center", justifyContent: "center" },
});
