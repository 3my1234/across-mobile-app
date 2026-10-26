import * as Location from 'expo-location';
import {publishDriverLocation,startMinimizedDriverLocation,stopMinimizedDriverLocation,minimizedDriverLocationActive,recentDriverPosition,recordDriverEvent,subscribeDriverLocation,clearDriverLocationTimeline} from './driverLocationTask';
import {AppState} from 'react-native';
import {currentForegroundLocation} from './foregroundLocation';
import {providerRequest} from './nativeProviderApi';
import {createDriverPresence,driverPresencePayload} from './providerDriverPresence';
type Listener=(online:boolean,message:string,pending:boolean)=>void;
type Entry={token:string;provider:string;online:boolean;pending:boolean;closed:boolean;wanted:boolean;expiry:ReturnType<typeof setTimeout>|null;lastAcknowledgedAt:number;unsubscribe:()=>void;backgroundError:string;pause:Promise<void>|null;message:string;listing:string;listeners:Set<Listener>;session:ReturnType<typeof createDriverPresence>};
const entries=new Map<string,Entry>(),listeners=new Set<()=>void>();
const changed=()=>listeners.forEach(listener=>listener());
export function subscribeDriverPresence(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function driverPresenceStates(token:string|null){return [...entries.values()].filter(entry=>entry.token===token).map(entry=>({...entry,online:entry.online&&entry.lastAcknowledgedAt>0&&Date.now()-entry.lastAcknowledgedAt<120000}));}
export function driverPresenceSummary(token:string|null){return driverPresenceStates(token).filter(entry=>entry.online||entry.pending);}
export function providerAvailabilitySession(token:string,provider:string){
 const key=`${token}:${provider}`;let entry=entries.get(key);
 if(!entry||entry.closed){
  const value:Entry={token,provider,online:false,pending:false,closed:false,wanted:false,expiry:null,lastAcknowledgedAt:0,unsubscribe:()=>{},backgroundError:'',pause:null,message:'Offline. Choose a service to become available nearby.',listing:'',listeners:new Set(),session:null as unknown as ReturnType<typeof createDriverPresence>};
  const ensureService=()=>{if(value.wanted&&!value.closed)void startMinimizedDriverLocation(token,provider,value.listing).then(()=>{value.backgroundError='';}).catch(()=>{value.backgroundError='Minimized location updates could not start.';recordDriverEvent(token,'service_unavailable');});};
  const notify=()=>{value.listeners.forEach(listener=>listener(value.online,value.message,value.pending));changed();};
  const expireAcknowledgement=()=>{
    if(value.expiry)clearTimeout(value.expiry);
    const acknowledged=value.lastAcknowledgedAt;
    value.expiry=setTimeout(()=>{if(!value.closed&&value.wanted&&value.lastAcknowledgedAt===acknowledged){value.online=false;value.pending=true;value.message='Waiting for a fresh location update. Reconnecting automatically.';recordDriverEvent(token,'acknowledgement_expired');notify();}},Math.max(1,acknowledged+120000-Date.now()));
  };
  value.unsubscribe=subscribeDriverLocation(token,event=>{if(event.phase==='availability_rejected'){value.wanted=false;value.online=false;value.pending=false;value.message='The server stopped nearby access. Check verification and subscription status.';notify();}if(event.phase==='location_acknowledged'&&value.wanted&&!value.closed){value.lastAcknowledgedAt=event.acknowledgedAt||0;value.online=true;value.pending=false;value.message='Available nearby - server confirmed your location.';expireAcknowledgement();notify();}});
  value.session=createDriverPresence({sessionKey:provider,capture:async()=>{
    recordDriverEvent(token,'gps_requested');
    const position=await currentForegroundLocation(async()=>{
      ensureService();const recent=recentDriverPosition();if(recent)return recent;
      try{const cached=await Location.getLastKnownPositionAsync({maxAge:30000,requiredAccuracy:1000});if(cached){driverPresencePayload(value.listing,cached);recordDriverEvent(token,'recent_gps_fix_used');return cached;}}catch{}
    });
    recordDriverEvent(token,'gps_fix_received');return position;
  },foreground:()=>AppState.currentState==='active',publish:async payload=>{const receipt=await publishDriverLocation(token,payload);value.lastAcknowledgedAt=receipt?.acknowledgedAt||value.lastAcknowledgedAt;if(value.lastAcknowledgedAt)expireAcknowledgement();ensureService();return receipt;},remove:async()=>{
    recordDriverEvent(token,'availability_stop_requested');
    try{await stopMinimizedDriverLocation(token);}finally{return providerRequest(token,'/providers/me/driver-availability',{method:'DELETE'});}
  },state:(online,message,status)=>{
    if(online&&!value.lastAcknowledgedAt){value.lastAcknowledgedAt=Date.now();expireAcknowledgement();}
    value.online=value.wanted&&(online||value.lastAcknowledgedAt>0&&Date.now()-value.lastAcknowledgedAt<120000);
    recordDriverEvent(token,online?'foreground_confirmed':status==='starting'?'foreground_retry_or_start':'foreground_paused_or_stopped');
    value.message=value.online&&value.backgroundError?message+'. '+value.backgroundError:message;value.pending=!value.online&&status==='starting';notify();
  }});
  entries.set(key,value);entry=value;
 }
 const current=entry;
 return {get running(){return current.online||current.pending;},get listingID(){return current.listing;},subscribe(listener:Listener){current.listeners.add(listener);listener(current.online,current.message,current.pending);return()=>{current.listeners.delete(listener);};},start(listing:string){if(current.closed||current.online||current.pending)return false;recordDriverEvent(token,'availability_start_requested');current.listing=listing;current.wanted=true;const accepted=current.session.start(listing);
 if(!accepted){current.pending=true;current.message='Starting nearby availability...';current.listeners.forEach(listener=>listener(false,current.message,true));changed();
  void current.session.whenIdle().then(()=>{if(!current.closed&&current.wanted&&AppState.currentState==='active'){if(current.session.start(current.listing))return;}current.pending=false;current.listeners.forEach(listener=>listener(false,current.message,false));changed();});
 }return true;},stop(){if(current.expiry)clearTimeout(current.expiry);current.wanted=false;current.pending=false;const stopped=current.session.stop();changed();return stopped;}};
}
export async function stopDriverPresence(token:string|null,forget=false){
 const owned=[...entries.entries()].filter(([,entry])=>entry.token===token);
 await Promise.all(owned.map(async([key,entry])=>{if(entry.expiry)clearTimeout(entry.expiry);entry.wanted=false;entry.pending=false;if(forget)entry.closed=true;await entry.session.stop();if(forget&&entries.get(key)===entry){entry.unsubscribe();entries.delete(key);clearDriverLocationTimeline(token||'');}}));changed();
}

// Pause preserves the user's availability intent, unlike an explicit Go offline.
export async function pauseDriverPresence(token:string|null){
 await Promise.all([...entries.values()].filter(entry=>entry.token===token).map(async entry=>{recordDriverEvent(token||'','app_backgrounded');entry.pause=entry.session.pause();try{await entry.pause;}finally{entry.pause=null;}}));
}
export async function resumeDriverPresence(token:string|null){
 await Promise.all([...entries.values()].filter(entry=>entry.token===token&&entry.wanted&&!entry.closed).map(async entry=>{recordDriverEvent(token||'','app_foregrounded');await entry.pause;await entry.session.whenIdle();if(entry.wanted&&!entry.closed&&AppState.currentState==='active')entry.session.start(entry.listing);}));
}
