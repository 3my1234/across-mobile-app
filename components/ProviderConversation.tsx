import { useTheme, useThemedStyles, ThemedText as Text, ThemedTextInput as TextInput } from "./ThemeProvider";
import React, { useEffect, useRef, useState } from "react";
import {ActivityIndicator, Alert, BackHandler, Image, Modal, ScrollView, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet,   View} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { uploadChatImage } from "./chatImages";
import { Ionicons } from "@expo/vector-icons";

export type ProviderMessage = { id: string; sender_type: "buyer" | "provider"; body: string; media_urls?:string[]; created_at: string };
type Props = { token:string; title: string; provider: string; messages: ProviderMessage[]; busy: boolean; loading: boolean; paused: boolean; error: string; hasEarlier: boolean; bottomInset: number; onClose: () => void; onSend: (text: string,mediaKeys?:string[],clientID?:string) => Promise<void>; onEarlier: () => void; onRefresh: () => void };
export function ProviderConversation(props: Props) {
  const theme = useTheme();
  const s = useThemedStyles(baseStyles);
  const {onClose}=props;
  const [draft, setDraft] = useState("");
  const [photos,setPhotos]=useState<{key:string;uri:string}[]>([]);
  const [uploading,setUploading]=useState(false);
  const [viewPhoto,setViewPhoto]=useState<string|null>(null);
  const mounted=useRef(true),uploadFlight=useRef(false);
  const messageReference=useRef({fingerprint:"",id:""});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function attach() {
    if(uploadFlight.current || props.busy || props.paused || photos.length>=4)return;
    uploadFlight.current=true;setUploading(true);
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted)throw new Error("Allow photo access in your phone settings.");
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsMultipleSelection:true,selectionLimit:4-photos.length,quality:0.8});
      if(result.canceled)return;
      for(const asset of result.assets.slice(0,4-photos.length)) {
        const photo=await uploadChatImage(props.token,asset);
        if(!mounted.current)return;
        setPhotos(current=>[...current,photo]);
      }
    }catch(error){if(mounted.current)Alert.alert("Photo not attached",error instanceof Error?error.message:"Please try again.");}
    finally{uploadFlight.current=false;if(mounted.current)setUploading(false);}
  }
  useEffect(()=>{const back=BackHandler.addEventListener("hardwareBackPress",()=>{onClose();return true;});return()=>back.remove();},[onClose]);
  const list = useRef<FlatList<ProviderMessage>>(null);
  const nearBottom = useRef(true);
  const sending = useRef(false);
  const last = props.messages[props.messages.length - 1];
  useEffect(() => { if(nearBottom.current) requestAnimationFrame(() => list.current?.scrollToEnd({animated:false})); }, [last?.id]);
  const send = async () => {
    const text=draft.trim();if((!text && !photos.length) || uploading || props.busy || props.paused || sending.current)return;
    sending.current=true;
    const keys=photos.map(photo=>photo.key),fingerprint=JSON.stringify([text,keys]);
    if(messageReference.current.fingerprint!==fingerprint)messageReference.current={fingerprint,id:Crypto.randomUUID()};
    try{await props.onSend(text,keys,messageReference.current.id);if(mounted.current){setDraft("");setPhotos([]);messageReference.current={fingerprint:"",id:""};nearBottom.current=true;}}
    finally{sending.current=false;}
  };
  return <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={s.header}><Pressable onPress={props.onClose} accessibilityLabel="Back to conversations" style={s.back}><Ionicons name="chevron-back" size={24} color={theme.color("#191919")}/></Pressable><View style={s.heading}><Text style={s.title} numberOfLines={1}>{props.provider}</Text><Text style={s.meta} numberOfLines={1}>{props.title}</Text></View></View>
    {!!props.error && <Pressable onPress={props.onRefresh}><Text style={s.error}>{props.error} · Tap to retry</Text></Pressable>}
    <FlatList ref={list} data={props.messages} keyExtractor={message=>message.id} style={s.fill} contentContainerStyle={s.thread} keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{minIndexForVisible:0}}
      onScroll={event=>{const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;nearBottom.current=contentSize.height-contentOffset.y-layoutMeasurement.height<100;}} scrollEventThrottle={100}
      onContentSizeChange={()=>{if(nearBottom.current)list.current?.scrollToEnd({animated:false});}}
      ListHeaderComponent={props.hasEarlier ? <Pressable disabled={props.loading} onPress={()=>{nearBottom.current=false;props.onEarlier();}} style={s.earlier}><Text style={s.meta}>{props.loading ? "Loading…" : "Load earlier messages"}</Text></Pressable> : null}
      ListEmptyComponent={props.loading ? <ActivityIndicator color={theme.color("#FF4747")}/> : !props.error ? <Text style={s.meta}>Tell {props.provider} what you need. Your messages will appear here.</Text> : null}
      renderItem={({item})=><View style={[s.bubble,item.sender_type==="buyer" ? s.mine : s.theirs]}><Text style={s.message}>{item.body}</Text>{(item.media_urls || []).map(uri=><Pressable key={uri} onPress={()=>setViewPhoto(uri)} accessibilityLabel="View chat photo"><Image source={{uri}} style={{width:200,height:180,borderRadius:10,marginTop:6}} resizeMode="cover"/></Pressable>)}<Text style={s.time}>{new Date(item.created_at).toLocaleString()}</Text></View>}/>
    {props.paused && <Text style={s.error}>This provider cannot receive messages right now. Please try again later.</Text>}
    {!!photos.length && <ScrollView horizontal style={{flexGrow:0,maxHeight:90,backgroundColor: theme.color("#FFF", "backgroundColor")}}>{photos.map(photo=><Pressable key={photo.key} onPress={()=>{if(!props.busy && !uploading)setPhotos(current=>current.filter(item=>item.key!==photo.key));}} accessibilityLabel="Remove attached photo"><Image source={{uri:photo.uri}} style={{width:72,height:72,margin:6,borderRadius:8}}/><Text style={{position:"absolute",right:9,top:6,color: theme.color("#B42318", "color")}}>X</Text></Pressable>)}</ScrollView>}
    <Modal visible={!!viewPhoto} onRequestClose={()=>setViewPhoto(null)}><View style={{flex:1,backgroundColor: theme.color("#111", "backgroundColor"),paddingTop:50}}><Pressable onPress={()=>setViewPhoto(null)} accessibilityLabel="Close photo" style={{padding:15}}><Text style={{color: theme.color("#FFF", "color")}}>Close</Text></Pressable>{viewPhoto && <Image source={{uri:viewPhoto}} resizeMode="contain" style={{flex:1}}/>}</View></Modal>
    <View style={[s.composer,{paddingBottom:props.bottomInset+8}]}><Pressable accessibilityLabel="Attach photos" disabled={uploading||props.busy||props.paused||photos.length>=4} onPress={()=>void attach()} style={s.send}>{uploading?<ActivityIndicator color={theme.color("#FFF")}/>:<Ionicons name="image-outline" size={22} color={theme.color("#FFF")}/>}</Pressable><TextInput accessibilityLabel="Message provider" value={draft} onChangeText={setDraft} editable={!props.busy && !props.paused && !uploading} placeholder="Write a message…" multiline maxLength={2000} style={s.input}/><Pressable accessibilityLabel="Send provider message" disabled={uploading||props.busy||props.paused||(!draft.trim()&&!photos.length)} onPress={()=>void send().catch(()=>{})} style={[s.send,(uploading||props.busy||props.paused||(!draft.trim()&&!photos.length))&&s.disabled]}>{props.busy ? <ActivityIndicator color={theme.color("#FFF")}/> : <Ionicons name="arrow-up" size={23} color={theme.color("#FFF")}/>}</Pressable></View>
  </KeyboardAvoidingView>;
}
const baseStyles = StyleSheet.create({fill:{flex:1,backgroundColor:"#F3F4F4"},header:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",paddingVertical:10,paddingRight:12},back:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"},heading:{flex:1},title:{fontSize:16,fontWeight:"800",color:"#191919"},meta:{fontSize:12,color:"#66736F"},error:{padding:10,color:"#B42318"},thread:{padding:12,flexGrow:1,gap:10},bubble:{maxWidth:"84%",padding:12,borderRadius:16},mine:{alignSelf:"flex-end",backgroundColor:"#FFF0D6",borderBottomRightRadius:4},theirs:{alignSelf:"flex-start",backgroundColor:"#FFF",borderBottomLeftRadius:4},message:{color:"#191919",lineHeight:20},time:{fontSize:10,color:"#66736F",marginTop:5},earlier:{padding:12,alignItems:"center"},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,backgroundColor:"#FFF",paddingHorizontal:12,paddingTop:8},input:{flex:1,minHeight:44,maxHeight:120,backgroundColor:"#F3F4F4",padding:12,borderRadius:20,color:"#191919"},send:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4747"},disabled:{opacity:.45}});
