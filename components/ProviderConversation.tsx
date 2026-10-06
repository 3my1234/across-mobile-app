import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type ProviderMessage = { id: string; sender_type: "buyer" | "provider"; body: string; created_at: string };
type Props = { title: string; provider: string; messages: ProviderMessage[]; busy: boolean; loading: boolean; paused: boolean; error: string; hasEarlier: boolean; bottomInset: number; onClose: () => void; onSend: (text: string) => Promise<void>; onEarlier: () => void; onRefresh: () => void };
export function ProviderConversation(props: Props) {
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList<ProviderMessage>>(null);
  const nearBottom = useRef(true);
  const sending = useRef(false);
  const last = props.messages[props.messages.length - 1];
  useEffect(() => { if(nearBottom.current) requestAnimationFrame(() => list.current?.scrollToEnd({animated:false})); }, [last?.id]);
  const send = async () => { const text=draft.trim(); if(!text || props.busy || props.paused || sending.current)return; sending.current=true; try{await props.onSend(text); setDraft(""); nearBottom.current=true;}finally{sending.current=false;} };
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={s.header}><Pressable onPress={props.onClose} accessibilityLabel="Back to services" style={s.back}><Ionicons name="chevron-back" size={24} color="#191919"/></Pressable><View style={s.heading}><Text style={s.title} numberOfLines={1}>{props.provider}</Text><Text style={s.meta} numberOfLines={1}>{props.title}</Text></View></View>
    {!!props.error && <Pressable onPress={props.onRefresh}><Text style={s.error}>{props.error} · Tap to retry</Text></Pressable>}
    <FlatList ref={list} data={props.messages} keyExtractor={message=>message.id} style={s.fill} contentContainerStyle={s.thread} keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{minIndexForVisible:0}}
      onScroll={event=>{const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;nearBottom.current=contentSize.height-contentOffset.y-layoutMeasurement.height<100;}} scrollEventThrottle={100}
      onContentSizeChange={()=>{if(nearBottom.current)list.current?.scrollToEnd({animated:false});}}
      ListHeaderComponent={props.hasEarlier ? <Pressable disabled={props.loading} onPress={()=>{nearBottom.current=false;props.onEarlier();}} style={s.earlier}><Text style={s.meta}>{props.loading ? "Loading…" : "Load earlier messages"}</Text></Pressable> : null}
      ListEmptyComponent={props.loading ? <ActivityIndicator color="#FF4747"/> : !props.error ? <Text style={s.meta}>Tell {props.provider} what you need. Your messages will appear here.</Text> : null}
      renderItem={({item})=><View style={[s.bubble,item.sender_type==="buyer" ? s.mine : s.theirs]}><Text style={s.message}>{item.body}</Text><Text style={s.time}>{new Date(item.created_at).toLocaleString()}</Text></View>}/>
    {props.paused && <Text style={s.error}>This provider cannot receive messages right now. Please try again later.</Text>}
    <View style={[s.composer,{paddingBottom:props.bottomInset+8}]}><TextInput accessibilityLabel="Message provider" value={draft} onChangeText={setDraft} editable={!props.busy && !props.paused} placeholder="Write a message…" multiline maxLength={2000} style={s.input}/><Pressable accessibilityLabel="Send provider message" disabled={props.busy||props.paused||!draft.trim()} onPress={()=>void send().catch(()=>{})} style={[s.send,(props.busy||props.paused||!draft.trim())&&s.disabled]}>{props.busy ? <ActivityIndicator color="#FFF"/> : <Ionicons name="arrow-up" size={23} color="#FFF"/>}</Pressable></View>
  </KeyboardAvoidingView>;
}
const s=StyleSheet.create({fill:{flex:1,backgroundColor:"#F3F4F4"},header:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",paddingVertical:10,paddingRight:12},back:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"},heading:{flex:1},title:{fontSize:16,fontWeight:"800",color:"#191919"},meta:{fontSize:12,color:"#66736F"},error:{padding:10,color:"#B42318"},thread:{padding:12,flexGrow:1,gap:10},bubble:{maxWidth:"84%",padding:12,borderRadius:16},mine:{alignSelf:"flex-end",backgroundColor:"#FFF0D6",borderBottomRightRadius:4},theirs:{alignSelf:"flex-start",backgroundColor:"#FFF",borderBottomLeftRadius:4},message:{color:"#191919",lineHeight:20},time:{fontSize:10,color:"#66736F",marginTop:5},earlier:{padding:12,alignItems:"center"},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,backgroundColor:"#FFF",paddingHorizontal:12,paddingTop:8},input:{flex:1,minHeight:44,maxHeight:120,backgroundColor:"#F3F4F4",padding:12,borderRadius:20,color:"#191919"},send:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4747"},disabled:{opacity:.45}});
