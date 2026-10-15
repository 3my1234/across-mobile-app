import React from 'react';
import {Pressable,Linking} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {ChatLocation,validLocation,locationMapURL} from './chatLocation';
export function LocationPin({pin}:{pin?:ChatLocation|null}){if(!validLocation(pin))return null;return <Pressable accessibilityRole="link" accessibilityLabel="Open shared location in maps" onPress={()=>void Linking.openURL(locationMapURL(pin))} style={{paddingVertical:10,minWidth:150}}><Text style={{fontWeight:'700'}}>📍 Shared location</Text><Text style={{fontSize:12}}>Tap to open in maps · static pin</Text></Pressable>;}
