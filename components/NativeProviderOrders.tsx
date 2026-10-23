import {ProviderPanel} from './ProviderPanel';
import {ProviderPostImages} from './ProviderPostImages';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {KeyboardFrame} from './KeyboardFrame';
import {providerRequest} from './nativeProviderApi';
import {ProviderOrder, providerETADraft, providerOrderActions, providerOrderUpdate, TrackingDraft} from './providerOrderPolicy';
import {NativeProviderFulfillmentTools} from './NativeProviderFulfillmentTools';

export function NativeProviderOrders({embedded = false, token, onClose}: {embedded?: boolean; token: string; onClose: () => void}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets;
  const [items, setItems] = useState<ProviderOrder[]>([]), [cursor, setCursor] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<{order: ProviderOrder; next: string; key: string} | null>(null);
  const [tools, setTools] = useState(false);
  const [draft, setDraft] = useState<TrackingDraft>({notes: '', location: '', carrier: '', tracking_number: '', tracking_url: '', delivery_date: '', delivery_time: ''});
  const alive = useRef(true), epoch = useRef(0), mutation = useRef(false), paging = useRef(false);
  const invalidate = useCallback(() => {epoch.current++;}, []);
  useEffect(() => {alive.current = true; return () => {alive.current = false; invalidate();};}, [invalidate]);
  const load = useCallback(async (next = '') => {
    if (next && paging.current) return; paging.current = true; const version = ++epoch.current; setLoading(true); setError('');
    try {
      const params = new URLSearchParams({limit: '25'}); if (next) params.set('cursor', next);
      const data = await providerRequest(token, `/providers/me/merchant-orders?${params}`);
      if (alive.current && version === epoch.current) {setItems(old => next ? [...old, ...(data.items || []).filter((item: ProviderOrder) => !old.some(existing => existing.id === item.id))] : data.items || []); setCursor(data.page?.next_cursor || '');}
    } catch (failure) {if (alive.current && version === epoch.current) setError(failure instanceof Error ? failure.message : 'Orders could not load.');}
    finally {if (version === epoch.current) {paging.current = false; if (alive.current) setLoading(false);}}
  }, [token]);
  useEffect(() => {void load(); return invalidate;}, [load, invalidate]);
  const edit = (order: ProviderOrder, next: string) => {const f = order.fulfillment; setError(''); setNotice(''); setDraft({notes: '', location: f?.current_location || '', carrier: f?.carrier || '', tracking_number: f?.tracking_number || '', tracking_url: f?.tracking_url || '', ...providerETADraft(f?.estimated_delivery_at)}); setEditor({order, next, key: Crypto.randomUUID()});};
  const save = () => {
    if (!editor || mutation.current) return;
    let payload: ReturnType<typeof providerOrderUpdate>;
    try {payload = providerOrderUpdate(editor.order, editor.next, draft, editor.key);} catch (failure) {setError(failure instanceof Error ? failure.message : 'Check the tracking details.'); return;}
    const selected = editor;
    Alert.alert('Publish tracking update?', `${selected.order.package_label || 'Order'} → ${selected.next.replace(/_/g, ' ')}. The customer will see this update.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Publish', onPress: () => {void (async () => {
      if (mutation.current || !alive.current) return; mutation.current = true; invalidate(); setBusy(true); setError('');
      try {await providerRequest(token, `/providers/me/merchant-orders/${selected.order.id}/fulfillment`, {method: 'PATCH', body: JSON.stringify(payload)}); if (alive.current) {setEditor(null); setNotice('Tracking update published.'); await load();}}
      catch (failure) {if (alive.current) {setEditor(null); setError(`${failure instanceof Error ? failure.message : 'The update could not be confirmed.'} Refresh orders before another update. The app will not replay it automatically.`);}}
      finally {mutation.current = false; if (alive.current) {setBusy(false); setLoading(false); paging.current = false;}}
    })();}}]);
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled || busy} accessibilityState={{disabled: disabled || busy}} onPress={action} style={{padding: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.soft, opacity: disabled ? .5 : 1}}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  if (tools) return <NativeProviderFulfillmentTools embedded={embedded} token={token} onClose={() => {setTools(false); void load();}}/>;
  return <ProviderPanel embedded={embedded} onClose={onClose}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, paddingTop: insets.top, backgroundColor: c.background}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, gap: 12}}>
    {button(editor ? 'Cancel update' : 'Back', () => editor ? setEditor(null) : onClose())}<Text style={{fontSize: 20, fontWeight: '700'}}>Previous paid orders</Text>
    <Text>New product purchases are arranged directly with sellers. Existing paid orders and their tracking remain available here.</Text>
    {(loading || busy) && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    {editor ? <><Text style={{fontWeight: '700'}}>{editor.next.replace(/_/g, ' ')}</Text>{Object.keys(draft).map(key => <View key={key} style={{gap: 6}}><Text>{key.replace(/_/g, ' ')}</Text><Input accessibilityLabel={key.replace(/_/g, ' ')} editable={!busy} value={draft[key as keyof TrackingDraft] || ''} onChangeText={value => setDraft(old => ({...old, [key]: value}))} autoCapitalize={key === 'tracking_url' ? 'none' : 'sentences'} style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/></View>)}{button('Review and publish update', save)}</> : <>
      {button('Bulk orders and manifests', () => setTools(true), loading)}<Text>Estimated delivery dates use YYYY-MM-DD and your phone?s local time (HH:MM).</Text>{items.map(order => <View key={order.id} style={{padding: 16, gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface}}>
        <Text style={{fontSize: 17, fontWeight: '700'}}>{order.package_label || order.id}</Text><Text>{order.fulfillment?.status || order.status} · {order.currency_code} {order.total_amount}</Text>
        {(order.items || []).map((item, index) => <View key={index}><ProviderPostImages title={item.title} urls={item.product_snapshot?.image_urls}/><Text>{item.title} · {item.quantity} × {order.currency_code} {item.unit_price}</Text></View>)}
        <Text>{order.fulfillment_contact?.full_name} · {order.fulfillment_contact?.phone}</Text><Text>{[order.fulfillment_contact?.address, order.fulfillment_contact?.city, order.fulfillment_contact?.state].filter(Boolean).join(', ')}</Text>
        <Text>Seller funds: {order.seller_funds?.status || 'pending'}</Text>{!!order.seller_funds?.note && <Text>{order.seller_funds.note}</Text>}
        {order.fulfillment?.route === 'merchant_cross_border' && order.seller_funds?.status !== 'settled' && <Text>Seller funds are not confirmed as settled. Do not purchase or dispatch this imported item yet.</Text>}
        {providerOrderActions(order).map(next => <View key={next}>{button(next.replace(/_/g, ' '), () => edit(order, next), loading)}</View>)}
      </View>)}
      {!items.length && !loading && !error && <Text>No previous paid orders.</Text>}{!!cursor && button('Load more orders', () => void load(cursor), loading)}{button('Refresh orders', () => void load(), loading)}
    </>}
  </ScrollView></KeyboardFrame></ProviderPanel>;
}
