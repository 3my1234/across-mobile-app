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
 const alive=useRef(true),conversation=useRef(""),flight=useRef(false),sending=useRef(false),sequence=useRef(0);
 const invalidate=()=>{sequence.current++;};
 const headers={Authorization:`Bearer ${token}`};
 function merge(incoming:ProviderMessage[]) {setMessages(current=>mergeChatMessages(current,incoming));}
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
    const {response,body}=await fetchHistoryJSON(`${API_URL}/api/v1/marketplace/conversations/${conversation.current}/messages?limit=50${earlier?`&cursor=${encodeURIComponent(earlier)}`:""}`,{headers});
    if(!response.ok)throw new Error(body.message || "Messages could not be loaded");
    if(!alive.current || version!==sequence.current)return;
    merge(body.items || []);if(!quiet || earlier)setCursor(body.next_cursor || "");
   }
   if(alive.current)setError("");
  }catch(problem){if(alive.current)setError(problem instanceof Error?problem.message:"Please try again.");}
  finally{flight.current=false;if(alive.current)setLoading(false);}
 }
 useEffect(()=>{
  alive.current=true;void load();
  const timer=setInterval(()=>{if(AppState.currentState==="active")void load("",true);},15000);
  const foreground=AppState.addEventListener("change",state=>{if(state==="active")void load("",true);});
  return()=>{alive.current=false;invalidate();clearInterval(timer);foreground.remove();};
 // Product/token changes remount this component and discard the private state.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function send(text:string,mediaKeys:string[]=[],clientID?:string) {
  if(sending.current)return;
  sending.current=true;setBusy(true);setError("");
  try {
   const existing=conversation.current;
   const endpoint=existing?`/marketplace/conversations/${existing}/messages`:`/marketplace/products/${product.id}/conversations`;
   const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1${endpoint}`,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({message:text,media_keys:mediaKeys,client_message_id:clientID})});
   if(!response.ok)throw new Error(body.message || "Message could not be sent");
   if(!alive.current)return;
   conversation.current=existing || body.id;
   merge([{id:existing?body.id:body.message_id,sender_type:"buyer",body:body.body || text,created_at:body.created_at,media_urls:body.media_urls || []}]);
  }catch(problem){if(alive.current)setError(problem instanceof Error?problem.message:"Message could not be sent");throw problem;}
  finally{sending.current=false;if(alive.current)setBusy(false);}
 }
 return <ProviderConversation token={token} title={product.title} provider={product.provider_name || "Seller"} messages={messages} busy={busy||loading} loading={loading} paused={paused} error={error} hasEarlier={!!cursor} bottomInset={inset.bottom} onClose={onClose} onSend={send} onEarlier={()=>void load(cursor)} onRefresh={()=>void load()}/>;
}
