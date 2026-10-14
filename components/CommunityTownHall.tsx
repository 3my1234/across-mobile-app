import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText as Text, ThemedTextInput as TextInput, useThemedStyles } from "./ThemeProvider";
import { KeyboardFrame } from "./KeyboardFrame";
import { communityRequest } from "./communityApi";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
type Hall = {
    id: string;
    message_only?: boolean;
    buyer_name?: string;
    created_at: string;
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
    const [form, setForm] = useState({ message: "" }), [price, setPrice] = useState(""), [terms, setTerms] = useState("");
    const alive = useRef(true), flight = useRef(false), generation = useRef(0);
    const createReference = useRef({ fingerprint: "", id: "" });
    const offerReference=useRef({fingerprint:"",id:""});
    const call = (path: string, options: RequestInit = {}) => { if (path === "/chat/town-hall" && options.method === "POST") {
        const payload = JSON.parse(String(options.body)), fingerprint = JSON.stringify(payload);
        if (createReference.current.fingerprint !== fingerprint)
            createReference.current = { fingerprint, id: Crypto.randomUUID() };
        options = { ...options, body: JSON.stringify({ ...payload, client_request_id: createReference.current.id }) };
    }if(path.endsWith('/offers')&&options.method==='POST'){const payload=JSON.parse(String(options.body)),fingerprint=JSON.stringify(payload);if(offerReference.current.fingerprint!==fingerprint)offerReference.current={fingerprint,id:Crypto.randomUUID()};options={...options,body:JSON.stringify({...payload,client_message_id:offerReference.current.id})}} return communityRequest(token, path, options); };
    useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, [token]);
    useEffect(() => { void refresh(); }, [mine]);
    useEffect(() => { if (initialRoomId)
        void detail(initialRoomId); }, [initialRoomId]);
    useEffect(()=>{if(!room)return;const subscription=Notifications.addNotificationReceivedListener(notification=>{const data=notification.request.content.data;if(data.chat_room_id===room.id||data.town_hall_room_id===room.id)void detail(room.id)});return()=>subscription.remove();},[room?.id]);
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
 {room ? <><View style={s.row}>{button("Back to requests", () => { generation.current++; setRoom(null); void refresh(); })}{button("Refresh", () => void detail(room.id))}</View><View style={s.card}><Text style={s.title}>{room.title}</Text><Text>{room.description}</Text>{!room.message_only && <Text style={s.note}>{room.location} · {room.quantity} {room.unit} · Target ₦{room.target_unit_price} per {room.unit}</Text>}<Text style={s.note}>{room.state === "closed" ? "Closed request" : `${room.seats}/10 provider places occupied`}</Text>
 {room.state === "open" && (room.is_owner || room.admitted) && button("Open bargaining chat", () => void act(() => openChat(room.id)))}
 {room.state === "closed" && room.is_owner && button("View chat record", () => void act(() => openChat(room.id)))}
 {room.state === "open" && !room.is_owner && !room.admitted && (room.seats >= 10 ? <Text style={s.note}>Full · A place opens when the buyer removes a provider.</Text> : room.application_state === "pending" ? <Text style={s.note}>Waiting for buyer approval.</Text> : button("Request to join", () => void act(async () => { await call(`/chat/town-hall/${room.id}/apply`, { method: "POST" }); await detail(room.id); })))}</View>
 {room.is_owner && room.state === "open" && <View style={s.card}><Text style={s.title}>Provider requests</Text>{room.applications?.map(app => <View key={app.provider_id} style={s.card}><Text>{app.name} · {app.state}</Text><View style={s.row}>{app.state === "pending" ? <>{button("Approve", () => void act(() => membership(app.provider_id, "approve")))}{button("Decline", () => void act(() => membership(app.provider_id, "decline")))}</> : app.state === "admitted" ? button("Remove", () => void act(() => membership(app.provider_id, "remove"))) : null}</View></View>)}{button("End this request", () => Alert.alert("End this request?", "It will disappear publicly. You retain the record and your private chats stay open.", [{ text: "Cancel", style: "cancel" }, { text: "End request", style: "destructive", onPress: () => void act(async () => { await call(`/chat/town-hall/${room.id}/close`, { method: "POST" }); await detail(room.id); }) }]))}</View>}
 <View style={s.card}><Text style={s.title}>Offer previews</Text><Text style={s.note}>These offers are visible to other people. Bargaining messages remain inside the admitted chat.</Text>{room.offers.map(offer => <View key={offer.id} style={s.card}><Text style={s.title}>{offer.provider_name}</Text><Text style={s.offerPrice}>₦{offer.unit_price}{!room.message_only ? ` per ${room.unit} · Total ₦${(Number(offer.unit_price) * Number(room.quantity)).toLocaleString()}` : ""}</Text><Text>{offer.terms}</Text>{room.is_owner && room.state === "open" && button("Continue privately", () => Alert.alert("Choose this offer?", "Open a private chat and close this Town Hall request?", [{ text: "Cancel", style: "cancel" }, { text: "Choose and close", onPress: () => void act(async () => { const { data } = await call(`/chat/town-hall/${room.id}/choose`, { method: "POST", body: JSON.stringify({ offer_id: offer.id, close_room: true }) }); await openChat(data.id); }) }]))}</View>)}</View>
 {room.admitted && !room.is_owner && room.state === "open" && <View style={s.card}><Text style={s.title}>Make or update an offer</Text><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" accessibilityLabel="Offer unit price" placeholder={room.message_only?"Offer amount, NGN":"Price per unit, NGN"} style={s.input}/><TextInput value={terms} onChangeText={setTerms} maxLength={1000} multiline accessibilityLabel="Public offer terms" placeholder="Public offer terms" style={s.input}/>{button("Publish offer", () => void act(async () => { await call(`/chat/town-hall/${room.id}/offers`, { method: "POST", body: JSON.stringify({ unit_price: Number(price), terms }) }); await detail(room.id); }))}<Text style={s.note}>An active paid plan is required to send offers and messages.</Text></View>}</> :
            <><View style={s.hero}><Text style={s.heroLabel}>● TOWN HALL</Text><Text style={s.heroTitle}>Ask. Meet. Make a deal.</Text><Text style={s.heroNote}>Post what you need, hear from providers and take your favourite offer into a private chat.</Text><Text style={s.heroLabel}>UP TO 10 PROVIDERS PER CONVERSATION</Text></View><View style={s.row}>{button(mine ? "Browse open requests" : "My requests", () => setMine(!mine))}{button(creating ? "Cancel" : "Create a request", () => setCreating(!creating))}{button("Refresh", () => void refresh())}</View>
 {creating && <View style={s.card}><Text style={s.title}>What are you looking for?</Text><TextInput value={form.message} onChangeText={message=>setForm({message})} maxLength={2000} multiline accessibilityLabel="Your Town Hall request" placeholder="I need 50 bags of rice in Abuja. My budget is ₦48,500 per bag. Who can help?" style={[s.input,{minHeight:120,textAlignVertical:'top'}]}/><Text style={s.note}>Write it in your own words.</Text>{button("Start a conversation ↗", () => void act(async () => { const { data } = await call("/chat/town-hall", { method: "POST", body: JSON.stringify({message:form.message.trim()}) }); setCreating(false);setForm({message:''}); await detail(data.id); }))}</View>}
 <Text style={s.note}>Verified providers with an active paid plan may request entry. The buyer approves up to ten providers.</Text>{items.map(item => <Pressable key={item.id} onPress={() => void detail(item.id)} style={s.card}><View style={s.requestTop}><View style={s.avatar}><Text style={s.avatarText}>{(item.buyer_name||item.title).slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.title}>{item.buyer_name||'Looking for providers'}</Text><Text style={s.note}>{new Date(item.created_at).toLocaleString()}</Text></View><Text style={s.seats}>{item.seats}/10</Text></View><Text style={s.requestMessage}>{item.description}</Text>{!item.message_only&&<Text style={s.note}>{item.location} · {item.quantity} {item.unit} · ₦{item.target_unit_price} per {item.unit}</Text>}<View style={s.requestTop}><Text style={[s.note,{flex:1}]}>{item.offers.length} offers · {item.seats>=10?'Room full':'Places available'}</Text><Text style={s.enter}>Enter →</Text></View></Pressable>)}{!items.length && <Text style={s.note}>No requests to show yet.</Text>}{!!cursor && button("Load more", () => void refresh(cursor))}</>}
 </ScrollView></KeyboardFrame>;
}
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: "#F3F4F4" }, card: { padding: 18, marginVertical: 8, borderRadius: 20, backgroundColor: "#FFF", borderWidth:1,borderColor:"#DDE7E1" }, hero:{padding:22,borderRadius:22,backgroundColor:"#126958",marginBottom:14},heroLabel:{fontSize:10,fontWeight:"800",letterSpacing:1.2,color:"#CBEEDF"},heroTitle:{fontSize:27,lineHeight:33,fontWeight:"800",color:"#FFF",marginVertical:12},heroNote:{fontSize:13,lineHeight:21,color:"#E1F3EB",marginBottom:18},requestTop:{flexDirection:"row",alignItems:"center",gap:10},avatar:{width:38,height:38,borderRadius:14,backgroundColor:"#E4F2EA",alignItems:"center",justifyContent:"center"},avatarText:{fontSize:17,fontWeight:"800",color:"#126958"},seats:{fontSize:11,fontWeight:"700",color:"#126958"},requestMessage:{fontSize:15,lineHeight:24,marginVertical:18},enter:{fontSize:12,fontWeight:"700",color:"#12805F"},offerPrice:{fontSize:18,fontWeight:"700"},title: { fontSize: 14, fontWeight: "700", marginBottom: 6 }, note: { fontSize: 12, lineHeight: 18, color: "#66736F" }, row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginVertical: 6 }, button: { minHeight: 44, padding: 12, borderRadius: 8, backgroundColor: "#12805F", justifyContent: "center" }, buttonText: { fontSize: 12, fontWeight: "700", color: "#FFF" }, input: { padding: 12, minHeight: 44, maxHeight: 180, marginVertical: 8, borderRadius: 10, backgroundColor: "#F3F4F4" }, error: { fontSize: 12, color: "#B42318", paddingVertical: 8 } });
