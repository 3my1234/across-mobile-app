import React from 'react';
import {Alert,Pressable,Linking,View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {ChatLocation,validLocation,locationMapURL,locationDirectionsURL} from './chatLocation';
import {LocationGraphic} from './LocationGraphic';
export function LocationPin({pin,draft=false,capturedAt,source}:{pin?:ChatLocation|null;draft?:boolean;capturedAt?:number;source?:'gps'|'map'}){
 if(!validLocation(pin))return null;
 const open=(url:string)=>{void Linking.openURL(url).catch(()=>Alert.alert('Maps unavailable','Please install or enable a browser or maps app and try again.'));};
 return <View style={{padding:10,minWidth:150,flexShrink:1,borderRadius:14,borderWidth:1,borderColor:'#12805F66',marginVertical:6}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}><LocationGraphic/><View style={{flex:1}}>
   <Text style={{fontWeight:'700'}}>{draft?'Location ready to send':'Shared location'}</Text>
   <Text style={{fontSize:12,marginTop:4}}>{draft?'Not sent yet. Tap Send to share this point.':'Saved location pin - stays fixed when either person moves.'}</Text>
   {draft&&Number.isFinite(capturedAt)&&<Text style={{fontSize:12,marginTop:4}}>{source==='map'?'Point selected':'GPS captured'} at {new Date(capturedAt!).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>}
   {typeof pin.accuracy_m==='number'&&Number.isFinite(pin.accuracy_m)&&pin.accuracy_m>=0&&<Text style={{fontSize:12,marginTop:4}}>Reported accuracy: about {Math.ceil(pin.accuracy_m)} m</Text>}
  </View></View>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:16}}>
   <Pressable accessibilityRole="link" accessibilityLabel={draft?'Preview location in maps':'Open shared location in maps'} onPress={()=>open(locationMapURL(pin))} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontWeight:'700',textDecorationLine:'underline'}}>{draft?'Preview point':'Open shared pin'}</Text></Pressable>
   {!draft&&<Pressable accessibilityRole="link" accessibilityLabel="Get directions to shared location" onPress={()=>open(locationDirectionsURL(pin))} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontWeight:'700',textDecorationLine:'underline'}}>Directions to pin</Text></Pressable>}
  </View>
 </View>;
}
