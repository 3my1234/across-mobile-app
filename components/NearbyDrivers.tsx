import React,{useEffect,useRef,useState} from 'react';
import {View,Pressable,FlatList,AppState,ActivityIndicator,Modal,ScrollView,StyleSheet,Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {currentForegroundLocation} from './foregroundLocation';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import {ProviderIdentityData} from './ProviderIdentity';
import {ResilientImage} from './ResilientImage';
import {NativeProviderLocationPicker} from './NativeProviderLocationPicker';
import {nearbyFreshUntil,TransportKind} from './transportServices';
import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';
type Pin={latitude:number;longitude:number};
type Driver={id:string;title:string;transport_kind?:TransportKind;provider_identity?:ProviderIdentityData;distance_km:number;location_age_seconds:number;fresh_for_seconds:number;freshUntil:number;received:number};
const transports=[['all','All transport','car-outline'],['passenger','Passenger drivers','car-sport-outline'],['courier','Motorcycle couriers','bicycle-outline'],['delivery','Other delivery','cube-outline']] as const;
export function NearbyDrivers({token,onClose,onOpen}:{token:string;onClose:()=>void;onOpen:(id:string)=>void}){
 const [items,setItems]=useState<Driver[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(false),[foreground,setForeground]=useState(AppState.currentState==='active');
 const [pickup,setPickup]=useState<Pin|null>(null),[map,setMap]=useState(false),[kind,setKind]=useState<TransportKind>('all'),[radius,setRadius]=useState(10),[reload,setReload]=useState(0),[now,setNow]=useState(Date.now());
 const [filters,setFilters]=useState(false),[draftKind,setDraftKind]=useState<TransportKind>('all'),[draftRadius,setDraftRadius]=useState(10);
 const actor=useRef(token),gps=useRef(''),gpsSequence=useRef(0);actor.current=token;const theme=useTheme();
 async function locate(){if(gps.current===token)return;gps.current=token;const owner=token,version=++gpsSequence.current;setError('');try{const p=await currentForegroundLocation();if(actor.current===owner&&version===gpsSequence.current&&AppState.currentState==='active')setPickup({latitude:p.coords.latitude,longitude:p.coords.longitude});}catch(e){if(actor.current===owner&&version===gpsSequence.current)setError('Location is unavailable. Choose your pickup area on the map instead.');}finally{if(gps.current===owner)gps.current='';}}
 useEffect(()=>{actor.current=token;setPickup(null);void locate();return()=>{gpsSequence.current++;if(actor.current===token)actor.current='';};},[token]);
 const resultContext=useRef('');
 useEffect(()=>{let alive=true,flight=false;const context=JSON.stringify([token,pickup?.latitude,pickup?.longitude,kind,radius]);if(resultContext.current!==context){resultContext.current=context;setItems([]);setChecked(false);}
  async function load(){if(!pickup||flight||AppState.currentState!=='active')return;flight=true;setBusy(true);setError('');const started=Date.now();
   try{const query=new URLSearchParams({latitude:String(pickup.latitude),longitude:String(pickup.longitude),radius_km:String(radius),kind});const{response,body}=await fetchJSONWithTimeout(`${API_URL}/api/v1/marketplace/drivers/nearby?${query}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw Object.assign(Error(body.message||'Nearby providers could not load.'),{status:response.status});if(alive&&AppState.currentState==='active'){const received=Date.now();setItems((body.items||[]).map((item:Driver)=>({...item,received,freshUntil:nearbyFreshUntil(item.fresh_for_seconds,started,received)})));setChecked(true);}}
   catch(e){if(alive){if(e&&typeof e==='object'&&'status' in e&&[401,403].includes(Number(e.status)))setItems([]);setError(e instanceof Error?e.message:'Please retry.');}}
   finally{flight=false;if(alive)setBusy(false);}}
  void load();const timer=setInterval(()=>void load(),30000);return()=>{alive=false;clearInterval(timer);};
 },[token,pickup?.latitude,pickup?.longitude,kind,radius,reload]);
 useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),1000),listener=AppState.addEventListener('change',state=>{setForeground(state==='active');setItems([]);setChecked(false);if(state==='active')setReload(n=>n+1);});return()=>{clearInterval(tick);listener.remove();};},[]);
 const colors={surface:theme.dark?'#102D25':'#FFFFFF',panel:theme.dark?'#0E3329':'#E8F6EF',border:theme.dark?'#335B4E':'#C5DED2',muted:theme.dark?'#AFC5BB':'#50695D',accent:theme.dark?'#50E3AF':'#007C55',background:theme.dark?'#081E17':'#F3F8F5'};
 const visible=foreground?items.filter(item=>item.freshUntil>now):[];
 const selected=transports.find(([value])=>value===kind)!;
 function openFilters(){setDraftKind(kind);setDraftRadius(radius);setFilters(true);}
 const outline={borderColor:colors.border,backgroundColor:colors.surface};
 function openDriver(item:Driver){if(item.freshUntil>Date.now())onOpen(item.id);else setReload(n=>n+1);}
 return <View style={[styles.screen,{backgroundColor:colors.background}]}>
  <View style={styles.heading}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to services" onPress={onClose} style={styles.back}><Ionicons name="chevron-back" size={20} color={colors.accent}/><Text style={{fontSize:13}}>Services</Text></Pressable>
   <Text accessibilityRole="header" style={styles.title}>Drivers & couriers</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="About nearby drivers" style={styles.iconButton} onPress={()=>Alert.alert('Drivers & couriers','Find verified providers with active paid access sharing a recent location. Open a service to message the provider and agree price and arrangements. Availability is not a promise to accept.')}><Ionicons name="information-circle-outline" size={22} color={colors.muted}/></Pressable>
  </View>
  <View style={[styles.pickup,{backgroundColor:colors.panel}]}>
   <View style={styles.pickupLabel}><Ionicons name="location" size={24} color={colors.accent}/><View style={styles.flex}><Text style={styles.bold}>{pickup?'Selected pickup location':'Choose a pickup location'}</Text><Text style={[styles.caption,{color:colors.muted}]}>{pickup?'Nearby results use this pickup.':'Use your location or choose an area.'}</Text></View></View>
   <View style={styles.controls}>
    <Pressable accessibilityRole="button" onPress={()=>void locate()} style={[styles.control,styles.primary]}><Ionicons name="navigate" size={17} color="#FFFFFF"/><Text style={styles.primaryText}>Use my location</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose pickup on map" onPress={()=>setMap(true)} style={[styles.control,styles.outline,outline]}><Ionicons name="map-outline" size={17} color={colors.accent}/><Text style={styles.controlText}>Choose on map</Text></Pressable>
   </View>
  </View>
  <View style={styles.toolbar}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Transport filter: ${selected[1]}`} accessibilityState={{expanded:filters}} onPress={openFilters} style={[styles.filterControl,styles.outline,outline,{flex:1.4}]}><Ionicons name={selected[2]} size={18} color={colors.accent}/><Text numberOfLines={1} style={[styles.controlText,styles.flex]}>{selected[1]}</Text><Ionicons name="chevron-down" size={14} color={colors.muted}/></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel={`Search radius: ${radius} kilometres`} accessibilityState={{expanded:filters}} onPress={openFilters} style={[styles.filterControl,styles.outline,outline,{flex:1}]}><Ionicons name="location-outline" size={18} color={colors.accent}/><Text style={[styles.controlText,styles.flex]}>{radius} km</Text><Ionicons name="chevron-down" size={14} color={colors.muted}/></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Refresh nearby drivers" accessibilityState={{disabled:busy||!pickup,busy}} onPress={()=>setReload(n=>n+1)} disabled={busy||!pickup} style={[styles.iconButton,styles.outline,outline,{opacity:!pickup?0.5:1}]}>{busy?<ActivityIndicator size="small" color={colors.accent}/>:<Ionicons name="refresh" size={21} color={colors.accent}/>}</Pressable>
  </View>
  <View style={styles.resultsHeading}><Text accessibilityRole="header" style={styles.resultsTitle}>Nearby providers</Text><Text style={[styles.caption,{color:colors.muted}]}>{busy?'Updating...':`${visible.length} available`}</Text></View>
  {!!error&&<Text accessibilityRole="alert" style={[styles.error,{color:theme.dark?'#FFB4A9':'#AC2920'}]}>{error}</Text>}
  <FlatList data={visible} keyExtractor={item=>item.id} contentContainerStyle={styles.list}
   ListEmptyComponent={<View style={[styles.empty,{backgroundColor:colors.surface}]}><Ionicons name="location-outline" size={30} color={colors.accent}/><Text style={styles.emptyTitle}>{checked?'No available providers nearby':busy?'Finding nearby providers...':'Choose your pickup area'}</Text><Text style={[styles.emptyDescription,{color:colors.muted}]}>{checked?'Try a wider radius or another transport type. You can also browse services or ask in Town Hall.':'Nearby results need a pickup location and a recent location from the provider.'}</Text><Pressable accessibilityRole="button" onPress={onClose} style={[styles.control,styles.outline,outline]}><Text style={styles.controlText}>Browse services</Text></Pressable></View>}
   renderItem={({item})=>{
    const identity=item.provider_identity,name=identity?.name||item.title;
    const label=transports.find(([value])=>value===item.transport_kind)?.[1];
    const serviceLabel=item.transport_kind==='passenger'?'Passenger driver':item.transport_kind==='courier'?'Motorcycle courier':label||item.title;
    const distance=item.distance_km<.5?'About 0.5 km':`About ${item.distance_km.toFixed(1)} km`;
    return <View style={[styles.driver,{backgroundColor:colors.surface}]}>
     <Pressable accessibilityRole="button" accessibilityLabel={`View nearby provider ${name}`} onPress={()=>openDriver(item)} style={styles.driverDetails}>
      <View style={styles.avatarWrap}>
       <View style={[styles.avatar,{backgroundColor:colors.panel}]}>{identity?.avatar_url?<ResilientImage uri={identity.avatar_url} fallbackUri="" contentFit="cover" style={styles.photo}/>:<Text style={[styles.initial,{color:colors.accent}]}>{name.trim().slice(0,1).toUpperCase()}</Text>}</View>
       {identity?.verified&&<View style={[styles.verified,{borderColor:colors.surface}]}><Ionicons name="checkmark" size={10} color="#FFFFFF"/></View>}
      </View>
      <View style={styles.flex}><Text numberOfLines={1} style={styles.bold}>{name}</Text><Text numberOfLines={1} style={[styles.caption,{color:colors.muted}]}>{serviceLabel}</Text><View style={styles.distance}><Ionicons name="location-outline" size={12} color={colors.muted}/><Text numberOfLines={1} style={[styles.caption,{color:colors.muted}]}>{distance}</Text></View></View>
     </Pressable>
     <View style={styles.driverAction}><Pressable accessibilityRole="button" accessibilityLabel={`View service and message ${name}`} onPress={()=>openDriver(item)} style={[styles.message,styles.outline,{borderColor:colors.accent}]}><Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.accent}/><Text style={[styles.controlText,{color:colors.accent}]}>View & chat</Text></Pressable><View accessible accessibilityLabel={`Available nearby${identity?.verified?', verified provider':''}`} style={styles.available}><View style={styles.dot}/><Text style={[styles.caption,{color:colors.muted}]}>Available</Text></View></View>
    </View>;
   }}/>
  <Modal visible={filters} transparent animationType="slide" onRequestClose={()=>setFilters(false)}>
   <View style={styles.modalRoot}><Pressable accessibilityRole="button" accessibilityLabel="Dismiss nearby filters" onPress={()=>setFilters(false)} style={styles.scrim}/>
    <SafeAreaView edges={['bottom','left','right']} accessibilityViewIsModal style={[styles.sheet,{backgroundColor:colors.background}]}>
     <View style={[styles.handle,{backgroundColor:colors.muted}]}/>
     <View style={styles.sheetHeading}><Text accessibilityRole="header" style={styles.resultsTitle}>Nearby filters</Text><Pressable accessibilityRole="button" accessibilityLabel="Close nearby filters" onPress={()=>setFilters(false)} style={styles.iconButton}><Ionicons name="close" size={24} color={colors.muted}/></Pressable></View>
     <ScrollView><Text style={styles.sectionTitle}>Transport</Text><View style={styles.options}>{transports.map(([value,label,icon])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:draftKind===value}} onPress={()=>setDraftKind(value)} style={[styles.option,styles.outline,{backgroundColor:draftKind===value?colors.panel:colors.surface,borderColor:draftKind===value?colors.accent:colors.border}]}><Ionicons name={icon} size={20} color={colors.accent}/><Text style={[styles.controlText,styles.flex]}>{label}</Text>{draftKind===value&&<Ionicons name="checkmark-circle" size={18} color={colors.accent}/>}</Pressable>)}</View>
     <Text style={styles.sectionTitle}>Search radius</Text><View style={styles.controls}>{[5,10,20].map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:draftRadius===value}} onPress={()=>setDraftRadius(value)} style={[styles.control,styles.outline,{backgroundColor:draftRadius===value?colors.panel:colors.surface,borderColor:draftRadius===value?colors.accent:colors.border}]}><Text style={styles.controlText}>{value} km</Text>{draftRadius===value&&<Ionicons name="checkmark" size={18} color={colors.accent}/>}</Pressable>)}</View>
     <View style={styles.filterHint}><Ionicons name="location" size={18} color={colors.muted}/><Text style={[styles.caption,styles.flex,{color:colors.muted}]}>Search around your selected pickup location.</Text></View>
     <Pressable accessibilityRole="button" onPress={()=>{setKind(draftKind);setRadius(draftRadius);setFilters(false);}} style={[styles.control,styles.primary,styles.apply]}><Text style={styles.primaryText}>Show nearby providers</Text></Pressable></ScrollView>
    </SafeAreaView>
   </View>
  </Modal>
  {map&&<NativeProviderLocationPicker title="Choose your pickup area" hint="Search an address or place a pin. This is where you need a driver or courier, and may differ from your phone location." initial={pickup||undefined} onChoose={point=>{gpsSequence.current++;setPickup(point);setMap(false);}} onClose={()=>setMap(false)}/>}
 </View>;
}
const styles=StyleSheet.create({
 screen:{flex:1,paddingHorizontal:12},flex:{flex:1,minWidth:0},bold:{fontSize:14,fontWeight:'700'},caption:{fontSize:12,lineHeight:17},
 heading:{flexDirection:'row',alignItems:'center',gap:4,minHeight:52},back:{minHeight:48,flexDirection:'row',alignItems:'center',paddingRight:6},title:{flex:1,fontSize:19,fontWeight:'800'},iconButton:{width:48,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:12},
 pickup:{padding:10,borderRadius:16,gap:9},pickupLabel:{flexDirection:'row',alignItems:'center',gap:10},controls:{flexDirection:'row',gap:8},control:{flex:1,minHeight:48,paddingHorizontal:8,paddingVertical:10,borderRadius:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},controlText:{fontSize:12,fontWeight:'600',flexShrink:1},primary:{backgroundColor:'#00875E'},primaryText:{color:'#FFFFFF',fontSize:12,fontWeight:'700',flexShrink:1},outline:{borderWidth:1},
 toolbar:{flexDirection:'row',gap:8,marginTop:10},filterControl:{minHeight:48,paddingHorizontal:9,borderRadius:11,flexDirection:'row',alignItems:'center',gap:6},resultsHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12},resultsTitle:{fontSize:19,fontWeight:'800'},error:{fontSize:12,marginBottom:8},list:{paddingBottom:16},
 driver:{flexDirection:'row',alignItems:'center',borderRadius:14,padding:10,marginBottom:8,gap:10,minHeight:82},driverDetails:{flex:1,minWidth:0,minHeight:60,flexDirection:'row',alignItems:'center',gap:10},avatarWrap:{width:48,height:48},avatar:{width:48,height:48,borderRadius:24,overflow:'hidden',alignItems:'center',justifyContent:'center'},photo:{width:48,height:48},initial:{fontSize:22,fontWeight:'800'},verified:{position:'absolute',right:-1,top:-2,width:18,height:18,borderRadius:9,borderWidth:2,backgroundColor:'#00875E',alignItems:'center',justifyContent:'center'},distance:{flexDirection:'row',alignItems:'center',gap:3},driverAction:{alignItems:'flex-end',gap:2},message:{minHeight:48,borderRadius:11,paddingHorizontal:9,flexDirection:'row',alignItems:'center',gap:5},available:{flexDirection:'row',alignItems:'center',gap:5},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#00AA79'},
 empty:{alignItems:'center',padding:20,borderRadius:14,gap:10},emptyTitle:{fontSize:16,fontWeight:'700',textAlign:'center'},emptyDescription:{fontSize:13,lineHeight:20,textAlign:'center'},
 modalRoot:{flex:1,justifyContent:'flex-end'},scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,0.6)'},sheet:{maxHeight:'85%',borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:18,paddingTop:10,paddingBottom:16},handle:{width:42,height:4,borderRadius:2,alignSelf:'center',marginBottom:4},sheetHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionTitle:{fontSize:16,fontWeight:'700',marginTop:12,marginBottom:10},options:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{width:'48%',minHeight:54,padding:9,borderRadius:12,flexDirection:'row',alignItems:'center',gap:7},filterHint:{flexDirection:'row',alignItems:'center',gap:8,marginVertical:18},apply:{flex:0,marginBottom:8}
});
