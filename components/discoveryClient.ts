import * as Crypto from 'expo-crypto';
import {API_URL} from './config';
import {fetchJSONWithTimeout, mapProduct} from './utils';
import type {Product} from './types';
export type DiscoveryCard = {kind:'product'|'service';id:string;provider_id:string;title:string;categories:string[];city:string;image_urls:string[];price:number|null;price_mode?:string;compare_at_price?:number;currency:string;placement:'similar'|'recommended'|'promoted';label?:string;receipt:string};
type Context = {owner:string|null;country:string;state?:string;city?:string;search?:string;kind?:'product'|'service';sourceKind?:'product'|'service';sourceID?:string};
let actor:string|null|undefined, session='', topics:string[]=[], pending: {receipt:string;type:string;visible_ms?:number}[]=[], timer:ReturnType<typeof setTimeout>|undefined, sending=false, epoch=0, navigation=0;
const seen = new Set<string>();
const recentlyVisible=new Map<string,number>();
const attribution=new Map<string,DiscoveryCard>();
export function discoverySession(owner:string|null) {
  if(actor!==owner){actor=owner;session=Crypto.randomUUID();topics=[];pending=[];seen.clear();attribution.clear();recentlyVisible.clear();epoch++;navigation++;if(timer)clearTimeout(timer);timer=undefined;}
  return session;
}
export function rememberDiscoveryTopics(owner:string|null,values:string[]) {
 discoverySession(owner);topics=Array.from(new Set([...values.map(v=>v.trim().slice(0,40)).filter(Boolean),...topics])).slice(0,6);
}
export async function discoveryFeed(context:Context) {
 const query=new URLSearchParams({country_code:context.country,state:context.state||'',city:context.city||'',session:discoverySession(context.owner),interests:topics.join(' ').slice(0,240)});
 for(const [key,at]of recentlyVisible){if(Date.now()-at>20*60*1000)recentlyVisible.delete(key);}
 if(recentlyVisible.size)query.set('recent',Array.from(recentlyVisible.keys()).slice(-24).join(','));
 if(context.search?.trim())query.set('search',context.search.trim().slice(0,100));
 if(context.kind)query.set('kind',context.kind);
 if(context.sourceID){query.set('source_id',context.sourceID);query.set('source_kind',context.sourceKind||'product');}
 const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/discovery?${query}`,{cache:'no-store'},10000);
 if(!response.ok)throw Error('Discovery is temporarily unavailable.');
 const valid=(list:unknown)=>Array.isArray(list)?list.filter((item:any)=>['product','service'].includes(item?.kind)&&typeof item.id==='string'&&typeof item.receipt==='string'&&Array.isArray(item.image_urls)):[];
 return {similar:valid(body.similar) as DiscoveryCard[],recommended:valid(body.recommended) as DiscoveryCard[],promoted:valid(body.promoted) as DiscoveryCard[]};
}
// Queue only genuine UI events. Serving a feed does not enqueue impressions.
// No private chat text, account identifiers or raw history is sent/stored.
export function recordDiscovery(card:DiscoveryCard,type:'impression'|'click'|'detail_open'|'contact_tap',visibleMS?:number) {
 if(type==='impression'&&(!visibleMS||visibleMS<1000))return;
 if(type==='impression'){recentlyVisible.delete(card.kind+':'+card.id);recentlyVisible.set(card.kind+':'+card.id,Date.now());if(recentlyVisible.size>24)recentlyVisible.delete(recentlyVisible.keys().next().value!);}
 const key=card.receipt+':'+type;if(seen.has(key))return;if(seen.size>=2000)seen.delete(seen.values().next().value!);seen.add(key);
 if(pending.length<100)pending.push({receipt:card.receipt,type,...(visibleMS?{visible_ms:visibleMS}:{})});
 if(!timer)timer=setTimeout(()=>{timer=undefined;void flushDiscovery();},1500);
}
export async function flushDiscovery() {
 if(sending||!pending.length)return;sending=true;const version=epoch,batch=pending.splice(0,25);
 try{await fetchJSONWithTimeout(`${API_URL}/api/v1/discovery/events`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:batch})},8000);}catch{/* Metrics must never block browsing or replay customer actions. */}
 finally{sending=false;if(version===epoch&&pending.length&&!timer)timer=setTimeout(()=>{timer=undefined;void flushDiscovery();},1500);}
}
// Details are refreshed from the existing public endpoints. A discovery card
// cannot fabricate prices, bypass visibility checks or create a second chat.
export async function openDiscovery(card:DiscoveryCard,destination:{country:string;state?:string;city?:string},onProduct:(product:Product)=>void,onService:(id:string)=>void) {
 const version=epoch,request=++navigation;recordDiscovery(card,'click');attribution.set(card.kind+':'+card.id,card);if(attribution.size>40)attribution.delete(attribution.keys().next().value!);
 if(card.kind==='service'){onService(card.id);return;}
 const query=new URLSearchParams({country_code:destination.country,state:destination.state||'',city:destination.city||''});
 const {response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/products/${encodeURIComponent(card.id)}?${query}`,{cache:'no-store'},10000);
 if(!response.ok)throw Error('This product is no longer available.');
 if(version!==epoch||request!==navigation)return;
 const product=mapProduct(body.product||body);if(product.id!==card.id)throw Error('This product could not be opened.');
 rememberDiscoveryTopics(actor??null,card.categories);recordDiscovery(card,'detail_open');onProduct(product);
}

export function recordDiscoveryDetail(owner:string|null,kind:'product'|'service',id:string,categories:string[]=[]) {rememberDiscoveryTopics(owner,categories);const card=attribution.get(kind+':'+id);if(card)recordDiscovery(card,'detail_open');}
export function recordDiscoveryContact(owner:string|null,kind:'product'|'service',id:string) {discoverySession(owner);const card=attribution.get(kind+':'+id);if(card)recordDiscovery(card,'contact_tap');}
