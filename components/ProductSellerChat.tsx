import type {ChatLocation} from './chatLocation';
import {providerChatHistory} from "./chatHistoryCache";
import React,{useEffect,useRef,useState} from "react";
import {AppState} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {API_URL} from "./config";
import {fetchHistoryJSON,fetchJSONWithTimeout} from "./utils";
import {Product} from "./types";
import {mergeChatMessages} from "./chatImages";
import {ProviderConversation,ProviderMessage} from "./ProviderConversation";

export function ProductSellerChat({product,token,onClose}:{product:Product;token:string;onClose:()=>void}) {
 const inset=useSafeAreaInsets();
 const [messages,setMessages]=useState<ProviderMessage[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[cursor,setCursor]=useState(""),[paused,setPaused]=useState(false);
 const etag=useRef("");
 const cached=useRef(providerChatHistory.get(token,`product:${product.id}`));
 const alive=useRef(true),conversation=useRef(""),flight=useRef(false),sending=useRef(false),sequence=useRef(0);
 const invalidate=()=>{sequence.current++;};
 const headers={Authorization:`Bearer ${token}`};
 function merge(incoming:ProviderMessage[]) {setMessages(current=>{
  if(!alive.current)return current;
  const merged=mergeChatMessages(current,incoming);providerChatHistory.put(token,`product:${product.id}`,merged,cached.current?.cursor || "");return merged;
 });}
 async function load(earlier="",quiet=false) {
  if(flight.current)return;
  flight.current=true;const version=sequence.current;
  if(!quiet)setLoading(true);
  try {
   if(!conversation.current) {
    const {response,body}=await fetchHistoryJSON(`${API_URL}/api/v1/marketplace/conversations?product_id=${encodeURIComponent(product.id)}`,{headers});
    if(!response.ok)throw new Error(body.message || "Conversation could not be loaded");
    if(!alive.current || version!==sequence.current)return;
    const thread=body.items?.[0];
    conversation.current=thread?.id || "";setPaused(!!thread && (!thread.subscription_active || thread.status!=="open"));
   }
   if(conversation.current) {
    const {response,body}=await fetchHistoryJSON(`${API_URL}/api/v1/marketplace/conversations/${conversation.current}/messages?limit=50&mark_read=false${earlier?`&cursor=${encodeURIComponent(earlier)}`:""}`,{headers:{...headers,...(quiet && etag.current?{"If-None-Match":etag.current}:{})}});
    if(response.status===304)return;
    if(!response.ok)throw new Error(body.message || "Messages could not be loaded");
    if(!alive.current || version!==sequence.current)return;
    const tag=response.headers?.get("ETag");if(tag)etag.current=tag;
    if(earlier || !cached.current?.messages.length){setCursor(body.next_cursor || "");cached.current={messages:body.items || [],cursor:body.next_cursor || "",saved:Date.now()};}
    merge(body.items || []);
    setLoading(false);
    const newest=body.items?.at(-1);
    if(newest?.id && AppState.currentState==="active")try{const ack=await fetchJSONWithTimeout(`${API_URL}/api/v1/marketplace/conversations/${conversation.current}/read`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({message_id:newest.id})});if(!ack.response.ok)etag.current="";}catch{etag.current="";}
   }
   if(alive.current)setError("");
  }catch(problem){if(alive.current)setError(problem instanceof Error?problem.message:"Please try again.");}
  finally{flight.current=false;if(alive.current)setLoading(false);}
 }
 useEffect(()=>{
  alive.current=true;if(cached.current){setMessages(cached.current.messages);setCursor(cached.current.cursor);}void load();
  const timer=setInterval(()=>{if(AppState.currentState==="active")void load("",true);},15000);
  const foreground=AppState.addEventListener("change",state=>{if(state==="active")void load("",true);});
  return()=>{alive.current=false;invalidate();clearInterval(timer);foreground.remove();};
 // Product/token changes remount this component and discard the private state.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function send(text:string,mediaKeys:string[]=[],clientID?:string,location?:ChatLocation) {
  if(sending.current)return;
  sending.current=true;setBusy(true);setError("");
  try {
   const existing=conversation.current;
   const endpoint=existing?`/marketplace/conversations/${existing}/messages`:`/marketplace/products/${product.id}/conversations`;
   const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1${endpoint}`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({message:text,media_keys:mediaKeys,location,client_message_id:clientID})});
   if(!response.ok)throw new Error(body.message || "Message could not be sent");
   if(!alive.current)return;
   if(!(existing?body.id:body.message_id)||!body.created_at)throw new Error('The server did not confirm your message. Please retry.');
   invalidate();etag.current='';conversation.current=existing || body.id;
   merge([{id:existing?body.id:body.message_id,sender_type:"buyer",body:body.body || text,created_at:body.created_at,media_urls:body.media_urls || [],location:body.location||location}]);
  }catch(problem){if(alive.current)setError(problem instanceof Error?problem.message:"Message could not be sent");throw problem;}
  finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 return <ProviderConversation token={token} title={product.title} provider={product.provider_name || "Seller"} identity={product.provider_identity} messages={messages} busy={busy} loading={loading} paused={paused} error={error} hasEarlier={!!cursor} bottomInset={inset.bottom} onClose={onClose} onSend={send} onEarlier={()=>void load(cursor)} onRefresh={()=>void load()}/>;
}
