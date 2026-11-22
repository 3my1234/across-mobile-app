import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {DiscoveryCard, discoveryFeed} from './discoveryClient';
import {SponsoredViewer} from './SponsoredViewer';
import {customerEntryEnabled} from './customerEntryConfig';

export function CustomerEntryAds({token, market, onClose, onDetails}: {token:string; market:{country:string;state:string;city:string}; onClose:()=>void; onDetails:(card:DiscoveryCard)=>void}) {
 const [cards,setCards]=useState<DiscoveryCard[]|null>(null);
 useEffect(()=>{let live=true;void Promise.all([customerEntryEnabled(),discoveryFeed({owner:token,...market})]).then(([enabled,feed])=>{
  if(live)setCards(enabled?feed.promoted.filter(card=>card.placement==='promoted'):[]);
 }).catch(()=>{if(live)setCards([]);});return()=>{live=false;};},[token,market.country,market.state,market.city]);
 useEffect(()=>{if(cards?.length===0)onClose();},[cards]);
 const first=cards?.[0];
 if(first)return <SponsoredViewer cards={cards} selected={first} token={token} active entry market={market} onClose={onClose} onDetails={onDetails}/>;
 return <Modal visible animationType="fade" onRequestClose={onClose}><View style={{flex:1,backgroundColor:'#060A08',alignItems:'center',justifyContent:'center',gap:20,padding:24}}>
  {cards===null?<><ActivityIndicator color="#75FFCB"/><Text style={{color:'#fff'}}>Loading sponsored listings…</Text></>:<Text style={{color:'#fff',textAlign:'center'}}>No sponsored listings available right now.</Text>}
  <Pressable accessibilityRole="button" onPress={onClose} style={{padding:16}}><Text style={{color:'#75FFCB',fontWeight:'700'}}>Go to Home</Text></Pressable>
 </View></Modal>;
}
