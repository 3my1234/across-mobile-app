import {ProviderPanel} from './ProviderPanel';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, AppState, Pressable, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {providerInboxItems, ProviderInboxItem} from './providerInboxPolicy';

export function NativeProviderNotifications({embedded = false, token, hasProvider, onClose, onOpen}: {embedded?: boolean; token: string; hasProvider: boolean; onClose: () => void; onOpen: (notification: Record<string, unknown>) => void}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets;
  const [items, setItems] = useState<ProviderInboxItem[]>([]), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const epoch = useRef(0), alive = useRef(true), reading = useRef(false), writing = useRef(false);
  const load = useCallback(async () => {
    if (reading.current || !alive.current) return; reading.current = true;
    const version = ++epoch.current; setLoading(true); setError('');
    try {
      const [provider, account] = await Promise.all([hasProvider ? providerRequest(token, '/providers/me/notifications?limit=50') : Promise.resolve({items: []}), providerRequest(token, '/notifications')]);
      if (alive.current && version === epoch.current) setItems(providerInboxItems(provider, account));
    } catch (failure) {if (alive.current && version === epoch.current) setError(failure instanceof Error ? failure.message : 'Notifications could not load. Retry.');}
    finally {reading.current = false; if (alive.current && version === epoch.current) setLoading(false);}
  }, [token, hasProvider]);
  const invalidate = useCallback(() => {alive.current = false; epoch.current++;}, []);
  useEffect(() => {alive.current = true; void load(); const listener = AppState.addEventListener('change', state => {if (state === 'active' && !writing.current) void load();}); return () => {invalidate(); listener.remove();};}, [load, invalidate]);
  const markAll = async () => {
    if (writing.current || reading.current || !alive.current) return; writing.current = true; setBusy(true); setError('');
    try {
      await Promise.all([hasProvider ? providerRequest(token, '/providers/me/notifications/read-all', {method: 'PATCH'}) : Promise.resolve(), providerRequest(token, '/notifications/read-all', {method: 'PATCH'})]);
      if (alive.current) await load();
    } catch {if (alive.current) setError('Read status could not be fully confirmed. Some items may have updated; refresh before retrying.');}
    finally {writing.current = false; if (alive.current) setBusy(false);}
  };
  return <ProviderPanel embedded={embedded} onClose={onClose}><View style={{flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: c.background}}>
    <View style={{padding: 16, gap: 12}}><Pressable accessibilityRole="button" onPress={onClose} style={{minHeight: 44}}><Text>Back</Text></Pressable><Text style={{fontSize: 22, fontWeight: '700'}}>Notifications</Text><Text>{items.filter(item => !item.is_read).length} unread in this list</Text>
      <Pressable accessibilityRole="button" disabled={loading || busy} onPress={() => void load()} style={{minHeight: 44}}><Text>Refresh notifications</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={loading || busy || !items.some(item => !item.is_read)} onPress={() => void markAll()} style={{minHeight: 44}}><Text>Mark all as read</Text></Pressable>
      {(loading || busy) && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
    </View>
    <ScrollView contentContainerStyle={{padding: 16, gap: 12}}>{items.map(item => <Pressable key={`${item.source}:${item.id}`} accessibilityRole="button" onPress={() => onOpen(item.notification)} style={{padding: 16, gap: 8, borderWidth: 1, borderRadius: 14, borderColor: c.line, backgroundColor: item.is_read ? c.surface : c.soft}}><Text style={{fontWeight: '700'}}>{item.title}</Text><Text>{item.body}</Text><Text>{item.source === 'provider' ? 'Business' : 'Account'} · {new Date(item.created_at).toLocaleString()}{item.is_read ? '' : ' · Unread'}</Text></Pressable>)}{!items.length && !loading && !error && <Text>No notifications yet.</Text>}</ScrollView>
  </View></ProviderPanel>;
}
