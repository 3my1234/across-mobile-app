import React from 'react';
import {Image,Pressable,View} from 'react-native';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import type {ProviderMessage} from './ProviderConversation';
export function TownHallMessage({message,onPhoto}:{message:ProviderMessage;onPhoto:(uri:string)=>void}){
 const {dark}=useTheme(),name=message.sender_name||(message.is_mine?'You':'Provider');
 const colours=dark?['#D5ABEB','#A9D7FA','#A6E0BC','#F3D29C','#EFB2CA']:['#64357C','#164F75','#256147','#805014','#8D3550'];
 const colour=colours[Array.from(name).reduce((sum,c)=>sum+c.charCodeAt(0),0)%colours.length];
 return <View style={{paddingVertical:4,width:'100%'}}><Text style={{fontSize:14,lineHeight:22}}><Text style={{fontSize:12,fontWeight:'700',color:colour,backgroundColor:dark?'#284450':'#D3E4EC'}}> {name} </Text>{' '}{message.body}</Text>{(message.media_urls||[]).map(uri=><Pressable key={uri} onPress={()=>onPhoto(uri)} accessibilityLabel="View chat photo"><Image source={{uri}} style={{width:180,height:150,borderRadius:8,marginTop:6}} resizeMode="cover"/></Pressable>)}<Text style={{fontSize:9,opacity:.65}}>{new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text></View>;
}
