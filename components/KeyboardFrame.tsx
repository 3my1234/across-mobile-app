import React, {useRef, useState} from "react";
import {KeyboardAvoidingView, KeyboardAvoidingViewProps, Platform, View} from "react-native";

// Keyboard coordinates are measured from the window; chat/form layouts sit
// below safe areas and headers. Measuring that origin keeps the composer above
// the keyboard instead of assuming every screen starts at window coordinate 0.
export function KeyboardFrame({children, style, behavior, ...props}: KeyboardAvoidingViewProps) {
  const frame = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  return <View ref={frame} collapsable={false} style={style} onLayout={() => {
    frame.current?.measureInWindow((_x, y) => setOffset(Math.max(0, y)));
  }}><KeyboardAvoidingView {...props} style={{flex:1}} behavior={behavior || (Platform.OS === "ios" ? "padding" : "height")} keyboardVerticalOffset={offset}>{children}</KeyboardAvoidingView></View>;
}
