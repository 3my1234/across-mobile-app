import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import {AppState,Platform} from 'react-native';
import {providerRequest} from './nativeProviderApi';
import {driverPresencePayload,DriverPresencePayload} from './providerDriverPresence';

export const DRIVER_LOCATION_TASK='atl-driver-nearby-v1';
const KEY='atl.driver.location.lease.v1';
type Lease={token:string;provider:string;listing:string;generation:string;last:number};
let current:Lease|null=null,flight:Promise<void>|null=null,epoch=0;
let serial:Promise<unknown>=Promise.resolve();
const storage=(work:()=>Promise<unknown>)=>{const next=serial.catch(()=>{}).then(work);serial=next;return next;};
export function minimizedDriverLocationActive(token:string){return current?.token===token;}
export async function publishDriverLocation(token:string,payload:DriverPresencePayload){
 const lease=current,previous=flight;
 const work=(async()=>{
  try{await previous;}catch{}
  if(lease&&current!==lease)throw Error('Driver availability has stopped.');
  if(lease&&lease.token!==token)throw Error('Driver account changed.');
  const wait=lease?Math.max(0,13000-(Date.now()-lease.last)):0;
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  if(lease&&current!==lease)throw Error('Driver availability has stopped.');
  await providerRequest(token,'/providers/me/driver-availability',{method:'PUT',body:JSON.stringify(payload)});
  if(lease&&current===lease){lease.last=Date.now();await storage(()=>SecureStore.setItemAsync(KEY,JSON.stringify(lease)));}
 })();flight=work;try{await work;}finally{if(flight===work)flight=null;}
}
export async function startMinimizedDriverLocation(token:string,provider:string,listing:string){
 if(Platform.OS!=='android'||AppState.currentState!=='active')return false;
 if(current?.token===token&&current.listing===listing&&await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))return true;
 epoch++;const lease:Lease={token,provider,listing,generation:`${Date.now()}-${Math.random()}`,last:Date.now()};current=lease;
 try{
  await storage(()=>SecureStore.setItemAsync(KEY,JSON.stringify(lease)));
  if(current!==lease)return false;
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK,{accuracy:Location.Accuracy.Balanced,timeInterval:30000,distanceInterval:0,deferredUpdatesInterval:30000,foregroundService:{notificationTitle:'ATL Xpress: available nearby',notificationBody:'Customers can find your driving service. Open ATL Xpress to go offline.',notificationColor:'#12805F',killServiceOnDestroy:true}});
  if(current!==lease){await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);return false;}
  return true;
 }catch(error){if(current===lease){current=null;await storage(()=>SecureStore.deleteItemAsync(KEY));}throw error;}
}
export async function stopMinimizedDriverLocation(token:string|null){
 const saved=current||JSON.parse(await SecureStore.getItemAsync(KEY)||'null') as Lease|null;
 if(saved&&saved.token!==token)return;
 epoch++;current=null;await storage(()=>SecureStore.deleteItemAsync(KEY));
 if(await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
 try{await flight;}catch{}
}
TaskManager.defineTask<{locations:Location.LocationObject[]}>(DRIVER_LOCATION_TASK,async({data,error})=>{
 if(error||!data?.locations?.length||AppState.currentState==='active')return;
 const version=epoch;const lease=current||JSON.parse(await SecureStore.getItemAsync(KEY)||'null') as Lease|null;
 if(!lease||version!==epoch)return;current=lease;
 const position=data.locations.reduce((latest,item)=>item.timestamp>latest.timestamp?item:latest);
 try{const payload=driverPresencePayload(lease.listing,position);if(current!==lease)return;await publishDriverLocation(lease.token,payload);}
 catch{/* No invented/stale position. Without successful GPS updates, the server lease expires. */}
});
