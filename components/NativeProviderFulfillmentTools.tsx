import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Switch, View} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {KeyboardFrame} from './KeyboardFrame';
import {providerRequest} from './nativeProviderApi';
import {commonProviderOrderActions, manifestActions, manifestPrintHTML, manifestUpdate, ProviderManifest, ProviderOrder, providerBulkPayload, providerManifestPayload} from './providerOrderPolicy';

type ManifestDetail = {manifest: ProviderManifest; items: Record<string, any>[]};
export function NativeProviderFulfillmentTools({token, onClose}: {token: string; onClose: () => void}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [pane, setPane] = useState<'orders' | 'manifests'>('orders');
  const [orders, setOrders] = useState<ProviderOrder[]>([]), [manifests, setManifests] = useState<ProviderManifest[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [country, setCountry] = useState(''), [city, setCity] = useState(''), [cursor, setCursor] = useState('');
  const [detail, setDetail] = useState<ManifestDetail | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(true), generation = useRef(0), flight = useRef(false), paging = useRef(false);
  const invalidate = useCallback(() => {generation.current++;}, []);
  useEffect(() => {alive.current = true; return () => {alive.current = false; invalidate();};}, [invalidate]);
  const load = useCallback(async (next = '') => {
    if (next && paging.current) return; paging.current = true;
    const version = ++generation.current; setLoading(true); setError('');
    try {
      const params = new URLSearchParams({limit: '25'}); if (next) params.set('cursor', next);
      const data = await providerRequest(token, `/providers/me/${pane === 'orders' ? 'merchant-orders' : 'manifests'}?${params}`);
      if (!alive.current || version !== generation.current) return;
      if (pane === 'orders') setOrders(old => next ? [...old, ...(data.items || []).filter((item: ProviderOrder) => !old.some(row => row.id === item.id))] : data.items || []);
      else setManifests(old => next ? [...old, ...(data.items || []).filter((item: ProviderManifest) => !old.some(row => row.id === item.id))] : data.items || []);
      if (!next) setSelected([]);
      setCursor(data.page?.next_cursor || data.next_cursor || '');
    } catch (failure) {if (alive.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Could not load fulfillment records.');}
    finally {if (version === generation.current) {paging.current = false; if (alive.current) setLoading(false);}}
  }, [token, pane]);
  useEffect(() => {setCursor(''); setSelected([]); void load(); return invalidate;}, [load, invalidate]);
  const run = async (action: () => Promise<void>) => {
    if (flight.current || !alive.current) return; flight.current = true; setBusy(true); setError(''); setNotice(''); invalidate();
    try {await action();} catch (failure) {if (alive.current) setError(`${failure instanceof Error ? failure.message : 'Could not confirm this update.'} Refresh records before retrying. No update is replayed automatically.`);}
    finally {flight.current = false; if (alive.current) {setBusy(false); setLoading(false); paging.current = false;}}
  };
  const chosen = orders.filter(order => selected.includes(order.id));
  const bulk = (next: string) => {
    let payload: ReturnType<typeof providerBulkPayload>;
    try {payload = providerBulkPayload(chosen, next, Crypto.randomUUID());} catch (failure) {setError((failure as Error).message); return;}
    Alert.alert('Update selected orders?', `${chosen.length} order(s) → ${next.replace(/_/g, ' ')}. Customers will see the tracking update.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Update orders', onPress: () => void run(async () => {
      await providerRequest(token, '/providers/me/merchant-orders/fulfillment/bulk', {method: 'PATCH', body: JSON.stringify(payload)});
      if (alive.current) {setNotice('Selected orders updated.'); await load();}
    })}]);
  };
  const create = () => {
    let payload: ReturnType<typeof providerManifestPayload>;
    try {payload = providerManifestPayload(chosen, country, city);} catch (failure) {setError((failure as Error).message); return;}
    Alert.alert('Create manifest?', `${chosen.length} settled imported order(s), from ${payload.origin_city}, ${payload.origin_country_code}.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Create manifest', onPress: () => void run(async () => {
      await providerRequest(token, '/providers/me/manifests', {method: 'POST', body: JSON.stringify(payload)});
      if (alive.current) {setNotice('Manifest created.'); setSelected([]); setPane('manifests');}
    })}]);
  };
  const change = (manifest: ProviderManifest, next: string) => Alert.alert('Update this manifest?', `${manifest.manifest_code} → ${next}. This can update tracking for every order in the manifest.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Confirm', style: next === 'cancelled' ? 'destructive' : 'default', onPress: () => void run(async () => {
    await providerRequest(token, `/providers/me/manifests/${manifest.id}`, {method: 'PATCH', body: JSON.stringify(manifestUpdate(manifest, next, Crypto.randomUUID()))});
    if (alive.current) {setNotice('Manifest updated.'); await load();}
  })}]);
  const show = (manifest: ProviderManifest) => void run(async () => {const data = await providerRequest(token, `/providers/me/manifests/${manifest.id}`); if (alive.current) setDetail(data);});
  const print = () => {if (!detail) return; void run(async () => {const fresh: ManifestDetail = await providerRequest(token, `/providers/me/manifests/${detail.manifest.id}`); if (alive.current) await Print.printAsync({html: manifestPrintHTML(fresh)});});};
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled || busy} accessibilityState={{disabled: disabled || busy}} onPress={action} style={{padding: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, opacity: disabled || busy ? .5 : 1}}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  const header = <View style={{padding: 16, gap: 12}}>{button(detail ? 'Back to manifests' : 'Back to orders', () => detail ? setDetail(null) : onClose())}<Text style={{fontSize: 20, fontWeight: '700'}}>{detail ? detail.manifest.manifest_code : 'Bulk fulfillment and manifests'}</Text>{busy && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}</View>;
  return <Modal animationType="slide" onRequestClose={() => detail ? setDetail(null) : onClose()}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, paddingTop: insets.top, backgroundColor: c.background}}>
    {detail ? <FlatList data={detail.items} keyExtractor={(item, index) => `${item.order_id}:${item.item_id}:${index}`} ListHeaderComponent={<>{header}<View style={{padding: 16, gap: 8}}><Text>{detail.manifest.origin_city}, {detail.manifest.origin_country_code} · {detail.manifest.status}</Text>{button('Print manifest', print)}</View></>} renderItem={({item}) => <View style={{padding: 16, gap: 6, borderBottomWidth: 1, borderColor: c.line}}><Text style={{fontWeight: '700'}}>{item.package_code}</Text><Text>{item.product?.title || item.product?.sku || item.item_id} · Quantity {item.quantity}</Text><Text>{item.buyer?.full_name}</Text><Text selectable>{item.buyer?.phone} · {item.buyer?.email}</Text></View>}/> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom: 20}}>{header}<View style={{paddingHorizontal: 16, gap: 12}}>
      <View style={{flexDirection: 'row', gap: 8}}>{button('Select orders', () => setPane('orders'))}{button('Manifests', () => setPane('manifests'))}</View>
      {loading && <ActivityIndicator/>}
      {pane === 'orders' ? <><Text>Select up to 200 previous paid orders. Only stages available for every selected order are offered.</Text>{orders.map(order => <View key={order.id} style={{padding: 12, gap: 6, borderWidth: 1, borderColor: c.line, borderRadius: 12}}><View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><Text style={{flex: 1}}>{order.package_label || order.id}</Text><Switch accessibilityLabel={`Select ${order.package_label || order.id}`} disabled={busy || loading || !selected.includes(order.id) && selected.length >= 200} value={selected.includes(order.id)} onValueChange={value => setSelected(old => value ? [...old, order.id] : old.filter(id => id !== order.id))}/></View><Text>{order.fulfillment?.status} · Seller funds: {order.seller_funds?.status || 'pending'}</Text></View>)}<Text>{chosen.length} selected</Text>{commonProviderOrderActions(chosen).map(next => <View key={next}>{button(`Update selected: ${next.replace(/_/g, ' ')}`, () => bulk(next), loading)}</View>)}<Text style={{fontWeight: '700'}}>Create an imported-order manifest</Text><Input accessibilityLabel="Manifest origin country" editable={!busy} value={country} onChangeText={setCountry} placeholder="Origin country (two-letter code)" autoCapitalize="characters" style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/><Input accessibilityLabel="Manifest origin city" editable={!busy} value={city} onChangeText={setCity} placeholder="Origin city" style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/>{button('Create manifest for selected orders', create, !chosen.length || loading)}<Text>Every selected order must be imported, settled and not already in another manifest. The server rechecks these conditions together.</Text></> : <>{manifests.map(manifest => <View key={manifest.id} style={{padding: 14, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: c.line}}><Text style={{fontWeight: '700'}}>{manifest.manifest_code}</Text><Text>{manifest.origin_city}, {manifest.origin_country_code} · {manifest.status} · {manifest.order_count} order(s)</Text>{button('View and print', () => show(manifest), loading)}{manifestActions(manifest).map(next => <View key={next}>{button(`Mark ${next}`, () => change(manifest, next), loading)}</View>)}</View>)}{!manifests.length && !loading && <Text>No manifests.</Text>}</>}
      {!!cursor && button('Load more', () => void load(cursor), loading)}{button('Refresh records', () => void load(), loading)}
    </View></ScrollView>}
  </KeyboardFrame></Modal>;
}
