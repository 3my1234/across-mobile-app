import { KeyboardFrame } from "./KeyboardFrame";
import { useTheme, useThemedStyles, ThemedText as Text, ThemedTextInput as TextInput } from "./ThemeProvider";
import React, { useEffect, useRef, useState } from "react";
import {ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet,   View} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SupportMessage, SupportTicket } from "./types";
import { LOGO } from "./config";

type Props = { ticket: SupportTicket; messages: SupportMessage[]; error: string; busy: boolean; onClose: () => void; onSend: (text: string) => Promise<void>; onRefresh: () => void; onEarlier: () => void; hasEarlier: boolean; loading: boolean };

export function SupportConversation({ ticket, messages, error, busy, onClose, onSend, onRefresh, onEarlier, hasEarlier, loading }: Props) {
  const theme = useTheme();
  const styles = useThemedStyles(baseStyles);
  const list = useRef<FlatList<SupportMessage>>(null);
  const [draft, setDraft] = useState("");
  const nearBottom = useRef(true);
  const lastMessage = messages[messages.length - 1];
  useEffect(() => { setDraft(""); nearBottom.current = true; }, [ticket.id]);
  useEffect(() => { if (nearBottom.current) requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false })); }, [lastMessage?.id, lastMessage?.created_at, ticket.id]);
  const send = async () => { const text = draft.trim(); if (!text || busy) return; await onSend(text); setDraft(""); nearBottom.current = true; };
  return <KeyboardFrame style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={styles.header}><Pressable onPress={onClose} accessibilityLabel="Back to support conversations" style={styles.back}><Ionicons name="chevron-back" size={24} color={theme.color("#191919")} /></Pressable><View style={styles.heading}><Text numberOfLines={1} style={styles.title}>{ticket.subject}</Text><Text style={styles.meta}>Atlantic Express support · {ticket.status}</Text></View></View>
    {!!error && <Pressable onPress={onRefresh}><Text style={styles.error}>{error} · Tap to retry</Text></Pressable>}
    <FlatList ref={list} data={messages} keyExtractor={(message, index) => message.id || `${message.created_at}:${index}`} style={styles.fill} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onScroll={event => { const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent; nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100; }} scrollEventThrottle={100}
      onContentSizeChange={() => { if (nearBottom.current) list.current?.scrollToEnd({ animated: false }); }}
      maintainVisibleContentPosition={{minIndexForVisible: 0}}
      ListHeaderComponent={hasEarlier ? <Pressable onPress={onEarlier} disabled={loading} style={styles.earlier}><Text style={styles.meta}>{loading ? "Loading…" : "Load earlier messages"}</Text></Pressable> : null}
      ListEmptyComponent={loading ? <ActivityIndicator color={theme.color("#FF4747")} /> : !error ? <Text style={styles.meta}>No messages yet.</Text> : null}
      renderItem={({item}) => { const mine = item.sender_type !== "admin"; return <View style={[styles.row, mine && styles.mineRow]}>
        {!mine && <Image source={LOGO} style={styles.avatar} />}
        <View style={[styles.bubble, mine && styles.mineBubble]}><Text style={styles.message}>{item.message}</Text><Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text></View>
      </View>; }} />
    {ticket.status !== "closed" ? <View style={styles.composer}><TextInput accessibilityLabel="Message Atlantic Express support" value={draft} onChangeText={setDraft} multiline maxLength={5000} placeholder="Write a message…" style={styles.input} editable={!busy}/><Pressable accessibilityLabel="Send message" disabled={busy || !draft.trim()} onPress={() => { void send().catch(() => {}); }} style={[styles.send, (busy || !draft.trim()) && styles.disabled]}>{busy ? <ActivityIndicator color={theme.color("#FFF")} /> : <Ionicons name="arrow-up" size={22} color={theme.color("#FFF")} />}</Pressable></View> : <Text style={styles.closed}>This conversation is closed. Create a new ticket if you need more help.</Text>}
  </KeyboardFrame>;
}

const baseStyles = StyleSheet.create({
  fill: {flex: 1, backgroundColor: "#F3F4F4"}, header: {flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", paddingVertical: 10, paddingRight: 12}, back: {minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center"}, heading: {flex: 1}, title: {fontSize: 16, fontWeight: "800", color: "#191919"}, meta: {fontSize: 12, color: "#66736F"}, error: {padding: 10, color: "#B42318"}, thread: {padding: 12, flexGrow: 1}, row: {flexDirection: "row", alignItems: "flex-start", marginBottom: 14, gap: 8}, mineRow: {justifyContent: "flex-end"}, avatar: {width: 30, height: 30, borderRadius: 15}, bubble: {maxWidth: "82%", padding: 12, borderRadius: 15, borderTopLeftRadius: 4, backgroundColor: "#FFF"}, mineBubble: {backgroundColor: "#FFF1DD", borderTopLeftRadius: 15, borderTopRightRadius: 4}, message: {color: "#191919", fontSize: 14, lineHeight: 21}, time: {fontSize: 10, color: "#66736F", marginTop: 6}, composer: {flexDirection: "row", alignItems: "flex-end", padding: 10, gap: 8, backgroundColor: "#FFF"}, input: {flex: 1, minHeight: 44, maxHeight: 120, padding: 10, borderRadius: 18, backgroundColor: "#F3F4F4", color: "#191919", fontSize: 14}, send: {width: 44, height: 44, borderRadius: 22, backgroundColor: "#FF4747", alignItems: "center", justifyContent: "center"}, disabled: {opacity: 0.45}, earlier: {padding: 12, alignItems: "center"}, closed: {padding: 12, color: "#66736F", backgroundColor: "#FFF"}
});
