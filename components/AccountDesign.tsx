import React from 'react';
import {Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ThemedText as Text,useTheme} from './ThemeProvider';

export function useAccountDesign(){const {dark}=useTheme();return {dark,
 background:dark?'#0D211B':'#EFF8F4',surface:dark?'#182F28':'#FFFFFF',
 text:dark?'#F0F8F4':'#14231E',muted:dark?'#C0CEC7':'#5B6B63',
 line:dark?'#345047':'#DCECE4',soft:dark?'#1D493B':'#E3F8EF',
 accent:dark?'#69E4BB':'#087B58',danger:dark?'#FF999E':'#B42332'};}
export function AccountIcon({name}:{name:React.ComponentProps<typeof Ionicons>['name']}){const c=useAccountDesign();return <View style={[accountDesign.icon,{backgroundColor:c.soft}]}><Ionicons name={name} size={23} color={c.accent}/></View>;}
export function AccountSectionHeading({icon,title,subtitle}:{icon:React.ComponentProps<typeof Ionicons>['name'];title:string;subtitle?:string}){const c=useAccountDesign();return <View style={accountDesign.heading}><AccountIcon name={icon}/><View style={{flex:1,gap:3}}><Text preserveTypography style={[accountDesign.title,{color:c.text}]}>{title}</Text>{!!subtitle&&<Text style={[accountDesign.body,{color:c.muted}]}>{subtitle}</Text>}</View></View>;}
export function XPRewardSummary({balance,claimed,busy,onClaim}:{balance:number;claimed:boolean;busy:boolean;onClaim:()=>void}){const c=useAccountDesign();const rules:[React.ComponentProps<typeof Ionicons>['name'],string][]=[['server-outline','1 XP = ₦1'],['person-add-outline','New account: 5 XP'],['calendar-outline','Daily login: 1 XP'],['star-outline','First verified review: 1 XP'],['cart-outline','Completed NGN purchases: 1 XP per ₦1,000, up to 25 XP per order.'],['ban-outline','XP cannot be used at checkout.']];return <View style={[accountDesign.card,{backgroundColor:c.surface,borderColor:c.line}]}>
 <View style={accountDesign.heading}><AccountIcon name="star"/><View style={{flex:1}}><Text style={[accountDesign.eyebrow,{color:c.muted}]}>XP REWARDS</Text><Text preserveTypography style={[accountDesign.balance,{color:c.text}]}>{balance.toLocaleString()} XP</Text><Text style={[accountDesign.body,{color:c.muted}]}>₦{balance.toLocaleString()} available as XP</Text></View><Pressable accessibilityRole="button" disabled={claimed||busy} onPress={onClaim} style={[accountDesign.claim,{backgroundColor:claimed?c.soft:'#087B58',borderColor:c.line}]}><Text style={{fontWeight:'700',color:claimed?c.text:'#FFFFFF'}}>{claimed?'Claimed':busy?'Claiming…':'Claim 1 XP'}</Text></Pressable></View>
 <View accessibilityRole="progressbar" accessibilityLabel="Progress to minimum XP withdrawal" accessibilityValue={{min:0,max:1000,now:Math.min(1000,Math.max(0,balance))}} style={[accountDesign.track,{backgroundColor:c.line}]}><View style={{width:`${Math.min(100,Math.max(0,balance)/10)}%`,height:'100%',backgroundColor:c.accent,borderRadius:8}}/></View><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={[accountDesign.caption,{color:c.muted}]}>{Math.min(balance,1000).toLocaleString()} / 1,000 XP</Text><Text style={[accountDesign.caption,{color:c.muted}]}>{Math.max(0,1000-balance).toLocaleString()} XP to go</Text></View>
 <View style={accountDesign.rules}>{rules.map(([icon,label],i)=><View key={label} style={[accountDesign.rule,{width:i<4?'48.5%':'100%',borderColor:c.line}]}><Ionicons name={icon} size={19} color={c.accent}/><Text style={[accountDesign.caption,{flex:1,color:c.text}]}>{label}</Text></View>)}</View>
 </View>;}
export const accountDesign=StyleSheet.create({
 card:{padding:16,borderRadius:18,borderWidth:1,marginBottom:12,gap:10},
 heading:{flexDirection:'row',alignItems:'center',gap:12},icon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},
 title:{fontSize:16,fontWeight:'700',lineHeight:22},body:{fontSize:13,lineHeight:19},caption:{fontSize:12,lineHeight:17},eyebrow:{fontSize:11,fontWeight:'600',letterSpacing:.7},balance:{fontSize:26,lineHeight:32,fontWeight:'800'},
 claim:{paddingHorizontal:16,minHeight:44,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center'},track:{height:10,borderRadius:8,overflow:'hidden',marginTop:4},
 rules:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:2},rule:{borderWidth:1,borderRadius:10,padding:9,flexDirection:'row',alignItems:'center',gap:8,minHeight:40},
 action:{minHeight:46,borderRadius:12,borderWidth:1,padding:12,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9},
 themeTile:{flex:1,alignItems:'center',justifyContent:'center',gap:8,borderRadius:12,borderWidth:1,padding:12,minHeight:80},
 });
