import React from 'react';
import {Alert, Pressable, View} from 'react-native';
import {ThemedText as Text, useTheme} from './ThemeProvider';

export const customerTransportSafety = 'Before entering a vehicle or handing over a parcel, compare the driver/rider’s face, vehicle or bike and number plate with the reviewed photos. Ask questions if anything differs. You can decline to proceed if you are unsure. Document review is not a guarantee of safety.';
export const driverTransportSafety = 'Use only the vehicle/bike and plate you submitted for review. Submit changes before going online again. Confirm the customer’s name and agreed pickup details; a profile picture may not show their real face. You may ask for clarification or a recent photo shared voluntarily in your private chat. Do not demand identity documents or rely on an avatar as verification. Decline if you feel unsafe.';

export function TransportSafetyNotice({audience, compact = false}: {audience: 'customer' | 'driver'; compact?: boolean}) {
  const guidance = audience === 'customer' ? customerTransportSafety : driverTransportSafety;
  const {dark} = useTheme();
  const warning = dark ? '#FFB4AB' : '#A51D2D';
  if (compact) return <Pressable accessibilityRole="button" accessibilityLabel="Before pickup. Read safety guidance" onPress={() => Alert.alert('Pickup safety', guidance)} style={{paddingHorizontal:9,paddingVertical:7,minHeight:44,borderRadius:9,borderWidth:1,borderColor:dark?'#784047':'#E3A7AF',backgroundColor:dark?'#391C22':'#FFF0F1',marginBottom:6,gap:2}}>
    <Text style={{fontSize:12,lineHeight:16,fontWeight:'700',color:warning}}>Before pickup</Text>
    <Text style={{fontSize:11,lineHeight:15,color:warning}}>Compare the face, vehicle/bike and plate with reviewed photos. Ask questions or decline if anything differs. Tap for safety guidance.</Text>
  </Pressable>;
  return <View style={{padding:12,gap:5}}><Text style={{fontWeight:'700'}}>Before pickup</Text><Text>{guidance}</Text></View>;
}
