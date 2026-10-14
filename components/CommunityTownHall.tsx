import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText as Text, ThemedTextInput as TextInput, useThemedStyles } from "./ThemeProvider";
import { KeyboardFrame } from "./KeyboardFrame";
import { communityRequest } from "./communityApi";
import * as Crypto from "expo-crypto";
type Hall = {
    id: string;
    title: string;
    description: string;
    location: string;
    quantity: number;
    unit: string;
    target_unit_price: number;
    state: string;
    is_owner: boolean;
    admitted: boolean;
    seats: number;
    application_state: string;
    offers: any[];
    applications?: any[];
};
export function CommunityTownHall({ token, bottomInset, initialRoomId = "", openChat }: {
    token: string;
    bottomInset: number;
    initialRoomId?: string;
    openChat: (id: string) => Promise<void>;
}) {
    const s = useThemedStyles(styles), [items, setItems] = useState<Hall[]>([]), [room, setRoom] = useState<Hall | null>(null), [mine, setMine] = useState(false), [cursor, setCursor] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", location: "", quantity: "", unit: "", target_unit_price: "" }), [price, setPrice] = useState(""), [terms, setTerms] = useState("");
    const alive = useRef(true), flight = useRef(false), generation = useRef(0);
    const createReference = useRef({ fingerprint: "", id: "" });
    const call = (path: string, options: RequestInit = {}) => { if (path === "/chat/town-hall" && options.method === "POST") {
        const payload = JSON.parse(String(options.body)), fingerprint = JSON.stringify(payload);
        if (createReference.current.fingerprint !== fingerprint)
            createReference.current = { fingerprint, id: Crypto.randomUUID() };
        options = { ...options, body: JSON.stringify({ ...payload, client_request_id: createReference.current.id }) };
    } return communityRequest(token, path, options); };
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, [token]);
    useEffect(() => { void refresh(); }, [mine]);
    useEffect(() => { if (initialRoomId)
        void detail(initialRoomId); }, [initialRoomId]);
    async function refresh(older = "") { const seq = ++generation.current; try {
        const { data } = await call(`/chat/town-hall?limit=25&mine=${mine}${older ? `&cursor=${encodeURIComponent(older)}` : ""}`);
        if (!alive.current || seq !== generation.current)
            return;
        setItems(previous => older ? [...previous, ...data.items.filter((item: Hall) => !previous.some(old => old.id === item.id))] : data.items);
        setCursor(data.next_cursor || "");
        setError("");
    }
    catch (e) {
        if (alive.current)
            setError(e instanceof Error ? e.message : "Please retry");
    } }
    async function detail(id: string) { const seq = ++generation.current; try {
        const { data } = await call(`/chat/town-hall/${id}`);
        if (alive.current && seq === generation.current) {
            setRoom(data);
            setError("");
        }
    }
    catch (e) {
        if (alive.current)
            setError(e instanceof Error ? e.message : "Please retry");
    } }
    async function act(action: () => Promise<void>) { if (flight.current)
        return; flight.current = true; setBusy(true); setError(""); try {
        await action();
    }
    catch (e) {
        if (alive.current)
            setError(e instanceof Error ? e.message : "Please retry");
    }
    finally {
        flight.current = false;
        if (alive.current)
            setBusy(false);
    } }
    const button = (label: string, onPress: () => void) => <Pressable style={[s.button, busy && { opacity: .5 }]} disabled={busy} onPress={onPress}><Text style={s.buttonText}>{label}</Text></Pressable>;
    async function membership(provider: string, action: string) { if (!room)
        return; await call(`/chat/town-hall/${room.id}/providers/${provider}`, { method: "POST", body: JSON.stringify({ action }) }); await detail(room.id); }
    return <KeyboardFrame style={s.fill} behavior="height"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: bottomInset + 20 }}>
 {!!error && <Text style={s.error}>{error}</Text>}
 {room ? <><View style={s.row}>{button("Back to requests", () => { generation.current++; setRoom(null); void refresh(); })}{button("Refresh", () => void detail(room.id))}</View><View style={s.card}><Text style={s.title}>{room.title}</Text><Text>{room.description}</Text><Text style={s.note}>{room.location} · {room.quantity} {room.unit} · Target ₦{room.target_unit_price} per {room.unit}</Text><Text style={s.note}>{room.state === "closed" ? "Closed request" : `${room.seats}/10 provider places occupied`}</Text>
 {room.state === "open" && (room.is_owner || room.admitted) && button("Open bargaining chat", () => void act(() => openChat(room.id)))}
 {room.state === "closed" && room.is_owner && button("View chat record", () => void act(() => openChat(room.id)))}
 {room.state === "open" && !room.is_owner && !room.admitted && (room.seats >= 10 ? <Text style={s.note}>Full · A place opens when the buyer removes a provider.</Text> : room.application_state === "pending" ? <Text style={s.note}>Waiting for buyer approval.</Text> : button("Request to join", () => void act(async () => { await call(`/chat/town-hall/${room.id}/apply`, { method: "POST" }); await detail(room.id); })))}</View>
 {room.is_owner && room.state === "open" && <View style={s.card}><Text style={s.title}>Provider requests</Text>{room.applications?.map(app => <View key={app.provider_id} style={s.card}><Text>{app.name} · {app.state}</Text><View style={s.row}>{app.state === "pending" ? <>{button("Approve", () => void act(() => membership(app.provider_id, "approve")))}{button("Decline", () => void act(() => membership(app.provider_id, "decline")))}</> : app.state === "admitted" ? button("Remove", () => void act(() => membership(app.provider_id, "remove"))) : null}</View></View>)}{button("End this request", () => Alert.alert("End this request?", "It will disappear publicly. You retain the record and your private chats stay open.", [{ text: "Cancel", style: "cancel" }, { text: "End request", style: "destructive", onPress: () => void act(async () => { await call(`/chat/town-hall/${room.id}/close`, { method: "POST" }); await detail(room.id); }) }]))}</View>}
 <View style={s.card}><Text style={s.title}>Offer previews</Text><Text style={s.note}>These offers are visible to other people. Bargaining messages remain inside the admitted chat.</Text>{room.offers.map(offer => <View key={offer.id} style={s.card}><Text style={s.title}>{offer.provider_name}</Text><Text>₦{offer.unit_price} per {room.unit} · Total ₦{(Number(offer.unit_price) * Number(room.quantity)).toLocaleString()}</Text><Text>{offer.terms}</Text>{room.is_owner && room.state === "open" && button("Continue privately", () => Alert.alert("Choose this offer?", "Open a private chat and close this Town Hall request?", [{ text: "Cancel", style: "cancel" }, { text: "Choose and close", onPress: () => void act(async () => { const { data } = await call(`/chat/town-hall/${room.id}/choose`, { method: "POST", body: JSON.stringify({ offer_id: offer.id, close_room: true }) }); await openChat(data.id); }) }]))}</View>)}</View>
 {room.admitted && !room.is_owner && room.state === "open" && <View style={s.card}><Text style={s.title}>Make or update an offer</Text><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" accessibilityLabel="Offer unit price" placeholder="Price per unit, NGN" style={s.input}/><TextInput value={terms} onChangeText={setTerms} maxLength={1000} multiline accessibilityLabel="Public offer terms" placeholder="Public offer terms" style={s.input}/>{button("Publish offer", () => void act(async () => { await call(`/chat/town-hall/${room.id}/offers`, { method: "POST", body: JSON.stringify({ unit_price: Number(price), terms }) }); await detail(room.id); }))}<Text style={s.note}>An active paid plan is required to send offers and messages.</Text></View>}</> :
            <><View style={s.row}>{button(mine ? "Browse open requests" : "My requests", () => setMine(!mine))}{button(creating ? "Cancel" : "Create a request", () => setCreating(!creating))}{button("Refresh", () => void refresh())}</View>
 {creating && <View style={s.card}><Text style={s.title}>What do you need?</Text>{([['title', 'Request title'], ['description', 'Describe what you need'], ['location', 'Location'], ['quantity', 'Quantity'], ['unit', 'Unit, e.g. bag'], ['target_unit_price', 'Target price per unit, NGN']] as const).map(([key, label]) => <TextInput key={key} value={form[key]} onChangeText={value => setForm(previous => ({ ...previous, [key]: value }))} placeholder={label} accessibilityLabel={label} keyboardType={key === "quantity" || key === "target_unit_price" ? "decimal-pad" : "default"} multiline={key === "description"} style={s.input}/>)}{button("Publish request", () => void act(async () => { const { data } = await call("/chat/town-hall", { method: "POST", body: JSON.stringify({ ...form, quantity: Number(form.quantity), target_unit_price: Number(form.target_unit_price) }) }); setCreating(false); await detail(data.id); }))}</View>}
 <Text style={s.note}>Verified providers with an active paid plan may request entry. The buyer approves up to ten providers.</Text>{items.map(item => <Pressable key={item.id} onPress={() => void detail(item.id)} style={s.card}><Text style={s.title}>{item.title}</Text><Text style={s.note}>{item.location} · {item.quantity} {item.unit}</Text><Text>₦{item.target_unit_price} per {item.unit}</Text><Text style={s.note}>{item.state === "closed" ? "Closed" : `${item.seats}/10 providers · ${item.offers.length} offers`}</Text></Pressable>)}{!items.length && <Text style={s.note}>No requests to show yet.</Text>}{!!cursor && button("Load more", () => void refresh(cursor))}</>}
 </ScrollView></KeyboardFrame>;
}
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: "#F3F4F4" }, card: { padding: 14, marginVertical: 8, borderRadius: 12, backgroundColor: "#FFF" }, title: { fontSize: 14, fontWeight: "700", marginBottom: 6 }, note: { fontSize: 12, lineHeight: 18, color: "#66736F" }, row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginVertical: 6 }, button: { minHeight: 44, padding: 12, borderRadius: 8, backgroundColor: "#12805F", justifyContent: "center" }, buttonText: { fontSize: 12, fontWeight: "700", color: "#FFF" }, input: { padding: 12, minHeight: 44, maxHeight: 180, marginVertical: 8, borderRadius: 10, backgroundColor: "#F3F4F4" }, error: { fontSize: 12, color: "#B42318", paddingVertical: 8 } });
