import {KeyboardScrollView as ScrollView} from './KeyboardScroll';
import {ProviderPanel} from './ProviderPanel';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Pressable,  View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {KeyboardFrame} from './KeyboardFrame';
import {providerRequest} from './nativeProviderApi';
import {bookingActions, bookingFilters, bookingTransition, ProviderBooking} from './providerBookingPolicy';
import {loadBookingImages} from './providerBookingImages';
import {ProviderPostImages} from './ProviderPostImages';

export function NativeProviderRequests({embedded = false, token, onClose, requestID = ''}: {embedded?: boolean; token: string; onClose: () => void; requestID?: string}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets;
  const [target, setTarget] = useState(requestID);
  const [items, setItems] = useState<ProviderBooking[]>([]), [cursor, setCursor] = useState('');
  const [photos, setPhotos] = useState<Record<string, string[] | null>>({});
  const [photosLoading, setPhotosLoading] = useState(false);
  const [status, setStatus] = useState(''), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(true), generation = useRef(0), mutation = useRef(false), paging = useRef(false);
  const invalidate = useCallback(() => {generation.current++;}, []);
  useEffect(() => {alive.current = true; return () => {alive.current = false; invalidate();};}, [invalidate]);
  const load = useCallback(async (next = '') => {
    if (next && paging.current) return;
    paging.current = true; const version = ++generation.current; setLoading(true); setPhotosLoading(false); setError('');
    try {
      const params = new URLSearchParams({limit: '25'}); if (status) params.set('status', status); if (query.trim()) params.set('search', query.trim()); if (next) params.set('cursor', next);
      if (target) {params.set('request_id', target); params.delete('status'); params.delete('search');}
      const data = await providerRequest(token, `/providers/me/requests?${params}`);
      const rows = target ? (data.items || []).filter((item: ProviderBooking) => item.id === target) : data.items || [];
      if (target && !rows.length) throw Error('This request is unavailable or you no longer have access.');
      if (alive.current && version === generation.current) {
        if (!next) setPhotos({});
        setItems(old => next ? [...old, ...rows.filter((item: ProviderBooking) => !old.some(existing => existing.id === item.id))] : rows); setCursor(target ? '' : data.next_cursor || '');
        // Images load after booking content; image failures never hide requests.
        setPhotosLoading(true);
        void loadBookingImages(token, rows, () => alive.current && version === generation.current, (id, urls) => setPhotos(old => ({...old, [id]: urls})))
          .finally(() => {if (alive.current && version === generation.current) setPhotosLoading(false);});
      }
    } catch (failure) {if (alive.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Requests could not load. Retry.');}
    finally {if (version === generation.current) {paging.current = false; if (alive.current) setLoading(false);}}
  }, [token, status, query, target]);
  useEffect(() => {setItems([]); setCursor(''); void load(); return invalidate;}, [load, invalidate]);
  const update = (item: ProviderBooking, next: string) => {
    if (mutation.current) return;
    Alert.alert(`${next === 'accepted' ? 'Accept' : next === 'rejected' ? 'Reject' : 'Complete'} this request?`, `${item.listing_title}. The customer will see the updated status.`, [
      {text: 'Cancel', style: 'cancel'}, {text: 'Confirm', style: next === 'rejected' ? 'destructive' : 'default', onPress: () => {void (async () => {
        if (mutation.current || !alive.current) return;
        mutation.current = true; generation.current++; setBusy(true); setError(''); setNotice('');
        try {await providerRequest(token, `/providers/me/requests/${item.id}`, {method: 'PATCH', body: JSON.stringify(bookingTransition(item, next))}); if (alive.current) {setNotice(`Request ${next}.`); await load();}}
        catch (failure) {if (alive.current) setError(`${failure instanceof Error ? failure.message : 'The update could not be confirmed.'} Refresh before trying again.`);}
        finally {mutation.current = false; if (alive.current) {setBusy(false); setLoading(false); paging.current = false;}}
      })();}},
    ]);
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled: disabled || busy}} disabled={disabled || busy} onPress={action} style={{padding: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, opacity: disabled ? .5 : 1}}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  return <ProviderPanel embedded={embedded} onClose={onClose}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, paddingTop: insets.top, backgroundColor: c.background}}>
    <View style={{padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center'}}>{button('Back', onClose)}<Text style={{fontSize: 20, fontWeight: '700'}}>Bookings & enquiries</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, gap: 12}}>
      {target ? <>{button('All bookings and enquiries', () => setTarget(''))}<Text>Request opened from your notification</Text></> : <><Input accessibilityLabel="Search bookings and enquiries" value={search} editable={!busy} onChangeText={setSearch} placeholder="Customer or service" style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/>
      {button('Search', () => {if (query === search) void load(); else setQuery(search);}, loading)}
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>{bookingFilters.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{checked: status === value, disabled: busy}} disabled={busy} onPress={() => setStatus(value)} style={{padding: 10, borderRadius: 12, backgroundColor: status === value ? c.soft : c.surface}}><Text>{value || 'All statuses'}</Text></Pressable>)}</View></>}
      {(loading || busy) && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
      {items.map(item => <View key={item.id} style={{padding: 16, gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface}}>
        <Text style={{fontSize: 18, fontWeight: '700'}}>{item.listing_title}</Text><Text>{item.request_type} · {item.status} · Party size: {item.party_size}</Text>
        {!!item.listing_id && (photos[item.listing_id] === undefined ? <Text>Loading service images…</Text> : photos[item.listing_id] === null ? <Text>Service images unavailable. Refresh requests to retry.</Text> : <ProviderPostImages title={item.listing_title} urls={photos[item.listing_id] || []}/>)}
        <Text>{item.starts_at ? new Date(item.starts_at).toLocaleString() : 'Agree a time with the customer'}{item.ends_at ? ` – ${new Date(item.ends_at).toLocaleString()}` : ''}</Text>
        <Text>{item.message || 'No message included.'}</Text>{item.buyer && <><Text>{item.buyer.full_name}</Text><Text selectable>{item.buyer.email}{item.buyer.phone ? ` · ${item.buyer.phone}` : ''}</Text></>}
        {bookingActions(item.status).map(next => <View key={next}>{button(next === 'accepted' ? 'Accept' : next === 'rejected' ? 'Reject' : 'Complete', () => update(item, next), loading)}</View>)}
      </View>)}
      {!items.length && !loading && !error && <Text>No matching bookings or enquiries.</Text>}
      {!!cursor && button('Load more', () => void load(cursor), loading || photosLoading)}{button('Refresh requests', () => void load(), loading)}
    </ScrollView>
  </KeyboardFrame></ProviderPanel>;
}
