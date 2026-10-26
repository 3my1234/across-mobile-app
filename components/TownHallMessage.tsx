import {ChatMessageText} from './ChatMessageText';
import {MessageReceipt} from './MessageReceipt';
import type {MessageReceipt as Receipt} from './messageReceipts';
import React,{useRef} from 'react';
import {LocationPin} from './LocationPin';
import {Image,PanResponder,Pressable,View} from 'react-native';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import type {ProviderMessage} from './ProviderConversation';
export function TownHallMessage({message,onPhoto,receipt,onReply}:{onReply:(message:ProviderMessage)=>void;receipt?:Receipt;message:ProviderMessage;onPhoto:(uri:string)=>void}){
 const latest=useRef({message,onReply});latest.current={message,onReply};
 const gesture=useRef(PanResponder.create({onMoveShouldSetPanResponder:(_,g)=>Math.abs(g.dx)>18&&Math.abs(g.dx)>Math.abs(g.dy)*2,onPanResponderRelease:(_,g)=>{if(Math.abs(g.dx)>=55&&Math.abs(g.dy)<35)latest.current.onReply(latest.current.message);}})).current;
 const {dark}=useTheme(),name=message.sender_name||(message.is_mine?'You':'Provider');
 const colours=dark?['#D5ABEB','#A9D7FA','#A6E0BC','#F3D29C','#EFB2CA']:['#64357C','#164F75','#256147','#805014','#8D3550'];
 const colour=colours[Array.from(name).reduce((sum,c)=>sum+c.charCodeAt(0),0)%colours.length];
 return <Pressable {...gesture.panHandlers} accessibilityLabel={`Message from ${name}: ${message.body}. Hold for message actions or swipe to reply.`} accessibilityActions={[{name:'reply',label:'Reply to message'}]} onAccessibilityAction={event=>{if(event.nativeEvent.actionName==='reply')onReply(message);}} style={{paddingVertical:4,width:'100%'}}>{message.reply_to&&<View style={{borderLeftWidth:3,borderLeftColor:'#12805F',padding:8,marginBottom:4,backgroundColor:dark?'#203A41':'#DDECE6'}}><Text style={{fontSize:12,fontWeight:'700'}}>{message.reply_to.sender_name}</Text><Text numberOfLines={3} style={{fontSize:12}}>{message.reply_to.body||(message.reply_to.has_media?'Photo':message.reply_to.has_location?'Location pin':'Message')}</Text></View>}<ChatMessageText style={{fontSize:14,lineHeight:22}} text={message.body} onReply={()=>onReply(message)} prefix={<Text style={{fontSize:12,fontWeight:'700',color:colour,backgroundColor:dark?'#284450':'#D3E4EC'}}> {name} </Text>}/><LocationPin pin={message.location}/>{(message.media_urls||[]).map(uri=><Pressable key={uri} onPress={()=>onPhoto(uri)} accessibilityLabel="View chat photo"><Image source={{uri}} style={{width:180,height:150,borderRadius:8,marginTop:6}} resizeMode="cover"/></Pressable>)}<Text style={{fontSize:9,opacity:.65}}>{new Date(message.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>{message.is_mine&&<MessageReceipt receipt={receipt} group/>}</Pressable>;
}
