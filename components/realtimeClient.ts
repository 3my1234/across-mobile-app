import {AppState,Platform} from 'react-native';
import {API_URL} from './config';

type Notice = 'connected'|'changed'|'disconnected';
type Listener=(notice:Notice)=>void;
type NativeSocket = new (url:string,protocols:string[],options:{headers:{Authorization:string}})=>WebSocket;
type Session={listeners:Set<Listener>;hallCount:number;socket:WebSocket|null;timer:ReturnType<typeof setTimeout>|null;deadline:ReturnType<typeof setTimeout>|null;attempt:number;ready:boolean;everReady:boolean;closed:boolean;app:{remove:()=>void}};
const sessions=new Map<string,Session>();
function syncHall(session:Session){if(!session.ready||!session.socket)return;try{session.socket.send(JSON.stringify({type:'watch_hall',enabled:session.hallCount>0}));}catch{session.socket.close();}}

// One authenticated connection per account while at least one screen needs it.
// Never put the bearer token in the URL, logs or application-level messages.
export function subscribeRealtime(token:string, listener:Listener,topic?:'hall'):()=>void {
 if(!token || Platform.OS==='web')return ()=>{};
 let session=sessions.get(token);
 if(!session){
  const entry:Session={listeners:new Set(),hallCount:0,socket:null,timer:null,deadline:null,attempt:0,ready:false,everReady:false,closed:false,app:{remove(){}}};
  const emit=(notice:Notice)=>entry.listeners.forEach(fn=>fn(notice));
  const clear=()=>{if(entry.timer)clearTimeout(entry.timer);if(entry.deadline)clearTimeout(entry.deadline);entry.timer=null;entry.deadline=null;};
  const disconnect=()=>{clear();const old=entry.socket;entry.socket=null;if(old)old.close();if(entry.ready){entry.ready=false;emit('disconnected');}};
  const connect=()=>{
   if(entry.closed||entry.socket||AppState.currentState!=='active'||!entry.listeners.size)return;
   const url=API_URL.replace(/^https:/,'wss:').replace(/^http:/,'ws:')+'/api/v1/realtime';
   let socket:WebSocket;try{socket=new (WebSocket as unknown as NativeSocket)(url,[],{headers:{Authorization:`Bearer ${token}`}});}catch{schedule();return;}
   entry.socket=socket;entry.deadline=setTimeout(()=>{if(entry.socket===socket){entry.socket=null;socket.close();schedule();}},10000);
   socket.onmessage=event=>{
    if(entry.closed||entry.socket!==socket)return;
    let data:{type?:string};try{data=JSON.parse(String(event.data));}catch{return;}
    if(data.type==='ready'){if(entry.deadline)clearTimeout(entry.deadline);entry.deadline=null;entry.attempt=0;entry.ready=true;try{socket.send(JSON.stringify({type:'hello',reconnect:entry.everReady}));}catch{socket.close();return;}entry.everReady=true;syncHall(entry);if(entry.ready)emit('connected');}else if(data.type==='changed'&&entry.ready)emit('changed');
   };
   socket.onerror=()=>{socket.close();};
   socket.onclose=()=>{if(entry.socket!==socket)return;entry.socket=null;if(entry.deadline)clearTimeout(entry.deadline);entry.deadline=null;if(entry.ready){entry.ready=false;emit('disconnected');}schedule();};
  };
  const schedule=()=>{if(entry.closed||entry.timer||AppState.currentState!=='active'||!entry.listeners.size)return;const ceiling=Math.min(300000,1000*2**Math.min(entry.attempt++,9));entry.timer=setTimeout(()=>{entry.timer=null;connect();},Math.floor(ceiling/2+Math.random()*ceiling/2));};
  entry.app=AppState.addEventListener('change',state=>{if(state==='active'){entry.attempt=0;schedule();}else disconnect();});
  sessions.set(token,entry);session=entry;
  // Defer until the first listener has been added.
  Promise.resolve().then(schedule);
 }
 const entry=session;entry.listeners.add(listener);if(topic==='hall'){entry.hallCount++;syncHall(entry);}
 if(entry.ready)listener('connected');
 let subscribed=true;
 return ()=>{if(!subscribed)return;subscribed=false;entry.listeners.delete(listener);if(topic==='hall'){entry.hallCount--;syncHall(entry);}if(entry.listeners.size)return;entry.closed=true;if(entry.timer)clearTimeout(entry.timer);if(entry.deadline)clearTimeout(entry.deadline);const socket=entry.socket;entry.socket=null;if(socket)socket.close();entry.app.remove();if(sessions.get(token)===entry)sessions.delete(token);};
}
