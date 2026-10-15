import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { TownHallIcon } from "./TownHallIcon";
import { ThemedText as Text } from "./ThemeProvider";
import { communityRequest } from "./communityApi";
export function TownHallBubble({ token, bottomInset, onOpen }: {
    token: string;
    bottomInset: number;
    onOpen: () => void;
}) {
    const { width, height } = useWindowDimensions(), [count, setCount] = useState(0), position = useRef(new Animated.ValueXY({ x: width - 64, y: height - bottomInset - 150 })).current;
    const origin = useRef({ x: width - 64, y: height - bottomInset - 150 }), bounds = useRef({ width, height, bottomInset }), dragged = useRef(false);
    bounds.current = { width, height, bottomInset };
    const clamp = (x: number, y: number) => ({ x: Math.max(8, Math.min(x, bounds.current.width - 56)), y: Math.max(80, Math.min(y, bounds.current.height - bounds.current.bottomInset - 130)) });
    useEffect(() => { origin.current = clamp(origin.current.x, origin.current.y); position.setValue(origin.current); }, [width, height, bottomInset]);
    const responder = useRef(PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8, onPanResponderGrant: () => { dragged.current = true; }, onPanResponderMove: (_, gesture) => position.setValue(clamp(origin.current.x + gesture.dx, origin.current.y + gesture.dy)), onPanResponderRelease: (_, gesture) => { origin.current = clamp(origin.current.x + gesture.dx, origin.current.y + gesture.dy); position.setValue(origin.current); setTimeout(() => dragged.current = false, 100); }, onPanResponderTerminate: () => { position.setValue(origin.current); dragged.current = false; } })).current;
    useEffect(() => { let active = true; const load = async () => { if (AppState.currentState !== "active")
        return; try {
        const { data } = await communityRequest(token, "/chat/town-hall/activity");
        if (active)
            setCount(data.count || 0);
    }
    catch { } }; void load(); const timer = setInterval(() => void load(), 60000); return () => { active = false; clearInterval(timer); }; }, [token]);
    return <Animated.View {...responder.panHandlers} style={[styles.floating, { transform: position.getTranslateTransform() }]}><Pressable accessibilityLabel={count ? `Town Hall, ${count} new activities` : "Open Town Hall"} onPress={() => { if (!dragged.current)
        onOpen(); }} style={styles.button}><TownHallIcon size={34}/><Text style={styles.label}>Hall</Text></Pressable>{count > 0 && <View style={styles.badge}><Text style={styles.count}>{count > 99 ? "99+" : count}</Text></View>}</Animated.View>;
}
const styles = StyleSheet.create({ floating: { position: "absolute", left: 0, top: 0, zIndex: 20 }, button: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#12805F", justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOpacity: .15, shadowRadius: 4 }, label: { fontSize: 9, color: "#FFF", fontWeight: "700" }, badge: { position: "absolute", right: -4, top: -4, borderRadius: 10, backgroundColor: "#FF4747", minWidth: 20, padding: 3 }, count: { fontSize: 10, color: "#FFF", textAlign: "center" } });
