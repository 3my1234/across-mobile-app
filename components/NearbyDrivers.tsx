import React,{useEffect,useRef,useState} from 'react';
import {View,Pressable,FlatList,AppState,ActivityIndicator} from 'react-native';
import {currentForegroundLocation} from './foregroundLocation';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import {ProviderIdentity,ProviderBanner,ProviderIdentityData} from './ProviderIdentity';
import {NativeProviderLocationPicker} from './NativeProviderLocationPicker';
import {nearbyFreshUntil,TransportKind} from './transportServices';
import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';
type Pin={latitude:number;longitude:number};
type Driver={id:string;title:string;provider_identity?:ProviderIdentityData;distance_km:number;location_age_seconds:number;fresh_for_seconds:number;freshUntil:number;received:number};
export function NearbyDrivers({token,onClose,onOpen}:{token:string;onClose:()=>void;onOpen:(id:string)=>void}){
 const [items,setItems]=useState<Driver[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(false),[foreground,setForeground]=useState(AppState.currentState==='active');
 const [pickup,setPickup]=useState<Pin|null>(null),[map,setMap]=useState(false),[kind,setKind]=useState<TransportKind>('all'),[radius,setRadius]=useState(10),[reload,setReload]=useState(0),[now,setNow]=useState(Date.now());
 const actor=useRef(token),gps=useRef(''),gpsSequence=useRef(0);actor.current=token;const theme=useTheme();
 async function locate(){if(gps.current===token)return;gps.current=token;const owner=token,version=++gpsSequence.current;setError('');try{const p=await currentForegroundLocation();if(actor.current===owner&&version===gpsSequence.current&&AppState.currentState==='active')setPickup({latitude:p.coords.latitude,longitude:p.coords.longitude});}catch(e){if(actor.current===owner&&version===gpsSequence.current)setError('Location is unavailable. Choose your pickup area on the map instead.');}finally{if(gps.current===owner)gps.current='';}}
 useEffect(()=>{actor.current=token;setPickup(null);void locate();return()=>{gpsSequence.current++;if(actor.current===token)actor.current='';};},[token]);
 useEffect(()=>{let alive=true,flight=false;setItems([]);setChecked(false);
  async function load(){if(!pickup||flight||AppState.currentState!=='active')return;flight=true;setBusy(true);setError('');const started=Date.now();
   try{const query=new URLSearchParams({latitude:String(pickup.latitude),longitude:String(pickup.longitude),radius_km:String(radius),kind});const{response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/marketplace/drivers/nearby?${query}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw Error(body.message||'Nearby providers could not load.');if(alive&&AppState.currentState==='active'){const received=Date.now();setItems((body.items||[]).map((item:Driver)=>({...item,received,freshUntil:nearbyFreshUntil(item.fresh_for_seconds,started,received)})));setChecked(true);}}
   catch(e){if(alive){setItems([]);setError(e instanceof Error?e.message:'Please retry.');}}
   finally{flight=false;if(alive)setBusy(false);}}
  void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};
 },[token,pickup?.latitude,pickup?.longitude,kind,radius,reload]);
 useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),1000),listener=AppState.addEventListener('change',state=>{setForeground(state==='active');setItems([]);setChecked(false);if(state==='active')setReload(n=>n+1);});return()=>{clearInterval(tick);listener.remove();};},[]);
 const button={padding:12,borderRadius:20,backgroundColor:theme.dark?'#173E32':'#D9F2E8',margin:4};
 const visible=foreground?items.filter(item=>item.freshUntil>now):[];
 return <View style={{flex:1,padding:12}}><View style={{flexDirection:'row',alignItems:'center'}}><Pressable onPress={onClose} style={button}><Text>Back to services</Text></Pressable><Text style={{fontWeight:'800',fontSize:20,flex:1}}>Drivers and couriers nearby</Text></View>
 <Text>Find verified providers with active paid access, then message them to agree price and arrangements. Availability is not a promise to accept.</Text>
 <View style={{flexDirection:'row',flexWrap:'wrap'}}><Pressable onPress={()=>void locate()} style={button}><Text>Use my location</Text></Pressable><Pressable onPress={()=>setMap(true)} style={button}><Text>Choose pickup on map</Text></Pressable><Pressable onPress={()=>setReload(n=>n+1)} disabled={busy||!pickup} style={button}><Text>Refresh</Text></Pressable></View>
 <Text>{pickup?'Searching around your selected pickup location.':'Choose a pickup location to find nearby providers.'}</Text>
 <View style={{flexDirection:'row',flexWrap:'wrap'}}>{([['all','All transport'],['passenger','Passenger drivers'],['courier','Motorcycle couriers'],['delivery','Other delivery']] as const).map(([value,label])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:kind===value}} onPress={()=>setKind(value)} style={button}><Text>{kind===value?'? ':''}{label}</Text></Pressable>)}</View>
 <View style={{flexDirection:'row'}}>{[5,10,20].map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:radius===value}} onPress={()=>setRadius(value)} style={button}><Text>{radius===value?'? ':''}{value} km</Text></Pressable>)}</View>
 {busy&&<ActivityIndicator/>}{!!error&&<Text accessibilityRole="alert" style={{color:'#C62828'}}>{error}</Text>}
 <FlatList data={visible} keyExtractor={item=>item.id} ListEmptyComponent={<Text>{checked?'No fresh available providers in this area. Browse ordinary service listings or ask in Town Hall.':busy?'Finding available providers...':'Choose a pickup area or refresh.'}</Text>} renderItem={({item})=><Pressable accessibilityLabel={`View nearby provider ${item.provider_identity?.name||item.title}`} onPress={()=>{if(item.freshUntil>Date.now())onOpen(item.id);else setReload(n=>n+1);}} style={{padding:14,marginVertical:5,borderRadius:16,backgroundColor:theme.dark?'#202C33':'#EEF5F1'}}><ProviderBanner identity={item.provider_identity} compact/><ProviderIdentity identity={item.provider_identity} compact={false}/><Text style={{fontWeight:'700'}}>{item.title}</Text><Text>Available nearby - {item.distance_km<.5?'within approximately 0.5 km':`approximately ${item.distance_km.toFixed(1)} km away`}</Text><Text>Location updated {Math.max(0,item.location_age_seconds+Math.floor((now-item.received)/1000))} seconds ago</Text><Text style={{marginTop:8,fontWeight:'700'}}>View service and message</Text></Pressable>}/>
 {map&&<NativeProviderLocationPicker title="Choose your pickup area" hint="Search an address or place a pin. This is where you need a driver or courier, and may differ from your phone location." initial={pickup||undefined} onChoose={point=>{gpsSequence.current++;setPickup(point);setMap(false);}} onClose={()=>setMap(false)}/>}
 </View>;
}
