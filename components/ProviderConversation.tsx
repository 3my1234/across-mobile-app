import {chooseLibraryMedia} from './mediaLibraryPicker';
import {ChatMessageText} from './ChatMessageText';
import {TownHallIcon} from "./TownHallIcon";
import {useMessageReceipts,ReceiptContext} from './messageReceipts';
import {MessageReceipt} from './MessageReceipt';
import {captureChatLocation,chatDraftFromMap,chatDraftNeedsRefresh,ChatLocationDraft} from './chatLocationCapture';
import {NativeProviderLocationPicker} from './NativeProviderLocationPicker';
import {ChatLocation} from './chatLocation';
import {LocationPin} from './LocationPin';
import {TownHallMessage} from './TownHallMessage';
import {ProviderProfileHeader, ProviderIdentity, ProviderBadge, ProviderIdentityData} from "./ProviderIdentity";
import {ChatPhotoViewer} from "./ChatPhotoViewer";
import { KeyboardFrame } from "./KeyboardFrame";
import { useTheme, useThemedStyles, ThemedText as Text, ThemedTextInput as TextInput } from "./ThemeProvider";
import React, { useEffect, useRef, useState } from "react";
import {ActivityIndicator, Alert, AppState, BackHandler, Image, ScrollView, FlatList, Platform, Pressable, StyleSheet,   View} from "react-native";
import * as Crypto from "expo-crypto";
import { uploadChatImage } from "./chatImages";
import { Ionicons } from "@expo/vector-icons";

export type MessageReply={id:string;sender_name:string;body:string;has_media?:boolean;has_location?:boolean};
export type ProviderMessage = { id: string; context?:{title?:string;listing_id?:string;product_id?:string}; reply_to?:MessageReply|null; sender_type: "buyer" | "provider"; sender_name?:string; is_mine?:boolean; body: string; location?:ChatLocation|null; media_urls?:string[]; created_at: string };
type Props = { townHallOrigin?:boolean; receiptContext?:ReceiptContext; roomStyle?:boolean; avatarURL?:string; token:string; title: string; provider: string; identity?:ProviderIdentityData; messages: ProviderMessage[]; toolbar?:React.ReactNode; pausedLabel?:string; busy: boolean; loading: boolean; paused: boolean; error: string; hasEarlier: boolean; bottomInset: number; onClose: () => void; onSend: (text: string,mediaKeys?:string[],clientID?:string,location?:ChatLocation,replyToID?:string) => Promise<void>; onEarlier: () => void; onRefresh: () => void };
export function ProviderConversation(props: Props) {
  const [visibleMessages,setVisibleMessages]=useState<string[]>([]);
  const onVisibleMessages=useRef(({viewableItems}:any)=>setVisibleMessages(viewableItems.filter((entry:any)=>entry.isViewable).map((entry:any)=>entry.item.id))).current;
  const visibilityConfig=useRef({minimumViewTime:750,itemVisiblePercentThreshold:50}).current;
  const receipts=useMessageReceipts(props.token,props.receiptContext,props.messages.map(m=>({id:m.id,mine:m.is_mine??m.sender_type==='buyer'})),visibleMessages);
  const theme = useTheme();
  const s = useThemedStyles(baseStyles);
  const {onClose}=props;
  const [sendingMessage,setSendingMessage]=useState(false),[sendError,setSendError]=useState('');
  const [reply,setReply]=useState<ProviderMessage|null>(null);
  const [draft, setDraft] = useState("");
  const [locationDraft,setLocationDraft]=useState<ChatLocationDraft|undefined>();
  const pin=locationDraft?.pin;
  const [locationMap,setLocationMap]=useState(false);
  const captureOwner=useRef(''),mapOwner=useRef('');captureOwner.current=props.token+'|'+(props.receiptContext?.conversationId||props.title);
  const [locating,setLocating]=useState(false);
  const locationFlight=useRef(false);
  const [photos,setPhotos]=useState<{key:string;uri:string}[]>([]);
  const [uploading,setUploading]=useState(false);
  const [viewPhoto,setViewPhoto]=useState<string|null>(null);
  const mounted=useRef(true),uploadFlight=useRef(false);
  const messageReference=useRef({fingerprint:"",id:""});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  function openLocationMap(owner=captureOwner.current){if(mounted.current&&owner===captureOwner.current){mapOwner.current=owner;setLocationMap(true);}}
  async function attachLocation(){
   if(locationFlight.current||props.paused||props.busy||sending.current||uploadFlight.current)return;
   locationFlight.current=true;
   let chosen=false;
   const release=()=>{if(!chosen)locationFlight.current=false;};
   Alert.alert('Share a static location pin?',props.roomStyle?'Everyone admitted to this Town Hall room can see the point you send.':'The other person in this conversation can see the point you send.',[
    {text:'Cancel',style:'cancel',onPress:release},
    {text:'Choose on map',onPress:()=>{if(chosen)return;chosen=true;locationFlight.current=false;openLocationMap();}},
    {text:'Use GPS',onPress:()=>{
     if(chosen)return;chosen=true;const owner=captureOwner.current;
     void (async()=>{
      setLocating(true);
      try{const selected=await captureChatLocation();if(mounted.current&&owner===captureOwner.current&&AppState.currentState==='active'){setLocationDraft(selected);setSendError('');}}
      catch(error){if(mounted.current&&owner===captureOwner.current)Alert.alert('Location unavailable',error instanceof Error?error.message:'Retry GPS or choose a point on the map.',[{text:'Cancel',style:'cancel'},{text:'Choose on map',onPress:()=>openLocationMap(owner)}]);}
      finally{locationFlight.current=false;if(mounted.current)setLocating(false);}
     })();
    }}
   ],{cancelable:true,onDismiss:release});
  }
  async function attach() {
    if(uploadFlight.current || locationFlight.current || locating || props.busy || props.paused || photos.length>=4)return;
    uploadFlight.current=true;setUploading(true);
    try {
      const result=await chooseLibraryMedia({mediaTypes:["images"],allowsMultipleSelection:true,selectionLimit:4-photos.length,quality:0.8});
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
      const keys=photos.map(photo=>photo.key),fingerprint=JSON.stringify([text,keys,pin,reply?.id]);
      const retry=messageReference.current.fingerprint===fingerprint&&!!messageReference.current.id;
      if(locationDraft&&!retry&&chatDraftNeedsRefresh(locationDraft))throw Error('This GPS pin needs refreshing. Use the pin button to retry GPS or choose a point on the map. Your message is kept.');
      if(!retry)messageReference.current={fingerprint,id:Crypto.randomUUID()};
      await props.onSend(text,keys,messageReference.current.id,pin,props.roomStyle?reply?.id:undefined);if(mounted.current){setDraft("");setReply(null);setPhotos([]);setLocationDraft(undefined);messageReference.current={fingerprint:"",id:""};nearBottom.current=true;}}
    catch(error){if(mounted.current)setSendError(error instanceof Error?error.message:'Message could not be sent. Please retry.');}
    finally{sending.current=false;if(mounted.current)setSendingMessage(false);}
  };
  return <KeyboardFrame style={s.fill} bottomInset={Math.max(0,props.bottomInset)} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <View style={s.header}><Pressable onPress={props.onClose} accessibilityLabel="Back to conversations" style={s.back}><Ionicons name="arrow-back" size={24} color={theme.dark?'#FFF':'#17251F'}/></Pressable>{props.roomStyle||props.townHallOrigin?<View style={{marginRight:10}}><TownHallIcon size={40}/></View>:<View style={{width:40,height:40,borderRadius:20,backgroundColor:theme.dark?'#2A3942':'#DCE9E2',alignItems:'center',justifyContent:'center',marginRight:10}}>{(props.identity?.avatar_url||props.avatarURL)?<Image source={{uri:props.identity?.avatar_url||props.avatarURL}} style={{width:40,height:40,borderRadius:20}}/>:<Text style={{fontSize:19,fontWeight:'700'}}>{props.provider.slice(0,1).toUpperCase()}</Text>}</View>}<View style={s.heading}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={s.title} numberOfLines={1}>{props.roomStyle?'Town Hall':props.provider}</Text>{props.identity&&<ProviderBadge identity={props.identity}/>}</View><Text style={s.meta} numberOfLines={1}>{props.roomStyle?'Bargaining room':'Private conversation'}</Text></View></View>
    {!props.roomStyle&&<ProviderProfileHeader identity={props.identity} compact showName={false}/>}
    {props.toolbar}
    {!!props.error&&!sendError && <Pressable onPress={props.onRefresh}><Text style={s.error}>{props.error} · Tap to retry</Text></Pressable>}
    <FlatList ref={list} onViewableItemsChanged={onVisibleMessages} viewabilityConfig={visibilityConfig} data={props.messages} keyExtractor={message=>message.id} style={s.fill} contentContainerStyle={[s.thread,props.roomStyle&&{backgroundColor:theme.dark?"#142A35":"#EDF4F8",gap:1}]} keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{minIndexForVisible:0}}
      onScroll={event=>{const {contentOffset,contentSize,layoutMeasurement}=event.nativeEvent;nearBottom.current=contentSize.height-contentOffset.y-layoutMeasurement.height<100;}} scrollEventThrottle={100}
      onContentSizeChange={()=>{if(nearBottom.current)list.current?.scrollToEnd({animated:false});}}
      ListHeaderComponent={props.hasEarlier ? <Pressable disabled={props.loading} onPress={()=>{nearBottom.current=false;props.onEarlier();}} style={s.earlier}><Text style={s.meta}>{props.loading ? "Loading…" : "Earlier messages"}</Text></Pressable> : props.roomStyle?<Text style={{fontSize:11,textAlign:"center",paddingBottom:12}}>Welcome to the room · {props.title}</Text>:null}
      ListEmptyComponent={props.loading ? <ActivityIndicator color={theme.color("#FF4747")}/> : !props.error ? <Text style={s.meta}>{props.roomStyle ? "Providers can start replying once admitted. Messages will appear here." : `Message ${props.provider} to get started.`}</Text> : null}
      renderItem={({item})=>props.roomStyle?<TownHallMessage message={item} receipt={receipts[item.id]} onPhoto={setViewPhoto} onReply={message=>{if(!sending.current&&!props.paused&&!props.busy)setReply(message);}}/>:<View style={[s.bubble,(item.is_mine ?? item.sender_type==="buyer") ? s.mine : s.theirs,{backgroundColor:(item.is_mine ?? item.sender_type==="buyer")?(theme.dark?"#005C4B":"#D9FDD3"):(theme.dark?"#202C33":"#FFF")}]}>{item.sender_name && !item.is_mine && <Text style={s.meta}>{item.sender_name}</Text>}<ChatMessageText style={s.message} text={item.body}/><LocationPin pin={item.location}/>{(item.media_urls || []).map(uri=><Pressable key={uri} onPress={()=>setViewPhoto(uri)} accessibilityLabel="View chat photo"><Image source={{uri}} style={{width:200,height:180,borderRadius:10,marginTop:6}} resizeMode="cover"/></Pressable>)}<View style={{flexDirection:"row",alignItems:"center",justifyContent:"flex-end",gap:5}}><Text style={s.time}>{new Date(item.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</Text>{(item.is_mine??item.sender_type==="buyer")&&<MessageReceipt receipt={receipts[item.id]}/>}</View></View>}/>
    {props.paused && <Text style={s.error}>{props.pausedLabel || "This provider cannot receive messages right now. Please try again later."}</Text>}
    {!!photos.length && <ScrollView horizontal style={{flexGrow:0,maxHeight:90,backgroundColor: theme.color("#FFF", "backgroundColor")}}>{photos.map(photo=><Pressable key={photo.key} onPress={()=>{if(!props.busy && !uploading)setPhotos(current=>current.filter(item=>item.key!==photo.key));}} accessibilityLabel="Remove attached photo"><Image source={{uri:photo.uri}} style={{width:72,height:72,margin:6,borderRadius:8}}/><Text style={{position:"absolute",right:9,top:6,color: theme.color("#B42318", "color")}}>X</Text></Pressable>)}</ScrollView>}
    {locationMap&&<NativeProviderLocationPicker title="Choose the location to share" hint="Choose the exact pickup or meeting point you want to send. This is a static pin, not live tracking. It is sent only after you tap Send in chat." initial={pin} onChoose={point=>{if(mounted.current){if(mapOwner.current===captureOwner.current){setLocationDraft(chatDraftFromMap(point));setSendError('');}setLocationMap(false);}}} onClose={()=>setLocationMap(false)}/>}
    <ChatPhotoViewer key={viewPhoto || "closed"} uri={viewPhoto} onClose={()=>setViewPhoto(null)}/>
    {pin&&<View style={{paddingHorizontal:12,flexDirection:'row',alignItems:'center'}}><LocationPin pin={pin} draft capturedAt={locationDraft?.capturedAt} source={locationDraft?.source}/><Pressable disabled={sendingMessage||locating||props.busy} onPress={()=>setLocationDraft(undefined)} accessibilityLabel="Remove location pin"><Text>Remove</Text></Pressable></View>}
    {props.roomStyle&&reply&&<View style={{padding:10,borderLeftWidth:3,borderLeftColor:'#12805F',flexDirection:'row',alignItems:'center'}}><View style={{flex:1}}><Text style={{fontWeight:'700'}}>Replying to {reply.sender_name||(reply.is_mine?'You':'Member')}</Text><Text numberOfLines={2}>{reply.body||(reply.media_urls?.length?'Photo':'Location pin')}</Text></View><Pressable accessibilityLabel="Cancel reply" disabled={sendingMessage} onPress={()=>setReply(null)} style={{padding:12}}><Ionicons name="close" size={22} color={theme.dark?'#FFF':'#17251F'}/></Pressable></View>}
    {!!sendError&&<Text accessibilityRole="alert" style={s.error}>Message not confirmed: {sendError} Tap Send to retry.</Text>}
    <View style={[s.composer,{paddingBottom:8}]}><Pressable accessibilityLabel="Attach photos" disabled={sendingMessage||locating||uploading||props.busy||props.paused||photos.length>=4} onPress={()=>void attach()} style={s.send}>{uploading?<ActivityIndicator color={theme.color("#FFF")}/>:<Ionicons name="image-outline" size={22} color={theme.color("#FFF")}/>}</Pressable><Pressable accessibilityLabel="Share location pin" disabled={sendingMessage||props.busy||props.paused||locating||uploading} onPress={()=>void attachLocation()} style={s.send}>{locating?<ActivityIndicator color="#FFF"/>:<Ionicons name="location-outline" size={22} color="#FFF"/>}</Pressable><TextInput accessibilityLabel="Message provider" value={draft} onChangeText={setDraft} editable={!sendingMessage&&!props.busy && !props.paused && !uploading} placeholder="Write a message…" multiline maxLength={2000} style={s.input}/><Pressable accessibilityLabel="Send provider message" disabled={sendingMessage||uploading||locating||props.busy||props.paused||(!draft.trim()&&!photos.length&&!pin)} onPress={()=>void send()} style={[s.send,(sendingMessage||uploading||props.busy||props.paused||(!draft.trim()&&!photos.length&&!pin))&&s.disabled]}>{(props.busy||sendingMessage) ? <ActivityIndicator color={theme.color("#FFF")}/> : <Ionicons name="arrow-up" size={23} color={theme.color("#FFF")}/>}</Pressable></View>
  </KeyboardFrame>;
}
const baseStyles = StyleSheet.create({fill:{flex:1,backgroundColor:"#F3F4F4"},header:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",paddingVertical:10,paddingRight:12},back:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"},heading:{flex:1},title:{fontSize:16,fontWeight:"800",color:"#191919"},meta:{fontSize:12,color:"#66736F"},error:{padding:10,color:"#B42318"},thread:{padding:12,flexGrow:1,gap:10},bubble:{maxWidth:"84%",padding:12,borderRadius:16},mine:{alignSelf:"flex-end",backgroundColor:"#D9FDD3",borderBottomRightRadius:4},theirs:{alignSelf:"flex-start",backgroundColor:"#FFF",borderBottomLeftRadius:4},message:{color:"#191919",lineHeight:20},time:{fontSize:10,color:"#66736F",marginTop:5},earlier:{padding:12,alignItems:"center"},composer:{flexDirection:"row",alignItems:"flex-end",gap:8,backgroundColor:"#FFF",paddingHorizontal:12,paddingTop:8},input:{flex:1,minWidth:0,minHeight:44,maxHeight:120,backgroundColor:"#F3F4F4",padding:12,borderRadius:20,color:"#191919"},send:{width:44,height:44,flexShrink:0,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#12805F"},disabled:{opacity:.45}});
