import {automaticDriverAvailability,setAutomaticDriverAvailability} from './automaticDriverAvailability';
import React,{useEffect,useState} from 'react';
import {Alert,AppState,Pressable,View} from 'react-native';
import {useAccountDesign} from './AccountDesign';
import {ThemedText as Text} from './ThemeProvider';
import {driverPresenceSummary,driverPresenceStates,stopDriverPresence,subscribeDriverPresence,pauseDriverPresence,resumeDriverPresence} from './driverPresenceSession';
export function useDriverPresenceLifecycle(token:string|null){useEffect(()=>{const automatic=token?automaticDriverAvailability(token):null;const listener=AppState.addEventListener('change',state=>{if(state==='background')void pauseDriverPresence(token);else if(state==='active'){void resumeDriverPresence(token);void automatic?.refresh(true);}});return()=>{automatic?.dispose();listener.remove();void stopDriverPresence(token,true);};},[token]);}
export function DriverPresenceNotice({token,alwaysVisible=false,onManage}:{token:string|null;alwaysVisible?:boolean;onManage?:()=>void}){
 const c=useAccountDesign();
 const [,render]=useState(0);useEffect(()=>subscribeDriverPresence(()=>render(n=>n+1)),[]);
 const sessions=alwaysVisible?driverPresenceStates(token):driverPresenceSummary(token);
 if(!sessions.length&&!alwaysVisible)return null;
 const online=sessions.some(entry=>entry.online),pending=sessions.some(entry=>entry.pending);
 const label=online?'Available nearby':pending?'Connecting nearby...':"You're offline";
 return <View accessibilityLiveRegion="polite" style={{marginHorizontal:12,marginVertical:6,paddingHorizontal:12,minHeight:44,borderRadius:14,borderWidth:1,borderColor:c.line,backgroundColor:c.soft,flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:8,height:8,borderRadius:4,backgroundColor:online?c.accent:c.muted}}/><Pressable accessibilityRole={onManage?'button':undefined} accessibilityLabel={label+'. '+(sessions[0]?.message||'Open driver availability to manage visibility.')} onPress={onManage} style={{flex:1,minHeight:44,justifyContent:'center'}}><Text numberOfLines={1} style={{fontSize:12,fontWeight:'700',color:c.text}}>{label}</Text></Pressable>{(online||pending)&&<Pressable accessibilityRole="button" accessibilityLabel="Stop sharing driver availability" onPress={()=>{void Promise.all([stopDriverPresence(token),...sessions.map(entry=>setAutomaticDriverAvailability(entry.provider,false))]).catch(()=>Alert.alert('Availability','Nearby sharing stopped on this device, but the offline preference could not be saved. Please retry.'));}} style={{minHeight:44,paddingHorizontal:10,justifyContent:'center'}}><Text style={{color:c.accent,fontSize:12,fontWeight:'700'}}>Go offline</Text></Pressable>}{!online&&!pending&&onManage&&<Pressable accessibilityRole="button" onPress={onManage} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontSize:12,color:c.accent,fontWeight:'700'}}>Manage</Text></Pressable>}</View>;
}
