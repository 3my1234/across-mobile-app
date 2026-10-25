import {NativeProviderPromotions} from './NativeProviderPromotions';
import {ProviderPanelBackContext} from './ProviderPanel';
import {Ionicons} from '@expo/vector-icons';
import {LOGO} from './config';
import {NativeReferrals} from './NativeReferrals';
import {NativeProviderNotifications} from './NativeProviderNotifications';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ResilientImage} from './ResilientImage';
import {LegacyProviderWorkspace} from './LegacyProviderWorkspace';
import {hasPaidProviderAccess, nativeProviderView, privateDocumentPreviewURL, providerRouteContext, providerSupportTicket, ProviderAccount, verificationFileError, verificationKinds} from './nativeProviderPolicy';
import {acknowledgeProviderRoute, providerRequest, ProviderRequestError, putProviderPhoto} from './nativeProviderApi';
import {NativeProviderCatalog} from './NativeProviderCatalog';
import {NativeProviderOnboarding} from './NativeProviderOnboarding';
import {NativeProviderProfile} from './NativeProviderProfile';
import {NativeProviderMessages} from './NativeProviderMessages';
import {NativeProviderDriver} from './NativeProviderDriver';
import {NativeProviderRequests} from './NativeProviderRequests';
import {NativeProviderOrders} from './NativeProviderOrders';
import {NativeProviderSubscription} from './NativeProviderSubscription';
import {NativeProviderOverviewSummary} from './NativeProviderOverviewSummary';
import {KeyboardFrame} from './KeyboardFrame';

type Document = {id: string; document_type: string; status: string; review_notes?: string};
type Props = {token: string; route?: string; onClose: () => void; onSignedOut: () => void; onOpenSupport: (ticketId?: string) => void; onOpenReferrals?: () => void; onOpenSettings?: () => void; onOpenNotification?: (notification: Record<string, unknown>) => void};

// Native is the normal app experience. Explicit false retains the rollback path.
export function ProviderWorkspace(props: Props) {
  if (process.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT === 'false') return <LegacyProviderWorkspace {...props}/>;
  return <NativeProviderAccount {...props}/>;
}
export function NativeProviderAccount({token, route = '', onClose, onOpenSupport, onOpenSettings, onOpenNotification}: Props) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const panelBackHandlers = useRef(new Map<symbol, () => void>());
  const registerPanelBack = useCallback((handler: () => void) => {const key = Symbol(); panelBackHandlers.current.set(key, handler); return () => {panelBackHandlers.current.delete(key);};}, []);
  const [view, setView] = useState<string>(() => nativeProviderView(route)), [legacyRoute, setLegacyRoute] = useState(route);
  const [history, setHistory] = useState<{view: string; route: string}[]>([]);
  const navigationGuard = useRef<((action: () => void) => void) | null>(null);
  const registerGuard = useCallback((guard: ((action: () => void) => void) | null) => {navigationGuard.current = guard;}, []);
  const guarded = (action: () => void) => navigationGuard.current ? navigationGuard.current(action) : action();
  const go = (next: string, nextRoute = '') => guarded(() => {setHistory(old => [...old, {view, route: legacyRoute}]); setView(next); setLegacyRoute(nextRoute);});
  const back = () => guarded(() => {const previous = history[history.length - 1]; setHistory(old => old.slice(0, -1)); setView(previous?.view || 'overview'); setLegacyRoute(previous?.route || '');});
  const tab = (next: string) => guarded(() => {setHistory([]); setView(next); setLegacyRoute('');});
  const callbacks = useRef({onOpenSupport}); callbacks.current = {onOpenSupport};
  const [provider, setProvider] = useState<ProviderAccount | null>(null);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [kind, setKind] = useState<string>('government_id');
  const readFlight = useRef(false);
  const generation = useRef(0), mutation = useRef(false), mounted = useRef(true);
  const invalidate = useCallback(() => {generation.current++; readFlight.current = false;}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; invalidate();};}, [invalidate]);
  useEffect(() => {setView(nativeProviderView(route)); setLegacyRoute(route); setHistory([]);}, [route]);
  const context = providerRouteContext(route);
  useEffect(() => {
    if (view === 'legacy' || view === 'messages' || !context.event && !context.notification) return;
    let current = true;
    void acknowledgeProviderRoute(token, context.event, context.notification).catch(() => {if (current) setNotice('This page is available. Notification read status could not update yet.');});
    return () => {current = false;};
  }, [token, view, context.event, context.notification]);
  // Support belongs to the authenticated identity, including applicants and
  // restricted/expired providers. Reuse the app's existing native Support flow.
  useEffect(() => {if (view === 'support') callbacks.current.onOpenSupport(providerSupportTicket(route));}, [view, route]);
  const load = useCallback(async () => {
    if (readFlight.current) return; readFlight.current = true;
    const version = ++generation.current;
    setLoading(true); setError('');
    try {
      let account: ProviderAccount | null;
      try {account = await providerRequest(token, '/providers/me');}
      catch (failure) {if (failure instanceof ProviderRequestError && failure.status === 404) account = null; else throw failure;}
      if (!mounted.current || version !== generation.current) return;
      setProvider(account); setReady(true);

    } catch (failure) {
      if (mounted.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Could not load provider access. Retry below.');
    } finally {if (version === generation.current) {readFlight.current = false; if (mounted.current) setLoading(false);}}
  }, [token]);
  useEffect(() => {void load(); return invalidate;}, [load, invalidate]);
  useEffect(() => {
    if (view !== 'verification' || !provider?.id) return;
    let current = true;
    void providerRequest(token, '/providers/me/verification-documents').then(data => {if (current) setDocuments(data.items || []);}).catch(failure => {if (current) setError(failure instanceof Error ? failure.message : 'Documents could not load. Retry.');});
    return () => {current = false;};
  }, [token, view, provider?.id]);

  const run = async (action: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {await action();}
    catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not complete this operation.');}
    finally {mutation.current = false; if (mounted.current) setBusy(false);}
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled: disabled || busy}} disabled={disabled || busy} onPress={action} style={[s.button, {backgroundColor: c.soft, borderColor: c.line, opacity: disabled ? .55 : 1}]}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  const card = (title: string, children: React.ReactNode) => <View style={[s.card, {backgroundColor: c.surface, borderColor: c.line}]}><Text style={s.title}>{title}</Text>{children}</View>;
  const uploadDocument = (source: 'camera' | 'library' | 'file') => void run(async () => {
    const documentKind = kind;
    let file: {uri: string; mime: string; bytes: number; name: string};
    if (source === 'file') {
      const driverPhoto = ['drivers_license', 'driver_vehicle', 'driver_plate'].includes(documentKind);
      const result = await DocumentPicker.getDocumentAsync({type: driverPhoto ? ['image/jpeg', 'image/png', 'image/webp'] : ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true, multiple: false});
      if (result.canceled) return;
      const asset = result.assets[0]; file = {uri: asset.uri, mime: asset.mimeType || '', bytes: asset.size || 0, name: asset.name};
    } else {
      const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(source === 'camera' ? 'Allow camera access to take a clear verification photo. You can change this in phone settings.' : 'Allow photo access to choose a verification image. You can change this in phone settings.');
      const options: ImagePicker.ImagePickerOptions = {mediaTypes: ['images'], quality: 1, allowsEditing: false};
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0]; file = {uri: asset.uri, mime: asset.mimeType || '', bytes: asset.fileSize || 0, name: asset.fileName || 'verification.jpg'};
    }
    if (!mounted.current) return;
    const validation = verificationFileError(documentKind, file.mime, file.bytes);
    if (validation) throw new Error(validation);
    const signed = await providerRequest(token, '/providers/me/uploads/presign', {method: 'POST', body: JSON.stringify({filename: file.name, mime_type: file.mime, purpose: 'verification'})});
    await putProviderPhoto(signed.upload_url, file.uri, file.mime);
    // Never replay this mutation automatically after an ambiguous timeout.
    await providerRequest(token, '/providers/me/verification-documents', {method: 'POST', body: JSON.stringify({document_type: documentKind, document_url: signed.view_url})});
    if (mounted.current) {setNotice('Document submitted for review.'); await load(); const data = await providerRequest(token, '/providers/me/verification-documents'); if (mounted.current) setDocuments(data.items || []);}
  });
  const previewDocument = (id: string) => void run(async () => {
    // Fetch a new short-lived signed link. Never persist links in the app cache.
    const data = await providerRequest(token, '/providers/me/verification-documents');
    const item = (data.items || []).find((document: Document) => document.id === id);
    if (!item?.document_url) throw new Error('This document is unavailable. Refresh its status or contact Support.');
    const url = privateDocumentPreviewURL(item.document_url);
    if (mounted.current) await WebBrowser.openBrowserAsync(url);
  });
  const paid = provider ? hasPaidProviderAccess(provider) : false;
  const roots = ['overview', 'catalog', 'requests', 'messages', 'more'];
  const selected = view === 'overview' ? 'overview' : ['catalog', 'products', 'listings'].includes(view) ? 'catalog' : view === 'requests' ? 'requests' : view === 'messages' && !legacyRoute.includes('town-hall') ? 'messages' : 'more';
  const labels: Record<string, string> = {overview: 'Provider workspace', catalog: 'Listings', requests: 'Bookings', messages: 'Chats', more: 'More', products: 'Products', listings: 'Services', verification: 'Verification documents', subscription: 'Subscriptions', profile: 'Business profile', driver: 'Driver availability', 'merchant-orders': 'Previous paid orders', notifications: 'Notifications', referrals: 'Refer and earn XP'};
  const row = (label: string, icon: React.ComponentProps<typeof Ionicons>['name'], action: () => void) => <Pressable key={label} accessibilityRole="button" onPress={action} disabled={busy} style={({pressed}) => [s.menuRow, {backgroundColor: pressed ? c.soft : c.surface, borderColor: c.line}]}><View style={[s.menuIcon, {backgroundColor: c.soft}]}><Ionicons name={icon} size={23} color={c.accent}/></View><Text style={{flex: 1, fontWeight: '600'}}>{label}</Text><Ionicons name="chevron-forward" size={18} color={c.muted}/></Pressable>;
  const tools = provider && <>
    {view === 'products' || view === 'listings' ? <NativeProviderCatalog key={`${provider.id}:${token}:${view}${context.listing ? ":"+context.listing : ""}`} initialItemID={context.listing} embedded token={token} kind={view} provider={provider} onClose={back} onNavigationGuard={registerGuard}/> :
    view === 'messages' ? <NativeProviderMessages embedded token={token} route={legacyRoute} onClose={back}/> :
    view === 'requests' ? <NativeProviderRequests embedded key={context.request} token={token} requestID={context.request} onClose={back}/> :
    view === 'merchant-orders' ? <NativeProviderOrders embedded token={token} onClose={back}/> :
    view === 'notifications' && onOpenNotification ? <NativeProviderNotifications embedded token={token} hasProvider onClose={back} onOpen={onOpenNotification}/> :
    view === 'referrals' ? <NativeReferrals embedded token={token} onClose={back} onOpenXP={() => onOpenNotification?.({notification_type: 'xp_earned'})}/> :
    <ScrollView contentContainerStyle={{padding: 16, gap: 12}} refreshControl={<RefreshControl refreshing={loading && ready} onRefresh={() => {if (!busy) void load();}}/>}>
      {view === 'overview' && <>
<View style={[s.card, {padding: 0, overflow: 'hidden', backgroundColor: c.surface, borderColor: c.line}]}><View style={{height: 126, backgroundColor: c.soft}}>{!!provider.provider_identity?.banner_url && <ResilientImage fallbackUri="" uri={provider.provider_identity.banner_url} style={{width: '100%', height: 126}}/>}</View><View style={{padding: 16, paddingTop: 0, gap: 8}}><View style={{marginTop: -35, width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: c.surface, backgroundColor: c.soft, overflow: 'hidden'}}>{provider.provider_identity?.avatar_url ? <ResilientImage fallbackUri="" uri={provider.provider_identity.avatar_url} style={{width: '100%', height: '100%'}}/> : <Text style={{padding: 20, fontSize: 24}}>{provider.business_name[0]}</Text>}</View><Text style={s.title}>{provider.business_name}</Text><Text>Verification: {provider.verification_status}</Text>{!!provider.verification_notes && <Text>{provider.verification_notes}</Text>}<Text>{paid ? `Paid access ends ${new Date(provider.subscription!.current_period_end!).toLocaleDateString()}` : 'Free access: one post and one image after approval. Upgrade for more.'}</Text>{provider.is_active === false && <Text style={{color: c.danger}}>Provider access is restricted. Permitted customer features remain available.</Text>}</View></View>
        <NativeProviderOverviewSummary key={`${provider.id}:${token}`} token={token} products={provider.can_sell_products !== false} services={provider.can_offer_services !== false}/>
        {card('Quick access', <>{row('Bookings and enquiries', 'calendar-outline', () => go('requests'))}{row('Town Hall', 'people-outline', () => go('messages', 'view=messages&mode=town-hall'))}{row('Refer and earn XP', 'gift-outline', () => go('referrals'))}</>)}
      </>}
      {view === 'catalog' && card('Your listings', <><Text>Customers can message you directly about each product or service.</Text>{provider.can_sell_products !== false && row('Products', 'cube-outline', () => go('products'))}{provider.can_offer_services !== false && row('Services', 'briefcase-outline', () => go('listings'))}</>)}
      {view === 'more' && <>
        {card('Business', <>{row('Business profile and images', 'images-outline', () => go('profile'))}{row('Verification documents', 'document-text-outline', () => go('verification'))}{row('Subscription and cancellation', 'card-outline', () => go('subscription'))}{row('Promotions and performance','megaphone-outline',()=>go('promotions'))}{provider.can_sell_products !== false && row('Previous paid orders', 'receipt-outline', () => go('merchant-orders'))}{provider.is_driver && row('Driver availability', 'car-outline', () => go('driver'))}</>)}
        {card('Community', <>{row('Town Hall', 'people-outline', () => go('messages', 'view=messages&mode=town-hall'))}{row('Refer and earn XP', 'gift-outline', () => go('referrals'))}</>)}
        {card('Preferences and help', <>{row('Notifications', 'notifications-outline', () => go('notifications'))}{onOpenSettings && row('App settings and notifications', 'settings-outline', onOpenSettings)}{row('Support', 'help-circle-outline', () => onOpenSupport())}</>)}
        {row('Switch to customer', 'swap-horizontal-outline', onClose)}<Text>Browse and buy with the same account. Open Account to return to your provider workspace.</Text>
      </>}
{provider && view === 'verification' && card('Verification documents', <><Text>{provider.is_driver ? 'Upload separate clear photos of your driver licence, your car and its plate number. All three need approval before driving services go live.' : 'Upload clear evidence for your business. Documents are sent for private review.'}</Text><Text>Select a document type</Text>{verificationKinds.map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{checked: kind === value}} key={value} onPress={() => setKind(value)} style={[s.button, {borderColor: c.line, backgroundColor: kind === value ? c.soft : c.surface}]}><Text>{label}</Text></Pressable>)}{button('Take and submit photo', () => uploadDocument('camera'), provider.is_active === false || loading)}{button('Choose and submit photo', () => uploadDocument('library'), provider.is_active === false || loading)}{button('Choose document from files', () => uploadDocument('file'), provider.is_active === false || loading)}<Text>Up to 10 MB. Driver licence, car and plate evidence must be photos. Other documents may also be PDF.</Text>{documents.length === 0 && !loading && <Text>No documents submitted yet.</Text>}{documents.map(document => <View key={document.id} style={[s.card, {borderColor: c.line}]}><Text style={{fontWeight: '700'}}>{verificationKinds.find(([value]) => value === document.document_type)?.[1] || document.document_type}</Text><Text>{document.status}</Text>{button('View submitted document', () => previewDocument(document.id))}{!!document.review_notes && <Text>{document.review_notes}</Text>}</View>)}</>)}
      {view === 'subscription' && card('Subscriptions and renewal', <NativeProviderSubscription key={`${provider.id}:${token}`} token={token} provider={provider} onChanged={load}/>)}
      {view === 'promotions' && <NativeProviderPromotions key={`${provider.id}:${token}`} token={token}/>}
      {view === 'profile' && card('Business profile', <NativeProviderProfile key={provider.id} token={token} provider={provider} onSaved={load}/>)}
      {view === 'driver' && card('Driver availability', <NativeProviderDriver key={`${provider.id}:${token}`} token={token} providerID={provider.id}/>)}
      {view === 'legacy' && card('Link unavailable', <><Text>This provider page is unavailable.</Text>{button('Open overview', () => tab('overview'))}</>)}
    </ScrollView>}
  </>;
  return <ProviderPanelBackContext.Provider value={registerPanelBack}><Modal animationType="slide" onRequestClose={() => {const handlers = [...panelBackHandlers.current.values()]; if (handlers.length) {handlers[handlers.length - 1](); return;} if (history.length || !roots.includes(view)) back(); else tab('more');}}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, backgroundColor: c.background, paddingTop: insets.top}}>
    <View style={[s.header, {backgroundColor: c.surface, borderColor: c.line}]}><Image source={LOGO} resizeMode="contain" style={{width: 32, height: 32}}/><Text style={{fontSize: 10, color: c.muted}}>PROVIDER</Text><Text numberOfLines={1} style={[s.title, {flex: 1, fontSize: 16}]}>{labels[view] || 'Provider workspace'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Provider notifications" onPress={() => go('notifications')} style={{padding: 10}}><Ionicons name="notifications-outline" color={c.accent} size={23}/></Pressable></View>
    {!roots.includes(view) && !['products', 'listings', 'merchant-orders', 'notifications', 'referrals', 'messages'].includes(view) && <View style={{paddingHorizontal: 16}}>{button('Back', back)}</View>}
    {!!error && <View style={{padding: 12, gap: 8}}><Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>{button('Refresh account', () => void load())}</View>}
    {!!notice && <Text style={{padding: 12, color: c.accent}}>{notice}</Text>}{busy && <ActivityIndicator/>}
    <View style={{flex: 1}}>{!ready ? <ActivityIndicator accessibilityLabel="Loading provider account"/> : !provider ? <ScrollView contentContainerStyle={{padding: 16}}><NativeProviderOnboarding token={token} onSaved={async isDriver => {setKind(isDriver ? 'drivers_license' : 'government_id'); setView('verification'); await load();}} onRefresh={() => void load()}/>{row('Switch to customer', 'swap-horizontal-outline', onClose)}</ScrollView> : tools}</View>
    <View accessibilityLabel="Provider navigation" style={[s.tabs, {backgroundColor: c.surface, borderColor: c.line}]}>{([['overview', 'Overview', 'home-outline'], ['catalog', 'Listings', 'list-outline'], ['requests', 'Bookings', 'calendar-outline'], ['messages', 'Chats', 'chatbubbles-outline'], ['more', 'More', 'ellipsis-horizontal']] as const).map(([id, label, icon]) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected: selected === id, disabled: busy}} disabled={busy} onPress={() => tab(id)} style={({pressed}) => ({flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 60, gap: 4, backgroundColor: pressed ? c.soft : c.surface})}><Ionicons name={icon} size={22} color={selected === id ? c.accent : c.muted}/><Text style={{fontSize: 11, color: selected === id ? c.accent : c.muted}}>{label}</Text></Pressable>)}</View>
  </KeyboardFrame></Modal></ProviderPanelBackContext.Provider>;
}
const s = StyleSheet.create({header: {flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, borderBottomWidth: 1}, tabs: {flexDirection: 'row', borderTopWidth: 1}, menuRow: {flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderWidth: 1, borderRadius: 14, minHeight: 56}, menuIcon: {width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center'}, card: {borderWidth: 1, padding: 16, borderRadius: 18, gap: 12}, title: {fontSize: 18, fontWeight: '700'}, button: {minHeight: 46, borderRadius: 12, borderWidth: 1, padding: 12, justifyContent: 'center'}});
