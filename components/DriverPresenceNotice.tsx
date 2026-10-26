import {automaticDriverAvailability,setAutomaticDriverAvailability} from './automaticDriverAvailability';
import React,{useEffect,useState} from 'react';
import {Alert,AppState,Pressable,View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {driverPresenceSummary,stopDriverPresence,subscribeDriverPresence,pauseDriverPresence,resumeDriverPresence} from './driverPresenceSession';
export function useDriverPresenceLifecycle(token:string|null){useEffect(()=>{const automatic=token?automaticDriverAvailability(token):null;const listener=AppState.addEventListener('change',state=>{if(state==='background')void pauseDriverPresence(token);else if(state==='active'){void resumeDriverPresence(token);void automatic?.refresh(true);}});return()=>{automatic?.dispose();listener.remove();void stopDriverPresence(token,true);};},[token]);}
export function DriverPresenceNotice({token,alwaysVisible=false}:{token:string|null;alwaysVisible?:boolean}){
 const [,render]=useState(0);useEffect(()=>subscribeDriverPresence(()=>render(n=>n+1)),[]);
 const sessions=driverPresenceSummary(token);if(!sessions.length&&!alwaysVisible)return null;
 return <View style={{minHeight:64,padding:8,backgroundColor:'#164D3A',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text numberOfLines={2} style={{color:'#FFF',flex:1}}>{sessions.some(entry=>entry.online)?'Available nearby - sharing current location':sessions.length?'Setting up nearby availability...':'Nearby visibility is offline'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Stop sharing driver availability" onPress={()=>{void Promise.all([stopDriverPresence(token),...sessions.map(entry=>setAutomaticDriverAvailability(entry.provider,false))]).catch(()=>Alert.alert('Availability','Nearby sharing stopped on this device, but the offline preference could not be saved. Please retry.'));}} style={{padding:10}}><Text style={{color:'#FFF',fontWeight:'700'}}>Stop</Text></Pressable></View>;
}
