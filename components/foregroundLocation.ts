import * as Location from 'expo-location';
// A device with GPS disabled must not leave the composer/search spinning forever.
export async function currentForegroundLocation(onPermission?:()=>Promise<Location.LocationObject|void>,options?:{accuracy?:Location.Accuracy;timeoutMs?:number}){
 let permissionTimer:ReturnType<typeof setTimeout>|undefined;
 let permission;try{permission=await Promise.race([(async()=>{const existing=await Location.getForegroundPermissionsAsync();return existing.granted?existing:Location.requestForegroundPermissionsAsync();})(),new Promise<never>((_,reject)=>{permissionTimer=setTimeout(()=>reject(Error('Location permission did not finish. Please retry.')),30000);})]);}finally{if(permissionTimer)clearTimeout(permissionTimer);}
 if(!permission.granted)throw Object.assign(Error('Allow location access while using the app.'),{status:403});
 if(onPermission){const cached=await onPermission();if(cached)return cached;}
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Location.getCurrentPositionAsync({accuracy:options?.accuracy??Location.Accuracy.Balanced}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Location timed out. Turn on device location and retry.')),options?.timeoutMs??12000);})]);}finally{if(timer)clearTimeout(timer);}
}
