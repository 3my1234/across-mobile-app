import React,{useEffect,useState} from 'react';
import {AppState,Pressable,View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {driverPresenceSummary,stopDriverPresence,subscribeDriverPresence} from './driverPresenceSession';
export function useDriverPresenceLifecycle(token:string|null){useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')void stopDriverPresence(token);});return()=>{listener.remove();void stopDriverPresence(token,true);};},[token]);}
export function DriverPresenceNotice({token}:{token:string|null}){
 const [,render]=useState(0);useEffect(()=>subscribeDriverPresence(()=>render(n=>n+1)),[]);
 const sessions=driverPresenceSummary(token);if(!sessions.length)return null;
 return <View style={{padding:8,backgroundColor:'#164D3A',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:'#FFF',flex:1}}>{sessions.some(entry=>entry.online)?'Available nearby - sharing current location':'Setting up nearby availability...'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Stop sharing driver availability" onPress={()=>void stopDriverPresence(token)} style={{padding:10}}><Text style={{color:'#FFF',fontWeight:'700'}}>Stop</Text></Pressable></View>;
}
