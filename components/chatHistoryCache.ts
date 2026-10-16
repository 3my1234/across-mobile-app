// This synchronous layer is process-only. Encrypted device snapshots are
// handled separately by privateChatStore; neither layer is a cloud backup.
export function createChatHistoryCache<T>(limit=10,ttl=5*60*1000,maxMessages=200) {
 let owner="";
 const entries=new Map<string,{messages:T[];cursor:string;saved:number}>();
 return {
  get(actor:string,id:string){
   if(owner!==actor){entries.clear();owner=actor;}
   const entry=entries.get(id);if(!entry)return null;
   if(Date.now()-entry.saved>ttl){entries.delete(id);return null;}
   entries.delete(id);entries.set(id,entry);
   return {...entry,messages:[...entry.messages]};
  },
  put(actor:string,id:string,messages:T[],cursor:string){
   if(owner!==actor)return; // Ignore a late response from an old account.
   if(!messages.length || messages.length>maxMessages){entries.delete(id);return;}
   entries.delete(id);entries.set(id,{messages:[...messages],cursor,saved:Date.now()});
   while(entries.size>limit)entries.delete(entries.keys().next().value!);
  },
  clear(){entries.clear();owner="";}
 };
}
export const providerChatHistory=createChatHistoryCache<import("./ProviderConversation").ProviderMessage>();
export const supportChatHistory=createChatHistoryCache<import("./types").SupportMessage>();
