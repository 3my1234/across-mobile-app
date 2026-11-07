import {chooseLibraryMedia} from './mediaLibraryPicker';
import {KeyboardScrollView as ScrollView} from './KeyboardScroll';
import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, Pressable,  StyleSheet, Switch, View } from "react-native";
import * as Crypto from "expo-crypto";
import { ThemedText as Text, ThemedTextInput as TextInput, useThemedStyles } from "./ThemeProvider";
import { communityRequest } from "./communityApi";
import { uploadChatImage } from "./chatImages";
import { ChatPhotoViewer } from "./ChatPhotoViewer";
import { KeyboardFrame } from "./KeyboardFrame";
import { ProviderIdentity } from "./ProviderIdentity";
type Status = {
    id: string;
    user_id: string;
    name: string;
    handle: string;
    body: string;
    media_urls: string[];
    expires_at: string;
    is_mine: boolean;
};
export function CommunityUpdates({ token, bottomInset, openChat }: {
    token: string;
    bottomInset: number;
    openChat: (id: string) => Promise<void>;
}) {
    const s = useThemedStyles(styles), [items, setItems] = useState<Status[]>([]), [friends, setFriends] = useState<any[]>([]), [draft, setDraft] = useState(""), [photos, setPhotos] = useState<{
        key: string;
        uri: string;
    }[]>([]);
    const [selectedOnly, setSelectedOnly] = useState(false), [recipients, setRecipients] = useState<string[]>([]), [promotions, setPromotions] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [cursor, setCursor] = useState(""), [photo, setPhoto] = useState<string | null>(null);
    const alive = useRef(true), flight = useRef(false), reference = useRef({ fingerprint: "", id: "" });
    const [advertisements, setAdvertisements] = useState<any[]>([]), [city, setCity] = useState(""),[category,setCategory]=useState("");
    const adReferences = useRef(new Map<string, string>());
    const call = (path: string, options: RequestInit = {}) => communityRequest(token, path, options);
    useEffect(() => { alive.current = true; void refresh(); void call("/chat/profile").then(({ data }) => { if (alive.current) {
        setPromotions(data.connection_promotions);
        if (data.connection_promotions)
            void loadPromotions();
    } }).catch(() => { }); return () => { alive.current = false; }; }, [token]);
    async function loadPromotions() { const { data } = await call(`/chat/promotions?country=NG&city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}`); if (alive.current)
        setAdvertisements(data.items || []); }
    async function refresh(older = "") { try {
        const { data } = await call(`/chat/statuses?limit=25${older ? `&cursor=${encodeURIComponent(older)}` : ""}`);
        if (!alive.current)
            return;
        setItems(previous => older ? [...previous, ...data.items.filter((item: Status) => !previous.some(old => old.id === item.id))] : data.items);
        setCursor(data.next_cursor || "");
        setError("");
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
    async function loadFriends() { const all: any[] = []; let next = ""; do {
        const { data } = await call(`/chat/friends?limit=100${next ? `&cursor=${encodeURIComponent(next)}` : ""}`);
        all.push(...data.items.filter((item: any) => item.state === "accepted"));
        next = data.next_cursor || "";
    } while (next && all.length < 100 && alive.current); if (alive.current)
        setFriends(all.slice(0, 100)); }
    async function attach() { const result = await chooseLibraryMedia({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 4 - photos.length, quality: .8 }); if (result.canceled)
        return; for (const asset of result.assets.slice(0, 4 - photos.length)) {
        const uploaded = await uploadChatImage(token, asset);
        if (!alive.current)
            return;
        setPhotos(previous => [...previous, uploaded]);
    } }
    async function publish() { if (!draft.trim() && !photos.length)
        return; if (selectedOnly && !recipients.length)
        throw Error("Choose at least one friend."); const payload = { message: draft.trim(), media_keys: photos.map(item => item.key), audience: selectedOnly ? "selected" : "friends", recipients: selectedOnly ? recipients : [] }; const fingerprint = JSON.stringify(payload); if (reference.current.fingerprint !== fingerprint)
        reference.current = { fingerprint, id: Crypto.randomUUID() }; await call("/chat/statuses", { method: "POST", body: JSON.stringify({ ...payload, client_message_id: reference.current.id }) }); if (!alive.current)
        return; setDraft(""); setPhotos([]); reference.current = { fingerprint: "", id: "" }; await refresh(); }
    return <KeyboardFrame style={s.fill} behavior="height"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12, paddingBottom: bottomInset + 20 }}>
 <View style={s.card}><Text style={s.title}>Share an update</Text><Text style={s.note}>Visible to your chosen friends for 24 hours.</Text><TextInput style={s.input} accessibilityLabel="Status update" multiline maxLength={2000} placeholder="What would you like to share?" value={draft} onChangeText={setDraft} editable={!busy}/>
 <View style={s.row}><Switch accessibilityLabel="Share with selected friends only" disabled={busy} value={selectedOnly} onValueChange={value => { setSelectedOnly(value); if (value)
        void act(loadFriends); }}/><Text style={s.note}>Selected friends only</Text></View>
 {selectedOnly && friends.map(friend => <Pressable key={friend.id} disabled={busy} onPress={() => setRecipients(previous => previous.includes(friend.user_id) ? previous.filter(id => id !== friend.user_id) : [...previous, friend.user_id])} style={s.choice}><Text>{recipients.includes(friend.user_id) ? "✓ " : "○ "}{friend.name} · @{friend.handle}</Text></Pressable>)}
 <View style={s.row}>{photos.map(item => <Pressable key={item.key} disabled={busy} onPress={() => setPhotos(previous => previous.filter(old => old.key !== item.key))} accessibilityLabel="Remove status photo"><Image source={{ uri: item.uri }} style={s.thumb}/></Pressable>)}</View>
 <View style={s.row}><Pressable disabled={busy || photos.length >= 4} style={s.button} onPress={() => void act(attach)}><Text style={s.buttonText}>Add photos</Text></Pressable><Pressable disabled={busy || (!draft.trim() && !photos.length)} style={s.button} onPress={() => void act(publish)}><Text style={s.buttonText}>{busy ? "Please wait…" : "Post update"}</Text></Pressable></View></View>
 <View style={s.card}><Text style={s.title}>Provider promotions</Text><Text style={s.note}>Allow labelled paid-provider promotions through your accepted friends, up to three connections away. This is separate from username discovery.</Text><View style={s.row}><Switch accessibilityLabel="Allow connection-based provider promotions" value={promotions} disabled={busy} onValueChange={value => void act(async () => { const { data } = await call("/chat/profile", { method: "PATCH", body: JSON.stringify({ connection_promotions: value }) }); if (alive.current) {
        setPromotions(data.connection_promotions);
        if (!value)
            setAdvertisements([]);
        else
            await loadPromotions();
    } })}/><Text style={s.note}>{promotions ? "Enabled" : "Disabled"}</Text></View>{promotions && <><TextInput value={city} onChangeText={setCity} style={s.input} maxLength={100} placeholder="City (optional)" accessibilityLabel="Promotion city"/><TextInput value={category} onChangeText={setCategory} style={s.input} maxLength={100} placeholder="Category (optional)" accessibilityLabel="Promotion category"/><Pressable style={s.button} disabled={busy} onPress={() => void act(loadPromotions)}><Text style={s.buttonText}>Refresh relevant promotions</Text></Pressable></>}</View>
 {!!error && <Text style={s.error}>{error}</Text>}<Pressable style={s.button} onPress={() => void refresh()}><Text style={s.buttonText}>Refresh updates</Text></Pressable>
 {items.filter(item => Date.parse(item.expires_at) > Date.now()).map(item => <View key={item.id} style={s.card}><Text style={s.title}>{item.name} · @{item.handle}</Text><Text>{item.body}</Text><View style={s.row}>{item.media_urls.map(uri => <Pressable key={uri} onPress={() => setPhoto(uri)} accessibilityLabel="View status photo"><Image source={{ uri }} style={s.image}/></Pressable>)}</View><Text style={s.note}>Expires {new Date(item.expires_at).toLocaleTimeString()}</Text>{item.is_mine && <Pressable disabled={busy} onPress={() => Alert.alert("Delete this update?", "It will disappear from your friends’ feed.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void act(async () => { await call(`/chat/statuses/${item.id}`, { method: "DELETE" }); await refresh(); }) }])}><Text style={s.error}>Delete update</Text></Pressable>}</View>)}
 {!items.length && <Text style={s.note}>Updates shared with you appear here.</Text>}{!!cursor && <Pressable onPress={() => void refresh(cursor)} style={s.button}><Text style={s.buttonText}>Load more</Text></Pressable>}
 {promotions && advertisements.map(ad => <View key={`${ad.kind}:${ad.id}`} style={s.card}><Text style={s.note}>{ad.label}</Text><ProviderIdentity identity={ad.provider_identity}/><Text style={s.title}>{ad.title}</Text>{!!ad.image_url && <Pressable onPress={() => setPhoto(ad.image_url)}><Image source={{ uri: ad.image_url }} style={s.image}/></Pressable>}<Pressable style={s.button} disabled={busy} onPress={() => void act(async () => { let client = adReferences.current.get(ad.id); if (!client) {
        client = Crypto.randomUUID();
        adReferences.current.set(ad.id, client);
    } const { data } = await call(`/marketplace/${ad.kind === "product" ? "products" : "listings"}/${ad.id}/conversations`, { method: "POST", body: JSON.stringify({ message: `I'd like to ask about ${ad.title}`, client_message_id: client }) }); await openChat(data.conversation_id || data.id); })}><Text style={s.buttonText}>Message provider</Text></Pressable></View>)}
 </ScrollView><ChatPhotoViewer uri={photo} onClose={() => setPhoto(null)}/></KeyboardFrame>;
}
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: "#F3F4F4" }, card: { padding: 14, marginVertical: 8, borderRadius: 12, backgroundColor: "#FFF" }, title: { fontSize: 14, fontWeight: "700", marginBottom: 6 }, note: { fontSize: 12, lineHeight: 18, color: "#66736F" }, input: { minHeight: 80, maxHeight: 180, padding: 12, marginVertical: 8, borderRadius: 10, backgroundColor: "#F3F4F4" }, row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginVertical: 6 }, button: { minHeight: 44, padding: 12, borderRadius: 8, backgroundColor: "#12805F", justifyContent: "center" }, buttonText: { fontSize: 12, fontWeight: "700", color: "#FFF" }, thumb: { width: 64, height: 64, borderRadius: 8 }, image: { width: 130, height: 130, borderRadius: 8 }, choice: { minHeight: 44, justifyContent: "center" }, error: { fontSize: 12, color: "#B42318", paddingVertical: 8 } });
