import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import {AppState,Platform} from 'react-native';
import {providerRequest} from './nativeProviderApi';
import {driverPresencePayload,DriverPresencePayload} from './providerDriverPresence';

export const DRIVER_LOCATION_TASK='atl-driver-nearby-v1';
const KEY='atl.driver.location.lease.v1';
type Lease={token:string;provider:string;listing:string;generation:string;last:number};
let current:Lease|null=null,flight:Promise<unknown>|null=null,epoch=0;
type DriverEvent={phase:string;at:number;status?:number;requestID?:string;acknowledgedAt?:number;ageSeconds?:number;accuracyBucket?:'precise'|'usable'|'poor'};
const histories=new Map<string,DriverEvent[]>(),listeners=new Map<string,Set<(event:DriverEvent)=>void>>();
export function recordDriverEvent(token:string,phase:string,details:Omit<DriverEvent,'phase'|'at'>={}){const event={phase,at:Date.now(),...details};histories.set(token,[...(histories.get(token)||[]),event].slice(-80));listeners.get(token)?.forEach(fn=>fn(event));}
export function driverLocationTimeline(token:string){return histories.get(token)||[];}
export function subscribeDriverLocation(token:string,listener:(event:DriverEvent)=>void){const group=listeners.get(token)||new Set();group.add(listener);listeners.set(token,group);return()=>{group.delete(listener);if(!group.size)listeners.delete(token);};}
export function clearDriverLocationTimeline(token:string){histories.delete(token);}
let latestPosition:Location.LocationObject|null=null;
export function recentDriverPosition(){if(!latestPosition)return null;try{driverPresencePayload('00000000-0000-4000-8000-000000000000',latestPosition);return latestPosition;}catch{return null;}}
let registration:Promise<boolean>|null=null;
let serial:Promise<unknown>=Promise.resolve();
const storage=(work:()=>Promise<unknown>)=>{const next=serial.catch(()=>{}).then(work);serial=next;return next;};
export function minimizedDriverLocationActive(token:string){return current?.token===token;}
export async function publishDriverLocation(token:string,payload:DriverPresencePayload){
 const lease=current,previous=flight;
 const work=(async()=>{
  try{await previous;}catch{}
  if(lease&&current!==lease)throw Error('Driver availability has stopped.');
  if(lease&&lease.token!==token)throw Error('Driver account changed.');
  if(lease&&Date.now()-lease.last<13000)return {acknowledgedAt:lease.last}; // Existing fresh presence; do not queue a duplicate heartbeat.
  if(lease&&current!==lease)throw Error('Driver availability has stopped.');
  recordDriverEvent(token,'location_request_sent');
  const body=await providerRequest(token,'/providers/me/driver-availability',{method:'PUT',body:JSON.stringify(payload)},meta=>recordDriverEvent(token,'location_response',meta));
  if(body.online!==true)throw Error('Server did not confirm driver availability.');
  const acknowledgedAt=Date.now();recordDriverEvent(token,'location_acknowledged',{acknowledgedAt});
  if(lease&&current===lease){lease.last=acknowledgedAt;await storage(()=>SecureStore.setItemAsync(KEY,JSON.stringify(lease)));}
  return {acknowledgedAt};
 })();flight=work;try{return await work;}finally{if(flight===work)flight=null;}
}
export async function startMinimizedDriverLocation(token:string,provider:string,listing:string){
 if(registration&&current?.token===token&&current.listing===listing)return registration;
 if(Platform.OS!=='android'||AppState.currentState!=='active')return false;
 if(current?.token===token&&current.listing===listing&&await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))return true;
 epoch++;const lease:Lease={token,provider,listing,generation:`${Date.now()}-${Math.random()}`,last:0};current=lease;
 const starting=(async()=>{try{
  recordDriverEvent(token,'service_start');
  await storage(()=>SecureStore.setItemAsync(KEY,JSON.stringify(lease)));
  if(current!==lease)return false;
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK,{accuracy:Location.Accuracy.Balanced,timeInterval:30000,distanceInterval:0,deferredUpdatesInterval:30000,foregroundService:{notificationTitle:'ATL Xpress: available nearby',notificationBody:'Customers can find your driving service. Open ATL Xpress to go offline.',notificationColor:'#12805F',killServiceOnDestroy:true}});
  if(current!==lease){await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);return false;}
  recordDriverEvent(token,'service_ready');return true;
 }catch(error){if(current===lease){current=null;await storage(()=>SecureStore.deleteItemAsync(KEY));}recordDriverEvent(token,'service_start_failed');throw error;}})();registration=starting;try{return await starting;}finally{if(registration===starting)registration=null;}
}
export async function stopMinimizedDriverLocation(token:string|null){
 const saved=current||JSON.parse(await SecureStore.getItemAsync(KEY)||'null') as Lease|null;
 if(saved&&saved.token!==token)return;
 epoch++;current=null;latestPosition=null;await storage(()=>SecureStore.deleteItemAsync(KEY));
 if(await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK))await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
 try{await flight;}catch{}
}
TaskManager.defineTask<{locations:Location.LocationObject[]}>(DRIVER_LOCATION_TASK,async({data,error})=>{
 if(error||!data?.locations?.length)return;
 const version=epoch;const lease=current||JSON.parse(await SecureStore.getItemAsync(KEY)||'null') as Lease|null;
 if(!lease||version!==epoch)return;current=lease;
 const position=data.locations.reduce((latest,item)=>item.timestamp>latest.timestamp?item:latest);
 if(latestPosition&&latestPosition.timestamp>position.timestamp){recordDriverEvent(lease.token,'older_location_ignored');return;}
 latestPosition=position;recordDriverEvent(lease.token,'native_location_received',{ageSeconds:Math.max(0,Math.floor((Date.now()-position.timestamp)/1000)),accuracyBucket:position.coords.accuracy!=null&&position.coords.accuracy<=100?'precise':position.coords.accuracy!=null&&position.coords.accuracy<=1000?'usable':'poor'});
 try{const payload=driverPresencePayload(lease.listing,position);if(current!==lease)return;await publishDriverLocation(lease.token,payload);}
 catch(error){const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0;recordDriverEvent(lease.token,'native_location_rejected_or_failed',{status});if([401,403,404].includes(status)){recordDriverEvent(lease.token,'availability_rejected',{status});await stopMinimizedDriverLocation(lease.token);}}
});
