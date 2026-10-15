import {useEffect,useRef,useState} from 'react';
import {AppState,DeviceEventEmitter} from 'react-native';
import {communityRequest} from './communityApi';
export type ReceiptContext={channel:'business'|'shared'|'support';conversationId:string};
export type MessageReceipt={status:'sent'|'delivered'|'read';delivered_count:number;read_count:number};
const uuid=/^[a-f0-9-]{36}$/i;
const notificationFlights=new Map<string,Promise<void>>();
export async function acknowledgeNotificationDelivery(token:string,payload:Record<string,unknown>){
 if(!token||AppState.currentState!=='active')return;
 const ticket=typeof payload.ticket_id==='string'&&uuid.test(payload.ticket_id)?payload.ticket_id:'';
 const conversation=[payload.chat_room_id,payload.conversation_id].find(value=>typeof value==='string'&&uuid.test(value)) as string|undefined;
 if(!ticket&&!conversation)return;
 const path=ticket?`/support/tickets/${ticket}/messages?limit=40`:`/chat/conversations/${conversation}/messages?limit=40&mark_read=false`,key=token+':'+path;
 if(notificationFlights.has(key))return notificationFlights.get(key);
 if(notificationFlights.size>=4)return;
 const flight=(async()=>{try{const {data}=await communityRequest(token,path);const messages=(data?.messages||data?.items||[]).filter((m:any)=>uuid.test(m.id||'')).slice(0,100);if(!messages.length)return;
  await communityRequest(token,'/messaging/deliveries',{method:'POST',body:JSON.stringify({messages:messages.map((m:any)=>({channel:ticket?'support':data.kind?'shared':'business',conversation_id:ticket||conversation,message_id:m.id}))})});
 }catch{/* A later inbox/thread synchronization can acknowledge delivery. */}})();notificationFlights.set(key,flight);
 try{await flight;}finally{if(notificationFlights.get(key)===flight)notificationFlights.delete(key);}
}
export type ReceiptInboxItem={id:string;source:'legacy'|'shared';last_message_id?:string;last_message_is_mine?:boolean;last_message?:string};
// A fetched inbox preview is delivery of that message, not proof it was read.
export function useInboxDeliveryReceipts(token:string,items:ReceiptInboxItem[]){
 const latest=useRef(items);latest.current=items;const wake=useRef<()=>void>(()=>{});
 const fingerprint=items.map(m=>m.last_message_id||'').join(',');
 useEffect(()=>{
  if(!token)return;let alive=true,busy=false;const done=new Set<string>();
  const sync=async()=>{if(!alive||busy||AppState.currentState!=='active')return;busy=true;
   try{const batch=latest.current.filter(m=>m.last_message&&m.last_message_is_mine===false&&uuid.test(m.last_message_id||'')&&!done.has(m.last_message_id!)).slice(0,100);
    if(batch.length){await communityRequest(token,'/messaging/deliveries',{method:'POST',body:JSON.stringify({messages:batch.map(item=>({channel:item.source==='legacy'?'business':'shared',conversation_id:item.id,message_id:item.last_message_id}))})});if(alive)batch.forEach(item=>done.add(item.last_message_id!));}
   }catch{/* Retry metadata sync later; inbox and sending remain usable. */}finally{busy=false;}
  };
  wake.current=()=>void sync();void sync();const timer=setInterval(()=>void sync(),15000),foreground=AppState.addEventListener('change',state=>{if(state==='active')void sync();});
  return()=>{alive=false;wake.current=()=>{};clearInterval(timer);foreground.remove();};
 },[token]);
 useEffect(()=>{wake.current();},[fingerprint]);
}
// Only message IDs and own-message flags enter receipt requests. Receipt state
// stays in memory, separate from encrypted history, so cached blue ticks cannot
// outlive a privacy preference change.
export function useMessageReceipts(token:string,context:ReceiptContext|undefined,messages:{id:string;mine:boolean}[],visible:string[]){
 const [receipts,setReceipts]=useState<Record<string,MessageReceipt>>({});
 const current=useRef({messages,visible});current.current={messages,visible};
 const wake=useRef<()=>void>(()=>{});
 const fingerprint=messages.map(m=>m.id+':'+m.mine).join(',')+'|'+visible.join(',');
 useEffect(()=>{
  setReceipts({});if(!token||!context?.conversationId||!uuid.test(context.conversationId))return;
  let alive=true,busy=false,privacyVersion=0;const delivered=new Set<string>(),read=new Set<string>();
  const base={channel:context.channel,conversation_id:context.conversationId};
  const sync=async()=>{
   if(!alive||busy||AppState.currentState!=='active')return;busy=true;const version=privacyVersion;const currentResponse=()=>alive&&version===privacyVersion;
   try{
    const incoming=current.current.messages.filter(m=>!m.mine&&uuid.test(m.id)).map(m=>m.id);
    const delivery=incoming.filter(id=>!delivered.has(id)).slice(0,100);
    if(delivery.length){await communityRequest(token,'/messaging/receipts',{method:'POST',body:JSON.stringify({...base,message_ids:delivery,read:false})});if(!currentResponse())return;delivery.forEach(id=>delivered.add(id));}
    const seen=AppState.currentState==='active'?incoming.filter(id=>current.current.visible.includes(id)&&!read.has(id)).slice(0,100):[];
    if(seen.length){await communityRequest(token,'/messaging/receipts',{method:'POST',body:JSON.stringify({...base,message_ids:seen,read:true})});if(!currentResponse())return;seen.forEach(id=>read.add(id));}
    const own=current.current.messages.filter(m=>m.mine&&uuid.test(m.id));
    const ids=[...new Set([...own.filter(m=>current.current.visible.includes(m.id)),...own.slice(-100)].map(m=>m.id))].slice(0,100);
    if(ids.length){const {data}=await communityRequest(token,'/messaging/receipts?'+new URLSearchParams({...base,message_ids:ids.join(',')}));if(currentResponse())setReceipts(previous=>Object.entries(data.items||{}).every(([id,value]:[string,any])=>previous[id]?.status===value.status&&previous[id]?.delivered_count===value.delivered_count&&previous[id]?.read_count===value.read_count)?previous:{...previous,...data.items});}
   }catch{/* Retry receipt synchronization later; never block or resend chat messages. */}
   finally{busy=false;}
  };
  wake.current=()=>void sync();void sync();
  const timer=setInterval(()=>void sync(),5000),foreground=AppState.addEventListener('change',state=>{if(state==='active')void sync();});
  const preference=DeviceEventEmitter.addListener('message-receipts-preference',()=>{privacyVersion++;setReceipts({});read.clear();void sync();});
  return()=>{alive=false;wake.current=()=>{};clearInterval(timer);foreground.remove();preference.remove();};
 },[token,context?.channel,context?.conversationId]);
 useEffect(()=>{wake.current();},[fingerprint]);
 return receipts;
}
