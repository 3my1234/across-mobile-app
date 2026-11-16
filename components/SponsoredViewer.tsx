import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,FlatList,Modal,Pressable,StyleSheet,View} from 'react-native';
import {prepareVideoCache,videoBufferOptions} from './listingVideoCache';
import {StatusBar} from 'expo-status-bar';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useVideoPlayer,VideoView} from 'expo-video';
import {ThemedText as Text} from './ThemeProvider';
import {ResilientImage} from './ResilientImage';
import {DiscoveryCard,recordDiscovery,discoverySponsoredPage} from './discoveryClient';
import {ProductSellerChat} from './ProductSellerChat';
import {useBusinessContact} from './useBusinessContact';
import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';

export function sponsoredCards(cards:DiscoveryCard[],selected:DiscoveryCard) {
 const seen=new Set<string>();
 return [selected,...cards.filter(card=>card.id!==selected.id)].filter(card=>{
  if(card.kind!==selected.kind||card.placement!=='promoted'||seen.has(card.id))return false;
  seen.add(card.id);return true;
 });
}
export function sponsoredVideo(card:DiscoveryCard) {
 // The API's public-media policy is authoritative, including preserved paid media.
 return card.video_urls?.find(url=>typeof url==='string'&&/^https:\/\//i.test(url))||'';
}
function AdVideo({uri,muted,onError,cached=false,playing=true}:{uri:string;muted:boolean;onError:()=>void;cached?:boolean;playing?:boolean}) {
 const player=useVideoPlayer({uri,useCaching:cached},player=>{player.loop=true;player.muted=true;player.staysActiveInBackground=false;player.bufferOptions=videoBufferOptions;});
 const [loading,setLoading]=useState(true),errorHandler=useRef(onError);errorHandler.current=onError;
 useEffect(()=>{player.muted=muted;},[player,muted]);
 useEffect(()=>{
  setLoading(player.status==='loading'||player.status==='idle');
  if(player.status==='error')errorHandler.current();
  const subscription=player.addListener('statusChange',event=>{
   setLoading(event.status==='loading'||event.status==='idle');
   if(event.status==='error')errorHandler.current();
  });
  return()=>subscription.remove();
 },[player]);
 // useVideoPlayer releases/stops the native object on unmount, before later effect cleanups.
 // Do not call pause from cleanup on an already released native shared object.
 useEffect(()=>{if(playing)player.play();else player.pause();},[player,playing]);
 return <><VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} allowsPictureInPicture={false}/>{loading&&<ActivityIndicator color="#75FFCB" style={StyleSheet.absoluteFill}/>}</>;
}
export function SponsoredViewer({cards,selected,token,active,onClose,onDetails,market}:{market:{country:string;state?:string;city?:string;search?:string};cards:DiscoveryCard[];selected:DiscoveryCard;token:string|null;active:boolean;onClose:()=>void;onDetails:(card:DiscoveryCard)=>void}) {
 // Snapshot the eligible row so catalogue refreshes cannot move the ad under a finger.
 const [feed,setFeed]=useState(()=>sponsoredCards(cards,selected));
 const [cacheReady,setCacheReady]=useState<boolean|null>(null);
 useEffect(()=>{let mounted=true;void prepareVideoCache().then(value=>{if(mounted)setCacheReady(value);});return()=>{mounted=false;};},[]);
 const [hasMore,setHasMore]=useState(true),[pageError,setPageError]=useState(''),[pageLoading,setPageLoading]=useState(false);
 const cursor=useRef(''),paging=useRef(false);
 const [index,setIndex]=useState(0),[size,setSize]=useState({width:0,height:0}),[settled,setSettled]=useState(true);
 const [foreground,setForeground]=useState(AppState.currentState==='active'),[sound,setSound]=useState({id:selected.id,muted:true}),[paused,setPaused]=useState(false);
 const [failed,setFailed]=useState(new Set<string>()),[chat,setChat]=useState<DiscoveryCard|null>(null),[opening,setOpening]=useState(false);
 const alive=useRef(true),busy=useRef(false),scrollTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const inset=useSafeAreaInsets(),card=feed[index]||selected;
 const muted=sound.id===card.id?sound.muted:true;
 const access=useBusinessContact(token,card.provider_id);
 const visible=active&&foreground&&settled&&!chat&&!opening;
 const playing=visible&&!paused;
 useEffect(()=>{alive.current=true;const subscription=AppState.addEventListener('change',state=>{setForeground(state==='active');if(state!=='active')setSound({id:'',muted:true});});return()=>{alive.current=false;subscription.remove();if(scrollTimer.current)clearTimeout(scrollTimer.current);};},[]);
 useEffect(()=>{setPaused(false);},[card.id]);
 useEffect(()=>{
  if(!playing)return;
  const timer=setTimeout(()=>recordDiscovery(card,'impression',1000),1000);
  return()=>clearTimeout(timer);
 },[playing,card]);
 const more=useCallback(async()=>{
  if(paging.current||!hasMore||!active||!foreground||chat||pageError)return;
  paging.current=true;setPageLoading(true);
  try {
   const result=await discoverySponsoredPage({owner:token,country:market.country,state:market.state,city:market.city,search:market.search,kind:selected.kind},cursor.current);
   if(!alive.current)return;
   setFeed(previous=>{const seen=new Set(previous.map(item=>item.id));return [...previous,...result.cards.filter(item=>{if(item.kind!==selected.kind||item.placement!=='promoted'||seen.has(item.id))return false;seen.add(item.id);return true;})];});
   setHasMore(!!result.next&&result.next!==cursor.current);cursor.current=result.next;
  }catch{if(alive.current)setPageError('Could not load more. Tap to retry.');}
  finally{paging.current=false;if(alive.current)setPageLoading(false);}
 },[active,foreground,hasMore,chat,pageError,token,selected.kind,market.country,market.state,market.city,market.search]);
 useEffect(()=>{if(!pageError&&hasMore&&index>=feed.length-2)void more();},[more,pageError,hasMore,index,feed.length,foreground]);
 const close=()=>{if(chat)setChat(null);else onClose();};
 async function message() {
  if(busy.current||!settled||access.checking||access.own)return;
  if(access.error){access.retry();return;}
  if(!token){Alert.alert('Sign in required','Sign in to message this provider.');return;}
  busy.current=true;setOpening(true);
  try {
   const path=card.kind==='product'?`/products/${encodeURIComponent(card.id)}`:`/marketplace/listings/${encodeURIComponent(card.id)}`;
   const destination=card.kind==='product'?'?'+new URLSearchParams({country_code:market.country,state:market.state||'',city:market.city||''}):'';
   const {response,body}=await fetchJSONWithTimeout(API_URL+'/api/v1'+path+destination,{cache:'no-store'},10000);
   const listing=body.product||body;
   if(!response.ok||listing.id!==card.id||listing.provider_id!==card.provider_id||listing.contact_available===false)throw Error('This listing is no longer available for messaging.');
   if(!alive.current)return;
   recordDiscovery(card,'contact_tap');setChat({...card,title:listing.title||card.title});
  }catch(error){if(alive.current)Alert.alert('Cannot open chat',error instanceof Error?error.message:'Please try again.');}
  finally{busy.current=false;if(alive.current)setOpening(false);}
 }
 return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
  <View style={{flex:1,backgroundColor:'#050A08'}} onLayout={event=>setSize(event.nativeEvent.layout)}>
   <StatusBar style="light"/>
   {size.height>0&&<FlatList key={`${size.width}:${size.height}`} data={feed} scrollEnabled={!opening&&!chat} keyExtractor={item=>item.kind+item.id} pagingEnabled showsVerticalScrollIndicator={false} initialScrollIndex={index} getItemLayout={(_data,i)=>({length:size.height,offset:size.height*i,index:i})} onEndReached={()=>void more()} onEndReachedThreshold={0.5} windowSize={3} initialNumToRender={1} maxToRenderPerBatch={2} extraData={[playing,index,muted,failed]} onScroll={event=>{
    const y=event.nativeEvent.contentOffset.y;setSettled(false);setSound(previous=>previous.id?{id:'',muted:true}:previous);
    if(scrollTimer.current)clearTimeout(scrollTimer.current);
    scrollTimer.current=setTimeout(()=>{setIndex(Math.max(0,Math.min(feed.length-1,Math.round(y/size.height))));setSettled(true);},120);
   }} scrollEventThrottle={32} renderItem={({item,index:row})=><View style={{width:size.width,height:size.height}}>
    <ResilientImage uri={item.image_urls[0]||''} style={StyleSheet.absoluteFill} resizeMode="contain"/>
    {row===index&&visible&&cacheReady!==null&&!!sponsoredVideo(item)&&!failed.has(item.id)&&<AdVideo key={item.id} uri={sponsoredVideo(item)} cached={cacheReady===true} playing={!paused} muted={muted} onError={()=>setFailed(previous=>new Set(previous).add(item.id))}/>}
    <View style={[styles.caption,{bottom:inset.bottom+24}]}>
     <View style={{flex:1,gap:7}}>
      <Text style={styles.badge}>Sponsored</Text>
      <Text style={styles.copy}>{item.provider_identity?.name||item.provider_name||'Provider'}</Text>
      <Text numberOfLines={3} style={styles.title}>{item.title}</Text>
      <Text style={styles.copy}>{item.city}{item.city?' · ':''}{item.price===null||item.price_mode==='quote'?'Ask for a quote':`${item.price_mode==='from'?'From ':''}${item.currency} ${Number(item.price).toLocaleString('en-NG')}`}</Text>
      {failed.has(item.id)&&<Text style={styles.copy}>Video unavailable. Photo shown.</Text>}
      <Text style={[styles.copy,{fontSize:12,marginTop:12}]}>{row<feed.length-1?'Swipe up for more':pageLoading?'Loading more?':hasMore?'More sponsored listings':"You're up to date with these sponsored listings"}</Text>
      {!!pageError&&<Pressable accessibilityRole="button" onPress={()=>{setPageError('');}}><Text style={styles.copy}>{pageError}</Text></Pressable>}
     </View>
     <View style={{gap:10,width:112}}>
      <Pressable accessibilityRole="button" disabled={opening||!settled||row!==index||access.checking||access.own} onPress={()=>void message()} style={styles.button}><Ionicons name="chatbubble-outline" size={24} color="#FFF"/><Text style={styles.action}>{access.own?'Your listing':opening?'Opening…':access.error?'Retry access':'Message provider'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>{onClose();onDetails(item);}} style={styles.button}><Ionicons name="information-circle-outline" size={24} color="#FFF"/><Text style={styles.action}>See details</Text></Pressable>
     </View>
    </View>
   </View>}/>}
   <View style={[styles.header,{top:inset.top+8}]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to catalogue" onPress={close} style={styles.icon}><Ionicons name="chevron-back" size={28} color="#FFF"/></Pressable>
    <Text style={[styles.title,{flex:1,fontSize:18}]}>Sponsored {selected.kind==='product'?'products':'services'}</Text>
    {!!sponsoredVideo(card)&&<><Pressable accessibilityRole="button" accessibilityLabel={paused?'Play video':'Pause video'} onPress={()=>setPaused(value=>!value)} style={styles.icon}><Ionicons name={paused?'play':'pause'} size={22} color="#FFF"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={muted?'Unmute video':'Mute video'} onPress={()=>setSound({id:card.id,muted:!muted})} style={styles.icon}><Ionicons name={muted?'volume-mute':'volume-high'} size={22} color="#FFF"/></Pressable></>}
   </View>
   {chat&&token&&<View style={[StyleSheet.absoluteFill,{paddingTop:inset.top,backgroundColor:'#061C16'}]}><ProductSellerChat key={`${token}:${chat.kind}:${chat.id}`} product={{id:chat.id,title:chat.title,provider_name:chat.provider_name,provider_identity:chat.provider_identity}} service={chat.kind==='service'} token={token} onClose={()=>setChat(null)}/></View>}
  </View>
 </Modal>;
}
const styles=StyleSheet.create({
 header:{position:'absolute',left:12,right:12,flexDirection:'row',alignItems:'center',gap:8},
 icon:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:24,backgroundColor:'#000000A0'},
 caption:{position:'absolute',left:12,right:12,flexDirection:'row',alignItems:'flex-end',gap:12,padding:14,borderRadius:18,backgroundColor:'#00120DE6'},
 badge:{alignSelf:'flex-start',backgroundColor:'#75FFCB',color:'#06251A',paddingHorizontal:10,paddingVertical:4,borderRadius:7,fontSize:12,fontWeight:'700'},
 title:{color:'#FFF',fontSize:23,fontWeight:'700'},copy:{color:'#FFF',fontSize:14},
 button:{minHeight:68,padding:9,borderRadius:14,borderWidth:1,borderColor:'#FFFFFF60',backgroundColor:'#000000B0',alignItems:'center',gap:4},action:{color:'#FFF',fontSize:13,fontWeight:'600',textAlign:'center'},
});
