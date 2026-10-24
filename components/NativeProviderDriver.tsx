import React, {useEffect, useState} from 'react';
import {ActivityIndicator, AppState, Pressable, View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {currentForegroundLocation} from './foregroundLocation';
import {createDriverPresence} from './providerDriverPresence';

type Service = {id: string; title: string; category?: string; status?: string};
export function NativeProviderDriver({token, providerID}: {token: string; providerID: string}) {
  const c = useAccountDesign();
  const [items, setItems] = useState<Service[]>([]), [selected, setSelected] = useState('');
  const [cursor, setCursor] = useState(''), [page, setPage] = useState(''), [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true), [online, setOnline] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Offline. Choose a service to become available nearby.'), [error, setError] = useState('');
  const [presence, setPresence] = useState<ReturnType<typeof createDriverPresence> | null>(null);
  useEffect(() => {
    let alive = true;
    const session = createDriverPresence({
      sessionKey: providerID,
      capture: currentForegroundLocation,
      publish: payload => providerRequest(token, '/providers/me/driver-availability', {method: 'PUT', body: JSON.stringify(payload)}),
      remove: () => providerRequest(token, '/providers/me/driver-availability', {method: 'DELETE'}),
      foreground: () => alive && AppState.currentState === 'active',
      state: (available, text) => {if (alive) {setOnline(available); setMessage(text);}},
    });
    setPresence(session);
    const listener = AppState.addEventListener('change', state => {if (state !== 'active') void session.stop();});
    return () => {alive = false; listener.remove(); void session.stop();};
  }, [token, providerID]);
  useEffect(() => {
    let alive = true; setLoading(true); setError('');
    const query = new URLSearchParams({status: 'approved', limit: '25'}); if (page) query.set('cursor', page);
    void providerRequest(token, `/providers/me/listings?${query}`).then(data => {
      if (!alive) return;
      const drivers = (data.items || []).filter((item: Service) => item.status === 'approved' && /driver|chauffeur|taxi/i.test(item.category || ''));
      setItems(old => page ? [...old, ...drivers.filter((item: Service) => !old.some(existing => existing.id === item.id))] : drivers);
      setCursor(data.page?.next_cursor || data.next_cursor || '');
    }).catch(failure => {if (alive) setError(failure instanceof Error ? failure.message : 'Could not load driver services.');})
      .finally(() => {if (alive) setLoading(false);});
    return () => {alive = false;};
  }, [token, page, reload]);
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{padding: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, opacity: disabled ? .5 : 1}}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  return <View style={{gap: 12}}>
    <Text>Keep this screen open while available. Going into the background stops location updates. Availability expires within two minutes without an update.</Text>
    <Text>Customers see approximate distance. Your exact location is shared in chat only when you explicitly send a location pin.</Text>
    {loading && <ActivityIndicator accessibilityLabel="Loading approved driver services"/>}
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
    {items.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{checked: selected === item.id, disabled: online || busy}} disabled={online || busy} onPress={() => setSelected(item.id)} style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: selected === item.id ? c.soft : c.surface}}><Text>{item.title}</Text></Pressable>)}
    {!items.length && !loading && !error && <Text>Create a driver service and have it and all three driver documents approved first. The server checks approval every time availability updates.</Text>}
    {!!cursor && button('Load more services', () => setPage(cursor), loading || busy || online)}
    {button('Refresh services', () => {setPage(''); setReload(value => value + 1);}, loading || busy || online)}
    <Text accessibilityLiveRegion="polite">{message}</Text>
    {button('Available nearby', () => {if (presence && !presence.start(selected)) setMessage('Wait for the current update to finish, keep the app open, then retry.');}, !selected || !presence || online || busy)}
    {button('Go offline', () => {setBusy(true); void presence?.stop().finally(() => setBusy(false));}, !presence || busy)}
  </View>;
}
