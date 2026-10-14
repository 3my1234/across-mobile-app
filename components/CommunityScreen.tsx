import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText as Text, useTheme, useThemedStyles } from "./ThemeProvider";
import { KeyboardFrame } from "./KeyboardFrame";
import { ProviderConversation, ProviderMessage } from "./ProviderConversation";
import { ProviderIdentity, ProviderIdentityData } from "./ProviderIdentity";
import { communityRequest } from "./communityApi";
import { createChatHistoryCache } from "./chatHistoryCache";
import { mergeChatMessages } from "./chatImages";
import { CommunityTownHall } from "./CommunityTownHall";
import * as Notifications from "expo-notifications";
export type CommunityMode = "chats" | "town-hall";
type Conversation = {
    id: string;
    kind: string;
    source: "shared" | "legacy";
    title: string;
    actor_role: string;
    peer_user_id: string;
    state: string;
    unread_count: number;
    context: any;
    provider_identity?: ProviderIdentityData;
};
const history = createChatHistoryCache<ProviderMessage>();
const snapshots = createChatHistoryCache<any>(4, 5 * 60 * 1000, 100);
export function CommunityScreen({ token, bottomInset = 0, initialMode = "chats", initialConversationId = "", initialHallRoomId = "" }: {
    token: string;
    bottomInset?: number;
    initialMode?: CommunityMode;
    initialConversationId?: string;
    initialHallRoomId?: string;
}) {
    const theme = useTheme(), s = useThemedStyles(base), [mode, setMode] = useState<CommunityMode>(initialMode === "town-hall" ? "town-hall" : "chats");
    const [inbox, setInbox] = useState<Conversation[]>(() => snapshots.get(token, "inbox")?.messages || []);
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [cursor, setCursor] = useState("");
    const [selected, setSelected] = useState<Conversation | null>(null), [messages, setMessages] = useState<ProviderMessage[]>([]), [chatCursor, setChatCursor] = useState(""), [chatLoading, setChatLoading] = useState(false), [canSend, setCanSend] = useState(true);
    const alive = useRef(true), sequence = useRef(0), threadSequence = useRef(0), current = useRef<Conversation | null>(null), etags = useRef(new Map<string, string>()), messageRef = useRef<ProviderMessage[]>([]), scroll = useRef<ScrollView>(null);
    const openedInitial = useRef("");
    const lastHallRoom=useRef(initialHallRoomId);
    const readAcknowledged = useRef(new Map<string, string>());
    useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++; threadSequence.current++; }; }, [token]);
    const call = useCallback(async (path: string, options: RequestInit = {}) => communityRequest(token, path, options), [token]);
    const load = useCallback(async (older = "") => {
        if (!token)
            return;
        const request = ++sequence.current;
        setLoading(true);
        setError("");
        try {
            if (mode !== "chats")
                return;
            const path = "/chat/inbox";
            const { data } = await call(`${path}?limit=25${older ? `&cursor=${encodeURIComponent(older)}` : ""}`);
            if (!alive.current || request !== sequence.current)
                return;
            const apply = (previous: any[]) => older ? [...previous, ...data.items.filter((item: any) => !previous.some(old => old.id === item.id))] : data.items || [];
            setInbox(previous => { const next = apply(previous); snapshots.put(token, "inbox", next, data.next_cursor || ""); return next; });
            setCursor(data.next_cursor || "");
        }
        catch (err) {
            if (alive.current && request === sequence.current)
                setError(err instanceof Error ? err.message : "Please retry");
        }
        finally {
            if (alive.current && request === sequence.current)
                setLoading(false);
        }
    }, [call, mode, token]);
    useEffect(() => { void load(); }, [load]);
    useEffect(()=>{if(selected?.kind==='town_hall')setMode('town-hall');},[selected?.kind]);
    const loadThread = useCallback(async (conversation: Conversation, older = "") => {
        const request = ++threadSequence.current;
        setChatLoading(true);
        try {
            const { data, etag, unchanged } = await call(`/chat/conversations/${conversation.id}/messages?limit=40&mark_read=false${older ? `&cursor=${encodeURIComponent(older)}` : ""}`, { headers: !older && etags.current.has(conversation.id) ? { "If-None-Match": etags.current.get(conversation.id)! } : {} });
            if (!alive.current || request !== threadSequence.current || current.current?.id !== conversation.id)
                return;
            if (unchanged) {
                const latest = messageRef.current.at(-1);
                if (!older && latest && AppState.currentState === "active" && readAcknowledged.current.get(conversation.id) !== latest.id) {
                    await call(`/chat/conversations/${conversation.id}/read`, { method: "POST", body: JSON.stringify({ message_id: latest.id }) });
                    readAcknowledged.current.set(conversation.id, latest.id);
                }
                return;
            }
            if (etag && !older)
                etags.current.set(conversation.id, etag);
            const incoming = (data.items || []).map((message: ProviderMessage) => ({ ...message, sender_type: conversation.source === "legacy" ? message.sender_type : message.is_mine ? "buyer" : "provider", is_mine: conversation.source === "legacy" ? message.sender_type === conversation.actor_role : message.is_mine }));
            const next = mergeChatMessages(messageRef.current, incoming);
            messageRef.current = next;
            setMessages(next);
            setChatCursor(data.next_cursor || "");
            setCanSend(data.can_send !== false);
            history.put(token, conversation.id, next, data.next_cursor || "");
            setError("");
            if (!older && next.length && AppState.currentState === "active") {
                await call(`/chat/conversations/${conversation.id}/read`, { method: "POST", body: JSON.stringify({ message_id: next[next.length - 1].id }) });
                readAcknowledged.current.set(conversation.id, next[next.length - 1].id);
                if (alive.current && current.current?.id === conversation.id)
                    void load();
            }
        }
        catch (err) {
            if (alive.current && request === threadSequence.current)
                setError(err instanceof Error ? err.message : "Please retry");
        }
        finally {
            if (alive.current && request === threadSequence.current)
                setChatLoading(false);
        }
    }, [call, load, token]);
    const open = useCallback(async (conversation: Conversation) => {
        if(conversation.kind==='town_hall')lastHallRoom.current=conversation.id;
        current.current = conversation;
        setSelected(conversation);
        setError("");
        setCanSend(conversation.state === "open");
        const cached = history.get(token, conversation.id);
        if(!cached)etags.current.delete(conversation.id);
        messageRef.current = cached?.messages || [];
        setMessages(messageRef.current);
        setChatCursor(cached?.cursor || "");
        await loadThread(conversation);
    }, [loadThread, token]);
    useEffect(() => { if (!initialConversationId || openedInitial.current === initialConversationId)
        return; openedInitial.current = initialConversationId; void call(`/chat/inbox?conversation_id=${encodeURIComponent(initialConversationId)}`).then(({ data }) => { if (alive.current && data.items?.[0])
        void open(data.items[0]); }).catch(err => { if (alive.current)
        setError(err.message); }); }, [initialConversationId, call, open]);
    useEffect(() => {
        const timer = setInterval(() => { if (AppState.currentState !== "active")
            return; if (current.current)
            void loadThread(current.current);
        else
            void load(); }, 20000);
        const listener = AppState.addEventListener("change", state => { if (state === "active") {
            if (current.current)
                void loadThread(current.current);
            else
                void load();
        } });
        return () => { clearInterval(timer); listener.remove(); };
    }, [loadThread, load]);
    useEffect(()=>{const subscription=Notifications.addNotificationReceivedListener(notification=>{const data=notification.request.content.data;if(current.current&&(data.chat_room_id===current.current.id||data.conversation_id===current.current.id))void loadThread(current.current);else if(!current.current&&mode==='chats')void load();});return()=>subscription.remove();},[loadThread,load,mode]);
    async function act(action: () => Promise<void>) { if (busy)
        return; setBusy(true); setError(""); try {
        await action();
    }
    catch (err) {
        if (alive.current)
            setError(err instanceof Error ? err.message : "Please retry");
    }
    finally {
        if (alive.current)
            setBusy(false);
    } }
    async function send(text: string, mediaKeys?: string[], clientID?: string) {
        if (!current.current)
            return;
        const conversation = current.current;
        const { data } = await call(`/chat/conversations/${conversation.id}/messages`, { method: "POST", body: JSON.stringify({ message: text, media_keys: mediaKeys || [], client_message_id: clientID }) });
        if (!alive.current || current.current?.id !== conversation.id)
            return;
        const next = mergeChatMessages(messageRef.current, [{ ...data, is_mine: true, sender_type: "buyer" }]);
        messageRef.current = next;
        setMessages(next);
        history.put(token, conversation.id, next, chatCursor);
        etags.current.delete(conversation.id);
        void loadThread(conversation); // Sending is complete; refresh does not lock the composer.
    }
    const button = (label: string, action: () => void, danger = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={[s.button, danger && s.danger, busy && { opacity: .5 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
    async function openChatID(id: string) { const { data } = await call(`/chat/inbox?conversation_id=${id}`); if (!alive.current)
        return; if (!data.items?.[0])
        throw Error("This chat is no longer available."); await open(data.items[0]); }
    const tabs = <View style={s.tabs}>{([['chats', 'Chats'], ['town-hall', 'Town Hall']] as const).map(([key, label]) => <Pressable key={key} onPress={() => { setMode(key); setCursor(""); }} style={[s.tab, mode === key && s.active]}><Text style={s.tabText}>{label}</Text></Pressable>)}</View>;
    if (mode === "town-hall" && !selected)
        return <View style={s.fill}>{tabs}<CommunityTownHall token={token} bottomInset={bottomInset} initialRoomId={lastHallRoom.current} openChat={openChatID}/></View>;
    if (!token)
        return <View style={s.panel}><Text>Sign in to use Chats and Town Hall.</Text></View>;
    if (selected)
        return <ProviderConversation roomStyle={selected.kind==='town_hall'} key={`${token}:${selected.id}`} token={token} title={selected.context?.title || selected.title} provider={selected.title} identity={selected.provider_identity} messages={messages} loading={chatLoading} busy={busy} paused={!canSend} pausedLabel={selected.kind === "town_hall" ? "This room is closed or your paid plan needs renewal." : "This conversation is read-only or blocked."} error={error} bottomInset={bottomInset} hasEarlier={!!chatCursor} onClose={() => { threadSequence.current++; current.current = null; setSelected(null); setError(""); }} onRefresh={() => void loadThread(selected)} onEarlier={() => void loadThread(selected, chatCursor)} onSend={send} toolbar={selected.source === "shared" && selected.kind === "direct" ? <View style={s.toolbar}>{button("Block", () => Alert.alert("Block this person?", "They will no longer be able to send you direct messages.", [{ text: "Cancel", style: "cancel" }, { text: "Block", style: "destructive", onPress: () => void act(async () => { await call(`/chat/blocks/${selected.peer_user_id}`, { method: "POST" }); setCanSend(false); }) }]), true)}{button("Report", () => Alert.alert("Report this chat?", "Send this conversation to moderation for review.", [{ text: "Cancel", style: "cancel" }, { text: "Report", onPress: () => void act(async () => { await call(`/chat/conversations/${selected.id}/reports`, { method: "POST", body: JSON.stringify({ reason: "User reported this conversation for inappropriate messages or spam" }) }); Alert.alert("Report received", "Your report has been recorded for review."); }) }]))}</View> : undefined}/>;
    return <KeyboardFrame style={s.fill} behavior="height">{tabs}
 <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: bottomInset + 20 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.color("#FF4747")}/>}>
 {!!error && <Pressable onPress={() => void load()}><Text style={s.error}>{error}</Text></Pressable>}
 {mode === "chats" && <>{!inbox.length ? <Text style={s.muted}>{loading ? "Loading conversations..." : error ? "Refresh to load conversations." : "Your conversations appear here. Contact a provider from a product or service to start a chat."}</Text> : inbox.map(item => <Pressable key={item.id} onPress={() => void open(item)} style={[s.panel, item.unread_count > 0 && s.unread]}><View style={s.row}><View style={{ flex: 1 }}>{item.provider_identity ? <ProviderIdentity identity={item.provider_identity}/> : <Text style={s.title}>{item.title}</Text>}<Text style={s.muted}>{item.kind === "business" ? item.context?.title || "Product or service enquiry" : item.kind === "town_hall" ? "Town Hall bargaining" : "Private chat"}</Text></View>{item.unread_count > 0 && <View style={s.count}><Text style={s.countText}>{item.unread_count}</Text></View>}</View></Pressable>)}</>}
 {!!cursor && mode === "chats" && button(loading ? "Loading..." : "Load more", () => void load(cursor))}
 </ScrollView></KeyboardFrame>;
}
const base = StyleSheet.create({ fill: { flex: 1, backgroundColor: "#F3F4F4" }, tabs: { flexDirection: "row", padding: 8, gap: 6, backgroundColor: "#FFF" }, tab: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center" }, active: { backgroundColor: "#DDEEE6" }, tabText: { fontSize: 13, fontWeight: "700" }, panel: { padding: 14, marginBottom: 10, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E4EAE6" }, unread: { backgroundColor: "#E5F4EC", borderColor: "#12805F" }, row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }, title: { fontSize: 14, fontWeight: "700", color: "#191919" }, muted: { fontSize: 12, lineHeight: 18, color: "#66736F" }, input: { padding: 12, minHeight: 44, borderRadius: 10, backgroundColor: "#F3F4F4", color: "#191919", marginVertical: 10 }, button: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderRadius: 8, backgroundColor: "#12805F", justifyContent: "center" }, buttonText: { fontSize: 12, fontWeight: "700", color: "#FFF" }, danger: { backgroundColor: "#A83737" }, error: { color: "#B42318", padding: 10, fontSize: 12 }, count: { backgroundColor: "#12805F", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }, countText: { color: "#FFF", fontSize: 12, fontWeight: "700" }, toolbar: { flexDirection: "row", gap: 8, padding: 8, backgroundColor: "#FFF" } });
