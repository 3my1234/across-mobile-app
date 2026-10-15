import * as Location from 'expo-location';
// A device with GPS disabled must not leave the composer/search spinning forever.
export async function currentForegroundLocation(){
 const permission=await Location.requestForegroundPermissionsAsync();if(!permission.granted)throw Error('Allow location access while using the app.');
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Location timed out. Turn on device location and retry.')),12000);})]);}finally{if(timer)clearTimeout(timer);}
}
