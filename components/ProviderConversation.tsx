import {TownHallIcon} from "./TownHallIcon";
import {useMessageReceipts,ReceiptContext} from './messageReceipts';
import {MessageReceipt} from './MessageReceipt';
import {currentForegroundLocation} from './foregroundLocation';
import {ChatLocation} from './chatLocation';
import {LocationPin} from './LocationPin';
import {TownHallMessage} from './TownHallMessage';
import {ProviderBanner, ProviderIdentity, ProviderBadge, ProviderIdentityData} from "./ProviderIdentity";
import {ChatPhotoViewer} from "./ChatPhotoViewer";
import { KeyboardFrame } from "./KeyboardFrame";
import { useTheme, useThemedStyles, ThemedText as Text, ThemedTextInput as TextInput } from "./ThemeProvider";
import React, { useEffect, useRef, useState } from "react";
import {ActivityIndicator, Alert, AppState, BackHandler, Image, ScrollView, FlatList, Platform, Pressable, StyleSheet,   View} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { uploadChatImage } from "./chatImages";
import { Ionicons } from "@expo/vector-icons";

export type ProviderMessage = { id: string; sender_type: "buyer" | "provider"; sender_name?:string; is_mine?:boolean; body: string; location?:ChatLocation|null; media_urls?:string[]; created_at: string };
type Props = { townHallOrigin?:boolean; receiptContext?:ReceiptContext; roomStyle?:boolean; avatarURL?:string; token:string; title: string; provider: string; identity?:ProviderIdentityData; messages: ProviderMessage[]; toolbar?:React.ReactNode; pausedLabel?:string; busy: boolean; loading: boolean; paused: boolean; error: string; hasEarlier: boolean; bottomInset: number; onClose: () => void; onSend: (text: string,mediaKeys?:string[],clientID?:string,location?:ChatLocation) => Promise<void>; onEarlier: () => void; onRefresh: () => void };
export function ProviderConversation(props: Props) {
  const [visibleMessages,setVisibleMessages]=useState<string[]>([]);
  const onVisibleMessages=useRef(({viewableItems}:any)=>setVisibleMessages(viewableItems.filter((entry:any)=>entry.isViewable).map((entry:any)=>entry.item.id))).current;
  const visibilityConfig=useRef({minimumViewTime:750,itemVisiblePercentThreshold:50}).current;
  const receipts=useMessageReceipts(props.token,props.receiptContext,props.messages.map(m=>({id:m.id,mine:m.is_mine??m.sender_type==='buyer'})),visibleMessages);
  const theme = useTheme();
  const s = useThemedStyles(baseStyles);
  const {onClose}=props;
  const [sendingMessage,setSendingMessage]=useState(false),[sendError,setSendError]=useState('');
  const [draft, setDraft] = useState("");
  const [pin,setPin]=useState<ChatLocation|undefined>();
  const [locating,setLocating]=useState(false);
  const locationFlight=useRef(false);
  const [photos,setPhotos]=useState<{key:string;uri:string}[]>([]);
  const [uploading,setUploading]=useState(false);
  const [viewPhoto,setViewPhoto]=useState<string|null>(null);
  const mounted=useRef(true),uploadFlight=useRef(false);
  const messageReference=useRef({fingerprint:"",id:""});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function attachLocation(){
   if(locationFlight.current||props.paused||props.busy)return;
   locationFlight.current=true;
   Alert.alert('Share your current location?',props.roomStyle?'This exact location pin will be visible to everyone admitted to this Town Hall room.':'This exact location pin will be visible to the other person in this conversation.',[{text:'Cancel',style:'cancel',onPress:()=>{locationFlight.current=false;}},{text:'Choose location',onPress:()=>{void (async()=>{locationFlight.current=true;setLocating(true);try{const result=await currentForegroundLocation();if(result.coords.accuracy!=null&&result.coords.accuracy>5000)throw Error('Wait for a more accurate location, then retry.');if(mounted.current&&AppState.currentState==='active')setPin({latitude:result.coords.latitude,longitude:result.coords.longitude,...(result.coords.accuracy!=null?{accuracy_m:result.coords.accuracy}:{})});}catch(error){if(mounted.current)Alert.alert('Location unavailable',error instanceof Error?error.message:'Please retry.');}finally{locationFlight.current=false;if(mounted.current)setLocating(false);}})();}}]);
  }
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
    const text=draft.trim();if((!text && !photos.length && !pin) || uploading || locating || props.busy || props.paused || sending.current)return;
    sending.current=true;setSendingMessage(true);setSendError('');
    try{
      const keys=photos.map(photo=>photo.key),fingerprint=JSON.stringify([text,keys,pin]);
      if(messageReference.current.fingerprint!==fingerprint)messageReference.current={fingerprint,id:Crypto.randomUUID()};
      await props.onSend(text,keys,messageReference.current.id,pin);if(mounted.current){setDraft("");setPhotos([]);setPin(undefined);messageReference.current={fingerprint:"",id:""};nearBottom.current=true;}}
    catch(error){if(mounted.current)setSendError(error instanceof Error?error.message:'Message could not be sent. Please retry.');}
    finally{sending.current=false;if(mounted.current)setSendingMessage(false);}
  };
  return <KeyboardFrame style={s.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={s.header}><Pressable onPress={props.onClose} accessibilityLabel="Back to conversations" style={s.back}><Ionicons name="arrow-back" size={24} color={theme.dark?'#FFF':'#17251F'}/></Pressable>{props.roomStyle||props.townHallOrigin?<View style={{marginRight:10}}><TownHallIcon size={40}/></View>:<View style={{width:40,height:40,borderRadius:20,backgroundColor:theme.dark?'#2A3942':'#DCE9E2',alignItems:'center',justifyContent:'center',marginRight:10}}>{(props.identity?.avatar_url||props.avatarURL)?<Image source={{uri:props.identity?.avatar_url||props.avatarURL}} style={{width:40,height:40,borderRadius:20}}/>:<Text style={{fontSize:19,fontWeight:'700'}}>{props.provider.slice(0,1).toUpperCase()}</Text>}</View>}<View style={s.heading}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={s.title} numberOfLines={1}>{props.roomStyle?'Town Hall':props.provider}</Text>{props.identity&&<ProviderBadge identity={props.identity}/>}</View><Text style={s.meta} numberOfLines={1}>{props.roomStyle?'Bargaining room':props.title===props.provider?'Private conversation':props.title}</Text></View></View>
    {!props.roomStyle&&<ProviderBanner identity={props.identity} compact/>}
    {props.toolbar}
    {!!props.error&&!sendError && <Pressable onPress={props.onRefresh}><Text style={s.error}>{props.error} · Tap to retry</Text></Pressable>}
    <FlatList ref={list} onViewableItemsChanged={onVisibleMessages} viewabilityConfig={visibilityConfig} data={props.messages} keyExtractor={message=>message.id} style={s.fill} contentContainerStyle={[s.thread,props.roomStyle&&{backgroundColor:theme.dark?"#142A35":"#EDF4F8",gap:1}]} keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{minIndexForVisible:0}}
      onScroll={event=>{const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;nearBottom.current=contentSize.height-contentOffset.y-layoutMeasurement.height<100;}} scrollEventThrottle={100}
      onContentSizeChange={()=>{if(nearBottom.current)list.current?.scrollToEnd({animated:false});}}
      ListHeaderComponent={props.hasEarlier ? <Pressable disabled={props.loading} onPress={()=>{nearBottom.current=false;props.onEarlier();}} style={s.earlier}><Text style={s.meta}>{props.loading ? "Loading…" : "Earlier messages"}</Text></Pressable> : props.roomStyle?<Text style={{fontSize:11,textAlign:"center",paddingBottom:12}}>Welcome to the room · {props.title}</Text>:null}
      ListEmptyComponent={props.loading ? <ActivityIndicator color={theme.color("#FF4747")}/> : !props.error ? <Text style={s.meta}>{props.roomStyle ? "Providers can start replying once admitted. Messages will appear here." : `Message ${props.provider} to get started.`}</Text> : null}
      renderItem={({item})=>props.roomStyle?<TownHallMessage message={item} receipt={receipts[item.id]} onPhoto={setViewPhoto}/>:<View style={[s.bubble,(item.is_mine ?? item.sender_type==="buyer") ? s.mine : s.theirs,{backgroundColor:(item.is_mine ?? item.sender_type==="buyer")?(theme.dark?"#005C4B":"#D9FDD3"):(theme.dark?"#202C33":"#FFF")}]}>{item.sender_name && !item.is_mine && <Text style={s.meta}>{item.sender_name}</Text>}<Text style={s.message}>{item.body}</Text><LocationPin pin={item.location}/>{(item.media_urls || []).map(uri=><Pressable key={uri} onPress={()=>setViewPhoto(uri)} accessibilityLabel="View chat photo"><Image source={{uri}} style={{width:200,height:180,borderRadius:10,marginTop:6}} resizeMode="cover"/></Pressable>)}<View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:5}}><Text style={s.time}>{new Date(item.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</Text>{(item.is_mine??item.sender_type==="buyer")&&<MessageReceipt receipt={receipts[item.id]}/>}</View></View>}/>
    {props.paused && <Text style={s.error}>{props.pausedLabel || "This provider cannot receive messages right now. Please try again later."}</Text>}
    {!!photos.length && <ScrollView horizontal style={{flexGrow:0,maxHeight:90,backgroundColor: theme.color("#FFF", "backgroundColor")}}>{photos.map(photo=><Pressable key={photo.key} onPress={()=>{if(!props.busy && !uploading)setPhotos(current=>current.filter(item=>item.key!==photo.key));}} accessibilityLabel="Remove attached photo"><Image source={{uri:photo.uri}} style={{width:72,height:72,margin:6,borderRadius:8}}/><Text style={{position:"absolute",right:9,top:6,color: theme.color("#B42318", "color")}}>X</Text></Pressable>)}</ScrollView>}
    <ChatPhotoViewer key={viewPhoto || "closed"} uri={viewPhoto} onClose={()=>setViewPhoto(null)}/>
    {pin&&<View style={{paddingHorizontal:12,flexDirection:'row',alignItems:'center'}}><LocationPin pin={pin} draft/><Pressable disabled={sendingMessage||props.busy} onPress={()=>setPin(undefined)} accessibilityLabel="Remove location pin"><Text>Remove</Text></Pressable></View>}
    {!!sendError&&<Text accessibilityRole="alert" style={s.error}>Message not confirmed: {sendError} Tap Send to retry.</Text>}
    <View style={[s.composer,{paddingBottom:8}]}><Pressable accessibilityLabel="Attach photos" disabled={sendingMessage||uploading||props.busy||props.paused||photos.length>=4} onPress={()=>void attach()} style={s.send}>{uploading?<ActivityIndicator color={theme.color("#FFF")}/>:<Ionicons name="image-outline" size={22} color={theme.color("#FFF")}/>}</Pressable><Pressable accessibilityLabel="Share location pin" disabled={sendingMessage||props.busy||props.paused||locating||uploading} onPress={()=>void attachLocation()} style={s.send}>{locating?<ActivityIndicator color="#FFF"/>:<Ionicons name="location-outline" size={22} color="#FFF"/>}</Pressable><TextInput accessibilityLabel="Message provider" value={draft} onChangeText={setDraft} editable={!sendingMessage&&!props.busy && !props.paused && !uploading} placeholder="Write a message…" multiline maxLength={2000} style={s.input}/><Pressable accessibilityLabel="Send provider message" disabled={sendingMessage||uploading||locating||props.busy||props.paused||(!draft.trim()&&!photos.length&&!pin)} onPress={()=>void send()} style={[s.send,(sendingMessage||uploading||props.busy||props.paused||(!draft.trim()&&!photos.length&&!pin))&&s.disabled]}>{(props.busy||sendingMessage) ? <ActivityIndicator color={theme.color("#FFF")}/> : <Ionicons name="arrow-up" size={23} color={theme.color("#FFF")}/>}</Pressable></View>
  </KeyboardFrame>;
}
const baseStyles = StyleSheet.create({fill:{flex:1,backgroundColor:"#F3F4F4"},header:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",paddingVertical:10,paddingRight:12},back:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"},heading:{flex:1},title:{fontSize:16,fontWeight:"800",color:"#191919"},meta:{fontSize:12,color:"#66736F"},error:{padding:10,color:"#B42318"},thread:{padding:12,flexGrow:1,gap:10},bubble:{maxWidth:"84%",padding:12,borderRadius:16},mine:{alignSelf:"flex-end",backgroundColor:"#D9FDD3",borderBottomRightRadius:4},theirs:{alignSelf:"flex-start",backgroundColor:"#FFF",borderBottomLeftRadius:4},message:{color:"#191919",lineHeight:20},time:{fontSize:10,color:"#66736F",marginTop:5},earlier:{padding:12,alignItems:"center"},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,backgroundColor:"#FFF",paddingHorizontal:12,paddingTop:8},input:{flex:1,minWidth:0,minHeight:44,maxHeight:120,backgroundColor:"#F3F4F4",padding:12,borderRadius:20,color:"#191919"},send:{width:44,height:44,flexShrink:0,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#12805F"},disabled:{opacity:.45}});
