import React from 'react';
import {View,type TextProps} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
export function CrossedPrice({style,children,...props}:TextProps){return <View style={{alignSelf:'flex-start',maxWidth:'100%',justifyContent:'center'}}><Text {...props} style={style}>{children}</Text><View pointerEvents="none" style={{position:'absolute',left:0,right:0,height:2,backgroundColor:'#C62828'}}/></View>;}
