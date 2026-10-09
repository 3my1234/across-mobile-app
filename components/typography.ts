import {StyleSheet, type StyleProp, type TextStyle} from "react-native";

// Match the compact service cards while respecting the phone's font scaling.
export function compactTypography(style?: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) || {};
  const original = flat.fontSize ?? 14;
  const fontSize = original >= 18 ? 16 : original >= 15 ? 14 : original === 14 ? 13 : original;
  return {fontSize, lineHeight: flat.lineHeight && original === fontSize ? flat.lineHeight : Math.ceil(fontSize * 1.4)};
}
