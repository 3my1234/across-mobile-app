import React from 'react';
import {View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ThemedText as Text,useTheme} from './ThemeProvider';
import type {MessageReceipt as Receipt} from './messageReceipts';
export function MessageReceipt({receipt,group=false}:{receipt?:Receipt;group?:boolean}){
 const {dark}=useTheme(),status=receipt?.status||'sent';
 if(group)return <Text style={{fontSize:10,opacity:.75}} accessibilityLabel={`Delivered to ${receipt?.delivered_count||0}, seen by ${receipt?.read_count||0}`}>{receipt?.read_count?`Seen by ${receipt.read_count}`:receipt?.delivered_count?`Delivered to ${receipt.delivered_count}`:'Sent'}</Text>;
 return <View accessible accessibilityLabel={status==='read'?'Read':status==='delivered'?'Delivered to recipient':'Sent to Atlantic Express'}><Ionicons name={status==='sent'?'checkmark':'checkmark-done'} size={16} color={status==='read'?'#53BDEB':dark?'#AAB6BC':'#66736F'}/></View>;
}
