import * as Clipboard from 'expo-clipboard';
import * as Application from 'expo-application';
import {driverLocationTimeline} from './driverLocationTask';
import {TransportSafetyNotice} from './TransportSafetyNotice';
import {setAutomaticDriverAvailability} from './automaticDriverAvailability';
import {transportServiceKind} from './transportServices';
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Platform, Pressable, View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {providerAvailabilitySession} from './driverPresenceSession';

type Service = {id: string; title: string; category?: string; status?: string};
export function NativeProviderDriver({token, providerID, onManage}: {token: string; providerID: string; onManage?: (view: 'catalog' | 'verification' | 'subscription') => void}) {
  const c = useAccountDesign();
  const actionFlight=useRef(false);
  const [items, setItems] = useState<Service[]>([]), [selected, setSelected] = useState('');
  const [cursor, setCursor] = useState(''), [page, setPage] = useState(''), [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true), [online, setOnline] = useState(false), [busy, setBusy] = useState(false), [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('Offline. Choose a service to become available nearby.'), [error, setError] = useState('');
  const [presence, setPresence] = useState<ReturnType<typeof providerAvailabilitySession> | null>(null);
  useEffect(() => {
    let alive = true;
    const session = providerAvailabilitySession(token,providerID);
    const unsubscribe=session.subscribe((available,text,pending)=>{if(alive){setOnline(available);setMessage(text);setStarting(pending);}});
    setPresence(session);setSelected(session.listingID);
    // App lifecycle owns the lease. Leaving this panel to answer chats does
    // not silently switch availability off; background/sign-out still stop it.
    return()=>{alive=false;unsubscribe();};
  }, [token, providerID]);
  useEffect(() => {
    let alive = true; setLoading(true); setError('');
    const query = new URLSearchParams({limit: '25'}); if (page) query.set('cursor', page);
    void providerRequest(token, `/providers/me/listings?${query}`).then(data => {
      if (!alive) return;
      const drivers = (data.items || []).filter((item: Service) => transportServiceKind(item.category,item.title)!==null);
      setItems(old => page ? [...old, ...drivers.filter((item: Service) => !old.some(existing => existing.id === item.id))] : drivers);
      setCursor(data.page?.next_cursor || data.next_cursor || '');
      if(!page){const approved=drivers.filter((item:Service)=>item.status==='approved');setSelected(previous=>approved.some((item:Service)=>item.id===previous)?previous:approved.length===1?approved[0].id:'');}
    }).catch(failure => {if (alive) setError(failure instanceof Error ? failure.message : 'Could not load driver services.');})
      .finally(() => {if (alive) setLoading(false);});
    return () => {alive = false;};
  }, [token, page, reload]);
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} hitSlop={0} pressRetentionOffset={0} onPress={action} style={{padding: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, opacity: disabled ? .5 : 1}}><View pointerEvents="none"><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></View></Pressable>;
  return <View style={{gap: 12}}>
    <TransportSafetyNotice audience="driver"/>
    <Text>With location permission, verified subscribed drivers become visible automatically while ATL Xpress is open. Go offline to pause visibility. Location updates continue across ATL Xpress screens. On Android, an ongoing notification keeps your availability updated when minimized. Signing out or Go offline stops sharing. Availability expires within two minutes without an update.</Text>
    <Text>Customers see approximate distance. Your exact location is shared in chat only when you explicitly send a location pin.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Loading driver services"/>}
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
    {items.filter(item => item.status === 'approved').map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{checked: selected === item.id, disabled: online || starting || busy}} disabled={online || starting || busy} onPress={() => setSelected(item.id)} style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: selected === item.id ? c.soft : c.surface}}><Text>{item.title}</Text></Pressable>)}
    {items.filter(item => item.status !== 'approved').map(item => <View key={item.id} style={{padding:10,borderWidth:1,borderColor:c.line,borderRadius:10,gap:4}}><Text style={{fontWeight:'700'}}>{item.title}</Text><Text>{item.status === 'pending' ? 'Awaiting service approval' : item.status === 'rejected' ? 'Service changes required' : item.status === 'suspended' ? 'Service suspended - contact Support' : 'Service not approved yet'}</Text></View>)}
    {!items.some(item => item.status === 'approved') && !loading && !error && <View accessibilityLiveRegion="polite" style={{gap:6}}><Text style={{fontWeight:'700',color:c.danger}}>No approved driver or courier service to select{cursor ? ' in these results' : ''}.</Text><Text>{items.length ? 'Your transport service needs approval before you can go online. Open Listings to check its review status.' : 'Registering as a driver does not create a transport service. Open Listings to create or check your driver/courier service.'}</Text></View>}
    <Text>Going online requires an approved transport service, an active paid subscription and approved current licence/ID, face, vehicle, plate and vehicle registration. Updating the app does not approve these items.</Text>
    {onManage && <View style={{gap:6}}>{button('Check listings', () => onManage('catalog'))}{button('Check verification documents', () => onManage('verification'))}{button('Check subscription', () => onManage('subscription'))}</View>}
    {!!cursor && button('Load more services', () => setPage(cursor), loading || busy || online)}
    {button('Refresh services', () => {setPage(''); setReload(value => value + 1);}, loading || busy || online)}
    <View style={{minHeight:36}}><Text numberOfLines={5} accessibilityLiveRegion="polite">{message}</Text></View>
    {button('Available for customers', () => {if(actionFlight.current)return;actionFlight.current=true;setBusy(true);void setAutomaticDriverAvailability(providerID,true).then(()=>presence?.start(selected)).catch(failure=>setError(failure.message)).finally(()=>{actionFlight.current=false;setBusy(false);});}, loading || !items.some(item => item.id === selected && item.status === 'approved') || !presence || online || starting || busy)}
    {button('Go offline', () => {if(actionFlight.current)return;actionFlight.current=true;setBusy(true); void Promise.all([setAutomaticDriverAvailability(providerID,false),presence?.stop()]).catch(failure=>setError(failure.message)).finally(() => {actionFlight.current=false;setBusy(false);});}, !presence || busy)}
    {button('Copy availability report', () => {void Clipboard.setStringAsync(JSON.stringify({feature:'driver-continuity-v2',application_version:Application.nativeApplicationVersion,build:Application.nativeBuildVersion,platform:Platform.OS,generated_at:new Date().toISOString(),timeline:driverLocationTimeline(token)},null,2)).then(()=>Alert.alert('Availability report copied','You can share this report with Support. It contains no coordinates or sign-in details.')).catch(()=>setError('Could not copy the availability report.'));})}
  </View>;
}
