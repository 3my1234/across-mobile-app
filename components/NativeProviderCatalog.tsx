import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest, putProviderPhoto} from './nativeProviderApi';
import {editablePostSnapshot, makeProductDraft, makeServiceDraft, PostPolicy, postPayload, ProviderPost, providerVideoPreviewURL, serviceTypes, validatePostDraft} from './providerPublishingPolicy';
import {NativeProviderLocationPicker} from './NativeProviderLocationPicker';
import {providerAddressSearch} from './providerAddressSearch';
import {ProviderAccount, verificationImageError} from './nativeProviderPolicy';
import {currentForegroundLocation} from './foregroundLocation';
import {ResilientImage} from './ResilientImage';
import {ProviderPostImages} from './ProviderPostImages';
import {KeyboardFrame} from './KeyboardFrame';
import {NativeProviderAvailability} from './NativeProviderAvailability';
import {NativeProviderProductOptions} from './NativeProviderProductOptions';
import {NativeProviderDeliveryOffer} from './NativeProviderDeliveryOffer';

export function NativeProviderCatalog({token, kind, provider, onClose}: {token: string; kind: 'listings' | 'products'; provider: ProviderAccount; onClose: () => void}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets(), endpoint = `/providers/me/${kind}`;
  const [items, setItems] = useState<ProviderPost[]>([]), [cursor, setCursor] = useState(''), [policy, setPolicy] = useState<PostPolicy | null>(null);
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<ProviderPost | null>(null), [confirmed, setConfirmed] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [availability, setAvailability] = useState<{id: string; title: string; media_urls?: string[]} | null>(null);
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [addressQuery, setAddressQuery] = useState(''), [addressResults, setAddressResults] = useState<{latitude: number; longitude: number}[]>([]);
  const mounted = useRef(true), epoch = useRef(0), flight = useRef(false), loadFlight = useRef(false);
  const invalidate = useCallback(() => {epoch.current++;}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; invalidate();};}, [invalidate]);
  const load = useCallback(async (next = '', append = false) => {
    if (loadFlight.current && append) return;
    loadFlight.current = true; const version = ++epoch.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({limit: '25'}); if (next) params.set('cursor', next); if (query.trim()) params.set('search', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      const [data, limits] = await Promise.all([providerRequest(token, `${endpoint}?${params}`), providerRequest(token, '/providers/me/post-policy')]);
      if (mounted.current && epoch.current === version) {setItems(old => append ? [...old, ...data.items.filter((row: ProviderPost) => !old.some(existing => existing.id === row.id))] : data.items || []); setCursor(data.page?.next_cursor || data.next_cursor || ''); setPolicy(limits);}
    } catch (failure) {if (mounted.current && epoch.current === version) setError(failure instanceof Error ? failure.message : 'Could not load posts. Retry.');}
    finally {loadFlight.current = false; if (mounted.current && epoch.current === version) setLoading(false);}
  }, [token, endpoint, query, statusFilter]);
  useEffect(() => {void load(); return invalidate;}, [load, invalidate]);
  const run = async (action: () => Promise<void>) => {
    if (flight.current || !mounted.current) return; flight.current = true; setBusy(true); setError(''); setNotice('');
    try {await action();} catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not complete this operation.');}
    finally {flight.current = false; if (mounted.current) setBusy(false);}
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled: disabled || busy}} disabled={disabled || busy} onPress={action} style={[s.button, {borderColor: c.line, backgroundColor: c.soft, opacity: disabled || busy ? .5 : 1}]}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  const patch = (key: string, value: unknown) => {
    const coordinate = ['latitude', 'longitude', 'inventory_latitude', 'inventory_longitude'].includes(key);
    if (coordinate) setConfirmed(false);
    setDraft(old => old ? {...old, [key]: value, ...(coordinate && kind === 'listings' ? {attributes: {...old.attributes, location_source: 'manual', location_accuracy_m: null, location_captured_at: new Date().toISOString()}} : {})} : old);
  };
  const field = (key: string, label: string, numeric = false, multiline = false) => <View key={key} style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={draft?.[key] == null ? '' : String(draft[key])} multiline={multiline} keyboardType={numeric ? 'decimal-pad' : 'default'} onChangeText={text => patch(key, numeric ? text === '' ? null : Number(text) : text)} style={[s.input, {borderColor: c.line}, multiline && {minHeight: 85, textAlignVertical: 'top'}]}/></View>;
  const create = () => {setDraft(kind === 'listings' ? makeServiceDraft(provider) : makeProductDraft(provider)); setAddressQuery(''); setAddressResults([]); setConfirmed(false); setNotice(''); setError('');};
  const edit = (item: ProviderPost) => void run(async () => {
    // The private detail read supplies contacts missing from list snapshots.
    // An older server's 404 leaves the editor closed rather than clearing fields.
    const snapshot = kind === 'listings' ? await providerRequest(token, `${endpoint}/${item.id}`) : item;
    const editable = editablePostSnapshot(kind, snapshot, item.id);
    if (mounted.current) {setDraft(editable); setAddressQuery(''); setAddressResults([]); setConfirmed(false); setError(''); setNotice('');}
  });
  const images = draft ? kind === 'listings' ? draft.media_urls || [] : draft.image_urls || [] : [];
  const videos = draft ? kind === 'listings' ? draft.attributes?.video_urls || [] : draft.video_urls || [] : [];
  const setImages = (urls: string[]) => patch(kind === 'listings' ? 'media_urls' : 'image_urls', urls);
  const setVideos = (urls: string[]) => kind === 'listings' ? patch('attributes', {...draft?.attributes, video_urls: urls}) : patch('video_urls', urls);
  const addMedia = (video = false) => void run(async () => {
    const limits: PostPolicy = await providerRequest(token, '/providers/me/post-policy');
    if (video ? videos.length >= limits.max_videos : images.length >= limits.max_images) throw new Error(video ? 'Your plan does not allow more videos. Remove a video or upgrade.' : 'Your image limit is reached. Remove an image or upgrade.');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) throw new Error('Allow photo/video access in your phone settings to choose media.');
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: video ? ['videos'] : ['images'], quality: 1, allowsEditing: false}); if (result.canceled) return;
    const asset = result.assets[0], mime = asset.mimeType || '';
    if (video) {
      if (mime !== 'video/mp4' || !asset.duration || asset.duration > limits.max_video_seconds * 1000 || !asset.fileSize || asset.fileSize > 50 * 1024 * 1024) throw new Error('Choose an MP4 up to 50 MB, with each video no longer than 60 seconds.');
    } else {const validation = verificationImageError(mime, asset.fileSize || 0); if (validation) throw new Error(validation);}
    const signed = await providerRequest(token, '/providers/me/uploads/presign', {method: 'POST', body: JSON.stringify({filename: asset.fileName || (video ? 'post.mp4' : 'post.jpg'), mime_type: mime, purpose: video ? 'post_video' : 'listing'})});
    await putProviderPhoto(signed.upload_url, asset.uri, mime, video ? 50 * 1024 * 1024 : 10 * 1024 * 1024);
    if (video) {const verified = await providerRequest(token, '/providers/me/videos/complete', {method: 'POST', body: JSON.stringify({key: signed.key})}); if (mounted.current) setVideos([...videos, verified.url]);}
    else if (mounted.current) setImages([...images, signed.view_url]);
    if (mounted.current) setPolicy(limits);
  });
  const locate = () => void run(async () => {const location = await currentForegroundLocation(); if (!mounted.current) return; const {latitude, longitude, accuracy} = location.coords; setConfirmed(false); setDraft(old => old ? kind === 'listings' ? {...old, latitude, longitude, attributes: {...old.attributes, location_source: 'device', location_accuracy_m: accuracy, location_captured_at: new Date().toISOString()}} : {...old, inventory_latitude: latitude, inventory_longitude: longitude} : old);});
  const findAddress = () => void run(async () => {
    setAddressResults([]);
    const composed = kind === 'listings' ? [draft?.address_line, draft?.city, draft?.state, draft?.country_code] : [draft?.inventory_location, draft?.inventory_city, draft?.inventory_country_code];
    const results = await providerAddressSearch(addressQuery.trim() || composed.filter(Boolean).join(', '));
    if (mounted.current) setAddressResults(results);
  });
  const chooseAddress = ({latitude, longitude}: {latitude: number; longitude: number}) => {
    setConfirmed(false); setAddressResults([]);
    setDraft(old => old ? kind === 'listings' ? {...old, latitude, longitude, attributes: {...old.attributes, location_source: 'address_search', location_accuracy_m: null, location_captured_at: new Date().toISOString()}} : {...old, inventory_latitude: latitude, inventory_longitude: longitude} : old);
  };
  const latitude = kind === 'listings' ? draft?.latitude : draft?.inventory_latitude, longitude = kind === 'listings' ? draft?.longitude : draft?.inventory_longitude;
  const save = () => void run(async () => {
    if (!draft) return; const latest = await providerRequest(token, '/providers/me/post-policy'); validatePostDraft(kind, draft, latest, confirmed);
    await providerRequest(token, draft.id ? `${endpoint}/${draft.id}` : endpoint, {method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(postPayload(kind, draft))});
    if (mounted.current) {setDraft(null); setNotice('Saved. New posts remain private drafts; edited approved posts return for review.'); await load();}
  });
  const transition = (item: ProviderPost, archive: boolean) => Alert.alert(archive ? 'Archive this post?' : 'Submit for review?', archive ? 'This removes it from your active catalogue. Existing conversations are preserved.' : 'Atlantic Express will review this post before publication.', [{text: 'Cancel', style: 'cancel'}, {text: archive ? 'Archive' : 'Submit', style: archive ? 'destructive' : 'default', onPress: () => void run(async () => {await providerRequest(token, `${endpoint}/${item.id}${archive ? '' : '/submit'}`, {method: archive ? 'DELETE' : 'POST'}); if (mounted.current) {setNotice(archive ? 'Post archived.' : 'Post submitted for review.'); await load();}})}]);
  const exitEditor = () => {if (!draft) onClose(); else Alert.alert('Leave this draft?', 'Unsaved changes will be discarded.', [{text: 'Keep editing', style: 'cancel'}, {text: 'Discard changes', style: 'destructive', onPress: () => setDraft(null)}]);};
  if (availability) return <NativeProviderAvailability token={token} service={availability} onClose={() => setAvailability(null)}/>;
  return <Modal animationType="slide" onRequestClose={exitEditor}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, paddingTop: insets.top, backgroundColor: c.background}}><View style={[s.header, {backgroundColor: c.surface}]}>{button(draft ? 'Cancel editing' : 'Back', exitEditor)}<Text style={s.title}>{draft ? draft.id ? 'Edit post' : 'Create post' : kind === 'listings' ? 'Services' : 'Products'}</Text></View><ScrollView contentContainerStyle={{padding: 16, gap: 12}} keyboardShouldPersistTaps="handled">
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error} After an interrupted submission, refresh before retrying.</Text>}{!!notice && <Text accessibilityRole="alert">{notice}</Text>}{(busy || loading) && <ActivityIndicator/>}
    {!!policy && <View style={[s.card, {borderColor: c.line}]}><Text>Combined plan limit: {policy.post_limit} products and services total.</Text><Text>Per post: {policy.max_images} images, {policy.max_videos} videos; each video up to {policy.max_video_seconds} seconds.</Text></View>}
    {!draft ? <><Input accessibilityLabel="Search posts" value={search} onChangeText={setSearch} placeholder="Search your posts" style={[s.input, {borderColor: c.line}]}/>{button('Search', () => {if (query === search) void load(); else setQuery(search);}, loading)}<View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>{['', 'draft', 'pending', 'approved', 'rejected', 'suspended'].map(status => <Pressable key={status} accessibilityRole="radio" accessibilityState={{checked: statusFilter === status, disabled: busy || loading}} disabled={busy || loading} onPress={() => setStatusFilter(status)} style={[s.button, {borderColor: c.line, backgroundColor: statusFilter === status ? c.soft : c.surface}]}><Text>{status || 'All statuses'}</Text></Pressable>)}</View>{button('Create post', create, !policy || loading || provider.is_active === false)}{!loading && !items.length && <Text>No matching posts.</Text>}{items.map(item => {const status = kind === 'listings' ? item.status : item.moderation_status; return <View key={item.id} style={[s.card, {backgroundColor: c.surface, borderColor: c.line}]}><Text style={s.title}>{item.title}</Text><ProviderPostImages key={item.id} title={item.title} urls={kind === 'listings' ? item.media_urls : item.image_urls}/><Text>{status}</Text>{!!item.moderation_notes && <Text>{item.moderation_notes}</Text>}{button('Edit', () => edit(item), status === 'archived')}{kind === 'listings' && status !== 'archived' && button('Add availability', () => setAvailability({id: item.id, title: item.title, media_urls: item.media_urls}))}{['draft', 'rejected'].includes(status) && button('Submit for review', () => transition(item, false))}{status !== 'archived' && button('Archive', () => transition(item, true))}</View>;})}{!!cursor && button('Load more', () => void load(cursor, true), loading)}{button('Refresh', () => void load(), loading)}</> : <>
      {field('title', 'Title')}{field('description', 'Description', false, true)}
      {kind === 'listings' ? <><Text>Service type</Text><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>{serviceTypes.map(type => <Pressable accessibilityRole="radio" accessibilityState={{checked: draft.listing_type === type}} disabled={busy} key={type} onPress={() => patch('listing_type', type)} style={[s.button, {backgroundColor: draft.listing_type === type ? c.soft : c.surface, borderColor: c.line}]}><Text>{type.replace(/_/g, ' ')}</Text></Pressable>)}</View>{field('category', 'Category')}{field('city', 'City')}{field('state', 'State / region')}{field('address_line', 'Address / area')}{field('country_code', 'Country code (NG)')}{field('currency_code', 'Currency (NGN)')}<Text>Pricing</Text>{['fixed', 'from', 'quote'].map(mode => button(`${draft.attributes?.price_mode === mode ? 'Selected: ' : ''}${mode}`, () => patch('attributes', {...draft.attributes, price_mode: mode})))}{draft.attributes?.price_mode !== 'quote' && field('price', 'Price', true)}<Input value={draft.attributes?.price_notes || ''} onChangeText={value => patch('attributes', {...draft.attributes, price_notes: value})} placeholder="What can change the price?" accessibilityLabel="Price notes" style={[s.input, {borderColor: c.line}]}/>{field('pricing_unit', 'Price is for (one visit / hour / night)')}{field('capacity', 'Concurrent customer capacity', true)}{field('contact_email', 'Contact email')}{field('contact_phone', 'Contact phone')}{field('service_radius_km', 'Service radius in km', true)}{[['is_mobile_service', 'I can travel to the customer'], ['is_available_now', 'Available now']].map(([key, label]) => <View key={key} style={s.header}><Text style={{flex: 1}}>{label}</Text><Switch disabled={busy} value={Boolean(draft[key])} onValueChange={value => patch(key, value)}/></View>)}</> : <>{!draft.id && field('sku', 'SKU (optional unique identifier)')}{field('local_selling_price', 'Selling price', true)}{field('currency_code', 'Currency (NGN)')}{field('inventory_count', 'Stock quantity', true)}{field('inventory_country_code', 'Stock country (NG)')}{field('inventory_city', 'Stock city')}{field('inventory_location', 'Stock address / area')}{field('handling_time_hours', 'Handling time in hours', true)}{field('delivery_min_days', 'Minimum delivery days', true)}{field('delivery_max_days', 'Maximum delivery days', true)}{field('return_policy', 'Return policy', false, true)}<NativeProviderProductOptions draft={draft} patch={patch} busy={busy}/>{(draft.delivery_areas || []).map((area: ProviderPost, index: number) => <View key={index} style={[s.card, {borderColor: c.line}]}><Text>{area.country_code} {area.state} {area.city}: {area.currency_code} {area.delivered_price} delivered</Text>{button('Remove delivery area', () => patch('delivery_areas', draft.delivery_areas.filter((_: unknown, i: number) => i !== index)))}</View>)}<NativeProviderDeliveryOffer draft={draft} patch={patch} busy={busy}/></>}
      {(kind === 'listings' || draft.fulfillment_mode === 'merchant_local') && <View style={[s.card, {borderColor: c.line}]}><Text>Actual service / stock location</Text>{button('Choose on map', () => setMapOpen(true))}{button('Use my current location', locate)}<Input accessibilityLabel="Search service or stock address" editable={!busy} value={addressQuery} onChangeText={value => {setAddressQuery(value); setAddressResults([]);}} placeholder="Address, city or landmark" style={[s.input, {borderColor: c.line}]}/>{button('Search address', findAddress)}{addressResults.map((point, index) => <View key={`${point.latitude}:${point.longitude}`}>{button(`Use location ${index + 1}: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`, () => chooseAddress(point))}</View>)}{field(kind === 'listings' ? 'latitude' : 'inventory_latitude', 'Latitude (or use current location)', true)}{field(kind === 'listings' ? 'longitude' : 'inventory_longitude', 'Longitude (or use current location)', true)}{latitude != null && longitude != null && <><Text>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>{button('Check this pin in Maps', () => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => setError('Could not open Maps. Retry.')))}<View style={s.header}><Text style={{flex: 1}}>This pin is the actual service / stock location</Text><Switch disabled={busy} value={confirmed} onValueChange={setConfirmed}/></View></>}</View>}
      <Text style={s.title}>Images</Text><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>{images.map((url: string, index: number) => <View key={`${url}-${index}`}><ResilientImage uri={url} fallbackUri="" style={{width: 110, height: 90, borderRadius: 10}}/>{button('Remove', () => setImages(images.filter((_: string, i: number) => i !== index)))}</View>)}</View>{button('Add image', () => addMedia())}<Text style={s.title}>Videos</Text>{videos.map((url: string, index: number) => <View key={index}><Text>Video {index + 1}</Text>{button('Preview video', () => void run(async () => {await Linking.openURL(providerVideoPreviewURL(url));}))}{button('Remove video', () => setVideos(videos.filter((_: string, i: number) => i !== index)))}</View>)}{button('Add video', () => addMedia(true), !policy || policy.max_videos === 0)}{button('Save draft', save, !policy)}<Text>Saving does not immediately publish. Review status is enforced by the server. Uploaded files are not published until the post is saved and approved.</Text>
    </>}
  </ScrollView>{mapOpen && draft && <NativeProviderLocationPicker initial={latitude == null || longitude == null ? undefined : {latitude, longitude}} onClose={() => setMapOpen(false)} onChoose={point => {chooseAddress(point); if (kind === 'listings') setDraft(old => old ? {...old, attributes: {...old.attributes, location_source: 'map'}} : old); setMapOpen(false);}}/>}</KeyboardFrame></Modal>;
}
const s = StyleSheet.create({header: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10}, title: {fontSize: 18, fontWeight: '700'}, card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 10}, button: {borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 44, justifyContent: 'center'}, input: {borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46}});
