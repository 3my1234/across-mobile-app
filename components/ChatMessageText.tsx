import React from 'react';
import {Alert,Linking,Share,TextProps} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import {chatTextParts} from './chatLinks';

async function copy(text:string){try{await Clipboard.setStringAsync(text);}catch{Alert.alert('Copy unavailable','Please select the message text and copy it.');}}
async function share(text:string){try{await Share.share({message:text});}catch{Alert.alert('Sharing unavailable','Please try again.');}}
async function open(url:string){try{await Linking.openURL(url);}catch{Alert.alert('Could not open link','You can copy the link and open it in your browser.');}}
export function ChatMessageText({text,prefix,onReply,...props}:TextProps&{text:string;prefix?:React.ReactNode;onReply?:()=>void}){
 const {dark}=useTheme();
 const actions=()=>Alert.alert('Message',undefined,[...(onReply?[{text:'Reply',onPress:onReply}]:[]),{text:'Copy message',onPress:()=>void copy(text)},{text:'Share message',onPress:()=>void share(text)},{text:'Cancel',style:'cancel'}]);
 return <Text {...props} selectable onLongPress={actions}>{prefix}{chatTextParts(text).map((part,index)=>part.url?<Text key={index} accessibilityRole="link" accessibilityLabel={part.url} style={{color:dark?'#8BCCFF':'#075CAA',textDecorationLine:'underline'}} onPress={()=>void open(part.url!)} onLongPress={()=>Alert.alert('Link',part.url,[{text:'Open link',onPress:()=>void open(part.url!)},{text:'Copy link',onPress:()=>void copy(part.url!)},{text:'Share link',onPress:()=>void share(part.url!)},{text:'Cancel',style:'cancel'}])}>{part.text}</Text>:part.text)}</Text>;
}
