import React,{useEffect,useRef,useState} from 'react';
import {View,Pressable,FlatList,AppState,ActivityIndicator} from 'react-native';
import {currentForegroundLocation} from './foregroundLocation';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import {ProviderIdentity,ProviderBanner,ProviderIdentityData} from './ProviderIdentity';
import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';
type Driver={id:string;title:string;provider_identity?:ProviderIdentityData;distance_km:number};
export function NearbyDrivers({token,onClose,onOpen}:{token:string;onClose:()=>void;onOpen:(id:string)=>void}){
 const [items,setItems]=useState<Driver[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(false),[foreground,setForeground]=useState(AppState.currentState==='active');
 const alive=useRef(true),flight=useRef(false);const theme=useTheme();
 async function refresh(){if(flight.current||AppState.currentState!=='active')return;flight.current=true;setBusy(true);setError('');
 try{const position=await currentForegroundLocation();if(!alive.current||AppState.currentState!=='active')return;const query=new URLSearchParams({latitude:String(position.coords.latitude),longitude:String(position.coords.longitude),radius_km:'10'});const{response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/marketplace/drivers/nearby?${query}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw Error(body.message||'Nearby drivers could not load.');if(alive.current&&AppState.currentState==='active'){setItems(body.items||[]);setChecked(true);}}
 catch(problem){if(alive.current){setItems([]);setError(problem instanceof Error?problem.message:'Please retry.');}}
 finally{flight.current=false;if(alive.current)setBusy(false);}}
 useEffect(()=>{alive.current=true;void refresh();const timer=setInterval(()=>void refresh(),30000);const listener=AppState.addEventListener('change',state=>{setForeground(state==='active');setItems([]);setChecked(false);if(state==='active')void refresh();});return()=>{alive.current=false;clearInterval(timer);listener.remove();};},[token]);
 const button={padding:12,borderRadius:20,backgroundColor:theme.dark?'#173E32':'#D9F2E8',margin:4};
 return <View style={{flex:1,padding:12}}><View style={{flexDirection:'row',alignItems:'center'}}><Pressable onPress={onClose} style={button}><Text>← Services</Text></Pressable><Text style={{fontWeight:'800',fontSize:20,flex:1}}>Drivers nearby</Text><Pressable onPress={()=>void refresh()} disabled={busy} style={button}><Text>Refresh</Text></Pressable></View><Text style={{fontSize:12,marginVertical:10}}>Available drivers within 10 km · approximate distances. Message a driver to agree your ride.</Text>{busy&&<ActivityIndicator/>}{!!error&&<Text accessibilityRole="alert">{error}</Text>}<FlatList data={foreground?items:[]} keyExtractor={item=>item.id} ListEmptyComponent={<Text>{checked?'No drivers are currently available nearby. You can also browse driver services or ask in Town Hall.':busy?'Finding available drivers…':'Refresh to find drivers.'}</Text>} renderItem={({item})=><Pressable accessibilityLabel={`View driver ${item.provider_identity?.name||item.title}`} onPress={()=>onOpen(item.id)} style={{padding:14,marginVertical:5,borderRadius:16,backgroundColor:theme.dark?'#202C33':'#EEF5F1'}}><ProviderBanner identity={item.provider_identity} compact/><ProviderIdentity identity={item.provider_identity} compact={false}/><Text style={{fontWeight:'700'}}>{item.title}</Text><Text>{item.distance_km<.5?'Within approximately 0.5 km':`Approximately ${item.distance_km.toFixed(1)} km away`}</Text><Text style={{marginTop:8,fontWeight:'700'}}>View service & message →</Text></Pressable>}/></View>;
}
