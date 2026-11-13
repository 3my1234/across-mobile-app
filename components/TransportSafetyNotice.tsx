import React from 'react';
import {Alert, Pressable, View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';

export const customerTransportSafety = 'Before entering a vehicle or handing over a parcel, compare the driver/rider’s face, vehicle or bike and number plate with the reviewed photos. Ask questions if anything differs. You can decline to proceed if you are unsure. Document review is not a guarantee of safety.';
export const driverTransportSafety = 'Use only the vehicle/bike and plate you submitted for review. Submit changes before going online again. Confirm the customer’s name and agreed pickup details; a profile picture may not show their real face. You may ask for clarification or a recent photo shared voluntarily in your private chat. Do not demand identity documents or rely on an avatar as verification. Decline if you feel unsafe.';

export function TransportSafetyNotice({audience, compact = false}: {audience: 'customer' | 'driver'; compact?: boolean}) {
  const guidance = audience === 'customer' ? customerTransportSafety : driverTransportSafety;
  return <View style={{padding:12,gap:5}}><Text style={{fontWeight:'700'}}>Before pickup</Text><Text>{compact ? 'Compare the face, vehicle/bike and plate with reviewed photos. Ask questions or decline if anything differs.' : guidance}</Text>{compact && <Pressable accessibilityRole="button" onPress={() => Alert.alert('Pickup safety', guidance)} style={{minHeight:44,justifyContent:'center'}}><Text>Read safety guidance</Text></Pressable>}</View>;
}
