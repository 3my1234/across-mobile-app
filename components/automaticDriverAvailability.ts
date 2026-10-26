import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {AppState} from 'react-native';
import {providerRequest,ProviderRequestError} from './nativeProviderApi';
import {hasPaidProviderAccess} from './nativeProviderPolicy';
import {providerAvailabilitySession} from './driverPresenceSession';
import {transportServiceKind} from './transportServices';

const disabled=new Set<string>(),versions=new Map<string,number>();
const key=(provider:string)=>`atl.driver.nearby.disabled.${provider}`;
export async function setAutomaticDriverAvailability(provider:string,enabled:boolean){
 const version=(versions.get(provider)||0)+1;versions.set(provider,version);
 if(enabled)disabled.delete(provider);else disabled.add(provider);
 try{await AsyncStorage.setItem(key(provider),enabled?'false':'true');}
 catch{if(enabled&&versions.get(provider)===version)disabled.add(provider);throw Error('Could not save nearby visibility. Please retry.');}
}
// Uses existing permission only. It never prompts customers, runs in the
// background, substitutes a business address for GPS, or bypasses backend checks.
export function automaticDriverAvailability(token:string){
 let alive=true,flight=false,notDriver=false;
 async function refresh(){
  if(!alive||flight||notDriver||AppState.currentState!=='active')return;
  flight=true;
  try{
   const provider=await providerRequest(token,'/providers/me');
   if(!alive)return;
   if(!provider.is_driver){notDriver=true;return;}
   if(!provider.is_active||provider.verification_status!=='approved'||!hasPaidProviderAccess(provider))return;
   const version=versions.get(provider.id)||0;
   const saved=await AsyncStorage.getItem(key(provider.id));
   if(!alive||disabled.has(provider.id)||saved==='true'||version!==(versions.get(provider.id)||0))return;
   const permission=await Location.getForegroundPermissionsAsync();
   if(!alive||!permission.granted||disabled.has(provider.id)||version!==(versions.get(provider.id)||0)||AppState.currentState!=='active')return;
   const session=providerAvailabilitySession(token,provider.id);
   if(session.running)return;
   if(session.listingID){session.start(session.listingID);return;}
   let cursor='';
   for(let page=0;page<10;page++){
    const query=new URLSearchParams({status:'approved',limit:'25'});if(cursor)query.set('cursor',cursor);
    const data=await providerRequest(token,`/providers/me/listings?${query}`);
    if(!alive||disabled.has(provider.id)||version!==(versions.get(provider.id)||0)||AppState.currentState!=='active')return;
    const service=(data.items||[]).find((item:{status:string;category?:string;title:string})=>item.status==='approved'&&transportServiceKind(item.category,item.title)!==null);
    if(service){session.start(service.id);return;}
    cursor=data.page?.next_cursor||data.next_cursor||'';if(!cursor)return;
   }
  }catch(error){if(error instanceof ProviderRequestError&&error.status===404)notDriver=true;}
  finally{flight=false;}
 }
 void refresh();
 const timer=setInterval(()=>void refresh(),60000);
 return {refresh,dispose(){alive=false;clearInterval(timer);}};
}
