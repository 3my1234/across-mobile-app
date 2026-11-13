import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ThemedText as Text, useTheme} from './ThemeProvider';
import {ResilientImage} from './ResilientImage';
import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';
import {TransportSafetyNotice} from './TransportSafetyNotice';

type Profile = {driver_name: string; face_photo_url: string; vehicle_photo_url: string; plate_photo_url: string; expires_in: number};
export function validDriverSafetyProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Profile;
  if (typeof profile.driver_name !== 'string' || !profile.driver_name.trim()) return false;
  if (!Number.isFinite(profile.expires_in) || profile.expires_in <= 0 || profile.expires_in > 300) return false;
  return [profile.face_photo_url, profile.vehicle_photo_url, profile.plate_photo_url].every(raw => {
    try {const url = new URL(raw); return typeof raw === 'string' && url.protocol === 'https:' && !url.username && !url.password;} catch {return false;}
  });
}

// No persistence or public-image cache: every opening obtains fresh reviewed
// photo links. Never substitute a business avatar for the driver's face.
export function DriverSafetyProfile({token, listingID, onClose, onOpenService}: {token: string; listingID: string; onClose: () => void; onOpenService: () => void}) {
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let expiration: ReturnType<typeof setTimeout> | undefined;
    setProfile(null); setError(''); setLoading(true);
    void fetchJSONWithTimeout(`${API_URL}/api/v1/marketplace/drivers/${encodeURIComponent(listingID)}/safety-profile`, {signal: controller.signal, headers: {Authorization: `Bearer ${token}`}}).then(({response, body}) => {
      if (!active) return;
      if (!response.ok || !validDriverSafetyProfile(body)) throw new Error('Reviewed photos are unavailable. Refresh nearby drivers or try again.');
      setProfile(body);
      expiration = setTimeout(() => {if (active) {setProfile(null); setError('These photo links have expired. Reload the reviewed photos before pickup.');}}, body.expires_in * 1000);
    }).catch(() => {if (active) setError('Reviewed photos are unavailable. Refresh nearby drivers or try again.');}).finally(() => {if (active) setLoading(false);});
    return () => {active = false; controller.abort(); if (expiration) clearTimeout(expiration);};
  }, [token, listingID, retry]);
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" onPress={action} style={{minHeight:48,padding:14,borderWidth:1,borderColor:theme.color('#00875E'),borderRadius:12}}><Text>{label}</Text></Pressable>;
  return <Modal animationType="slide" onRequestClose={onClose}><SafeAreaView style={{flex:1,backgroundColor:theme.color('#FFFFFF','backgroundColor')}}><ScrollView contentContainerStyle={{padding:16,gap:12}}>
    {button('Close driver photos', onClose)}<Text accessibilityRole="header" style={{fontSize:20,fontWeight:'700'}}>Driver/rider and vehicle</Text>
    <TransportSafetyNotice audience="customer"/>
    {loading && <ActivityIndicator accessibilityLabel="Loading reviewed driver photos"/>}
    {!!error && <><Text accessibilityRole="alert">{error}</Text>{button('Retry driver photos', () => setRetry(value => value + 1))}</>}
    {profile && <><Text style={{fontSize:18,fontWeight:'700'}}>{profile.driver_name}</Text>{([
      ['Face to compare at pickup', profile.face_photo_url], ['Exact vehicle / bike', profile.vehicle_photo_url], ['Number plate', profile.plate_photo_url]
    ] as const).map(([label, uri]) => <View key={label} style={{gap:6}}><Text>{label}</Text><ResilientImage uri={uri} fallbackUri="" accessibilityLabel={label} contentFit="contain" cachePolicy="memory" style={{width:'100%',height:260}}/></View>)}</>}
    {button('View service and chat', onOpenService)}
  </ScrollView></SafeAreaView></Modal>;
}
