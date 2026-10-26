import * as Location from 'expo-location';
// A device with GPS disabled must not leave the composer/search spinning forever.
export async function currentForegroundLocation(onPermission?:()=>Promise<void>){
 let permissionTimer:ReturnType<typeof setTimeout>|undefined;
 let permission;try{permission=await Promise.race([(async()=>{const existing=await Location.getForegroundPermissionsAsync();return existing.granted?existing:Location.requestForegroundPermissionsAsync();})(),new Promise<never>((_,reject)=>{permissionTimer=setTimeout(()=>reject(Error('Location permission did not finish. Please retry.')),30000);})]);}finally{if(permissionTimer)clearTimeout(permissionTimer);}
 if(!permission.granted)throw Error('Allow location access while using the app.');
 if(onPermission)await onPermission();
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Location timed out. Turn on device location and retry.')),12000);})]);}finally{if(timer)clearTimeout(timer);}
}
