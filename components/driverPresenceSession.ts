import {AppState} from 'react-native';
import {currentForegroundLocation} from './foregroundLocation';
import {providerRequest} from './nativeProviderApi';
import {createDriverPresence} from './providerDriverPresence';
type Listener=(online:boolean,message:string,pending:boolean)=>void;
type Entry={token:string;provider:string;online:boolean;pending:boolean;closed:boolean;wanted:boolean;pause:Promise<void>|null;message:string;listing:string;listeners:Set<Listener>;session:ReturnType<typeof createDriverPresence>};
const entries=new Map<string,Entry>(),listeners=new Set<()=>void>();
const changed=()=>listeners.forEach(listener=>listener());
export function subscribeDriverPresence(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function driverPresenceSummary(token:string|null){return [...entries.values()].filter(entry=>entry.token===token&&(entry.online||entry.pending));}
export function providerAvailabilitySession(token:string,provider:string){
 const key=`${token}:${provider}`;let entry=entries.get(key);
 if(!entry||entry.closed){
  const value:Entry={token,provider,online:false,pending:false,closed:false,wanted:false,pause:null,message:'Offline. Choose a service to become available nearby.',listing:'',listeners:new Set(),session:null as unknown as ReturnType<typeof createDriverPresence>};
  value.session=createDriverPresence({sessionKey:provider,capture:currentForegroundLocation,foreground:()=>AppState.currentState==='active',publish:payload=>providerRequest(token,'/providers/me/driver-availability',{method:'PUT',body:JSON.stringify(payload)}),remove:()=>providerRequest(token,'/providers/me/driver-availability',{method:'DELETE'}),state:(online,message,status)=>{value.online=online;value.message=message;value.pending=status==='starting';value.listeners.forEach(listener=>listener(online,message,value.pending));changed();}});
  entries.set(key,value);entry=value;
 }
 const current=entry;
 return {get listingID(){return current.listing;},subscribe(listener:Listener){current.listeners.add(listener);listener(current.online,current.message,current.pending);return()=>{current.listeners.delete(listener);};},start(listing:string){if(current.closed)return false;const accepted=current.session.start(listing);if(accepted){current.listing=listing;current.wanted=true;}return accepted;},stop(){current.wanted=false;current.pending=false;const stopped=current.session.stop();changed();return stopped;}};
}
export async function stopDriverPresence(token:string|null,forget=false){
 const owned=[...entries.entries()].filter(([,entry])=>entry.token===token);
 await Promise.all(owned.map(async([key,entry])=>{entry.wanted=false;entry.pending=false;if(forget)entry.closed=true;await entry.session.stop();if(forget&&entries.get(key)===entry)entries.delete(key);}));changed();
}

// Pause preserves the user's availability intent, unlike an explicit Go offline.
export async function pauseDriverPresence(token:string|null){
 await Promise.all([...entries.values()].filter(entry=>entry.token===token).map(async entry=>{entry.pause=entry.session.stop();try{await entry.pause;}finally{entry.pause=null;}}));
}
export async function resumeDriverPresence(token:string|null){
 await Promise.all([...entries.values()].filter(entry=>entry.token===token&&entry.wanted&&!entry.closed).map(async entry=>{await entry.pause;if(entry.wanted&&!entry.closed&&AppState.currentState==='active')entry.session.start(entry.listing);}));
}
