import React,{useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Modal,Pressable,StyleSheet,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {useVideoPlayer,VideoView} from 'expo-video';
import {ThemedText as Text} from './ThemeProvider';
import {prepareVideoCache,videoBufferOptions} from './listingVideoCache';
function Player({uri,cached,muted}:{uri:string;cached:boolean;muted:boolean}) {
 const [state,setState]=useState('loading'),[fullscreen,setFullscreen]=useState(false),[silent,setSilent]=useState(muted);
 const player=useVideoPlayer({uri,useCaching:cached},p=>{p.loop=true;p.muted=muted;p.staysActiveInBackground=false;p.bufferOptions=videoBufferOptions;});
 useEffect(()=>{player.play();const sub=player.addListener('statusChange',event=>setState(event.status));setState(player.status);return()=>sub.remove();},[player]);
 useEffect(()=>{player.muted=silent;},[player,silent]);
 // Native Android fullscreen starts another Activity. Keeping fullscreen inside
 // this Activity avoids AppState background tearing down that Activity's player.
 // Exactly one VideoView is attached at a time; the player/position stay alive.
 const video=<View style={{flex:1,backgroundColor:'#07110D'}}><VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls fullscreenOptions={{enable:false}} surfaceType="textureView" allowsPictureInPicture={false}/>{(state==='loading'||state==='idle')&&<ActivityIndicator pointerEvents="none" color="#75FFCB" style={StyleSheet.absoluteFill}/>}
  {state==='error'&&<Text style={{color:'#FFF',padding:20}}>Video unavailable. Check your connection and reopen it.</Text>}</View>;
 const controls=<View style={{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#07110D',paddingHorizontal:12}}>
  <Pressable accessibilityRole="button" accessibilityLabel={silent?'Unmute video':'Mute video'} onPress={()=>setSilent(!silent)} style={styles.button}><Text style={styles.label}>{silent?'Unmute':'Mute'}</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel={fullscreen?'Exit fullscreen':'Expand video'} onPress={()=>setFullscreen(!fullscreen)} style={styles.button}><Text style={styles.label}>{fullscreen?'Exit fullscreen':'Full screen'}</Text></Pressable>
 </View>;
 return fullscreen?<Modal visible presentationStyle="fullScreen" supportedOrientations={['portrait','landscape-left','landscape-right']} onRequestClose={()=>setFullscreen(false)}><SafeAreaProvider><SafeAreaView edges={['top','bottom','left','right']} style={{flex:1,backgroundColor:'#07110D'}}>{video}{controls}</SafeAreaView></SafeAreaProvider></Modal>:<View style={{flex:1}}>{video}{controls}</View>;
}
export function CachedListingVideo({uri,active=true,muted=false}:{uri:string;active?:boolean;muted?:boolean}) {
 const [foreground,setForeground]=useState(AppState.currentState==='active'),[cached,setCached]=useState<boolean|null>(null);
 useEffect(()=>{let alive=true;void prepareVideoCache().then(value=>{if(alive)setCached(value);});const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>{alive=false;sub.remove();};},[]);
 return <View style={{flex:1,backgroundColor:'#07110D'}}>{active&&foreground&&cached!==null?<Player key={uri} uri={uri} cached={cached} muted={muted}/>:null}</View>;
}
export function ListingVideoPreview({uri,onClose}:{uri:string;onClose:()=>void}) {
 return <Modal visible animationType="slide" onRequestClose={onClose}><SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#07110D'}}><Pressable accessibilityRole="button" onPress={onClose} style={{padding:16,minHeight:48}}><Text style={{color:'#FFF'}}>Close video</Text></Pressable><CachedListingVideo uri={uri}/></SafeAreaView></SafeAreaProvider></Modal>;
}
const styles=StyleSheet.create({button:{minHeight:44,minWidth:88,justifyContent:'center'},label:{color:'#FFF',fontWeight:'600'}});
