import React,{useEffect,useState} from 'react';
import {ActivityIndicator,AppState,Modal,Pressable,StyleSheet,View} from 'react-native';
import {useVideoPlayer,VideoView} from 'expo-video';
import {ThemedText as Text} from './ThemeProvider';
import {prepareVideoCache,videoBufferOptions} from './listingVideoCache';
function Player({uri,cached,muted}:{uri:string;cached:boolean;muted:boolean}) {
 const [state,setState]=useState('loading');
 const player=useVideoPlayer({uri,useCaching:cached},p=>{p.loop=true;p.muted=muted;p.staysActiveInBackground=false;p.bufferOptions=videoBufferOptions;});
 useEffect(()=>{player.play();const sub=player.addListener('statusChange',event=>setState(event.status));setState(player.status);return()=>sub.remove();},[player]);
 return <><VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls allowsPictureInPicture={false}/>{(state==='loading'||state==='idle')&&<ActivityIndicator color="#75FFCB" style={StyleSheet.absoluteFill}/>} {state==='error'&&<Text style={{color:'#FFF',padding:20}}>Video unavailable. Check your connection and reopen it.</Text>}</>;
}
export function CachedListingVideo({uri,active=true,muted=true}:{uri:string;active?:boolean;muted?:boolean}) {
 const [foreground,setForeground]=useState(AppState.currentState==='active'),[cached,setCached]=useState<boolean|null>(null);
 useEffect(()=>{let alive=true;void prepareVideoCache().then(value=>{if(alive)setCached(value);});const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>{alive=false;sub.remove();};},[]);
 return <View style={{flex:1,backgroundColor:'#07110D'}}>{active&&foreground&&cached!==null?<Player key={uri} uri={uri} cached={cached} muted={muted}/>:null}</View>;
}
export function ListingVideoPreview({uri,onClose}:{uri:string;onClose:()=>void}) {
 return <Modal visible animationType="slide" onRequestClose={onClose}><View style={{flex:1,backgroundColor:'#07110D',paddingTop:40}}><Pressable accessibilityRole="button" onPress={onClose} style={{padding:16}}><Text style={{color:'#FFF'}}>Close video</Text></Pressable><CachedListingVideo uri={uri} muted={false}/></View></Modal>;
}
