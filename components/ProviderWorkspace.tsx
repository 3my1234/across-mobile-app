import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
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
type Props = {token: string; route?: string; onClose: () => void; onSignedOut: () => void; onOpenSupport: (ticketId?: string) => void; onOpenSettings?: () => void};

// Native is the normal app experience. Explicit false retains the rollback path.
export function ProviderWorkspace(props: Props) {
  if (process.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT === 'false') return <LegacyProviderWorkspace {...props}/>;
  return <NativeProviderAccount {...props}/>;
}
export function NativeProviderAccount({token, route = '', onClose, onOpenSupport, onOpenSettings}: Props) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [view, setView] = useState(() => nativeProviderView(route)), [legacyRoute, setLegacyRoute] = useState(route);
  const [provider, setProvider] = useState<ProviderAccount | null>(null);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [kind, setKind] = useState<string>('government_id');
  const generation = useRef(0), mutation = useRef(false), mounted = useRef(true);
  const invalidate = useCallback(() => {generation.current++;}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; invalidate();};}, [invalidate]);
  useEffect(() => {setView(nativeProviderView(route)); setLegacyRoute(route);}, [route]);
  const context = providerRouteContext(route);
  useEffect(() => {
    if (view === 'legacy' || view === 'messages' || !context.event && !context.notification) return;
    let current = true;
    void acknowledgeProviderRoute(token, context.event, context.notification).catch(() => {if (current) setNotice('This page is available. Notification read status could not update yet.');});
    return () => {current = false;};
  }, [token, view, context.event, context.notification]);
  // Support belongs to the authenticated identity, including applicants and
  // restricted/expired providers. Reuse the app's existing native Support flow.
  useEffect(() => {if (view === 'support') onOpenSupport(providerSupportTicket(route));}, [view, route, onOpenSupport]);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true); setError('');
    try {
      let account: ProviderAccount | null;
      try {account = await providerRequest(token, '/providers/me');}
      catch (failure) {if (failure instanceof ProviderRequestError && failure.status === 404) account = null; else throw failure;}
      if (!mounted.current || version !== generation.current) return;
      setProvider(account); setReady(true);
      if (account && view === 'verification') {
        const data = await providerRequest(token, '/providers/me/verification-documents');
        if (mounted.current && version === generation.current) setDocuments(data.items || []);
      }

    } catch (failure) {
      if (mounted.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Could not load provider access. Retry below.');
    } finally {if (mounted.current && version === generation.current) setLoading(false);}
  }, [token, view]);
  useEffect(() => {if (view !== 'legacy' && view !== 'support') void load(); return invalidate;}, [load, view, invalidate]);
  const run = async (action: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {await action();}
    catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not complete this operation.');}
    finally {mutation.current = false; if (mounted.current) setBusy(false);}
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled: disabled || busy}} disabled={disabled || busy} onPress={action} style={[s.button, {backgroundColor: c.soft, borderColor: c.line, opacity: disabled || busy ? .55 : 1}]}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
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
    if (mounted.current) {setNotice('Document submitted for review.'); await load();}
  });
  const previewDocument = (id: string) => void run(async () => {
    // Fetch a new short-lived signed link. Never persist links in the app cache.
    const data = await providerRequest(token, '/providers/me/verification-documents');
    const item = (data.items || []).find((document: Document) => document.id === id);
    if (!item?.document_url) throw new Error('This document is unavailable. Refresh its status or contact Support.');
    const url = privateDocumentPreviewURL(item.document_url);
    if (mounted.current) await WebBrowser.openBrowserAsync(url);
  });
  if (view === 'legacy') return <Modal onRequestClose={onClose}><View style={{flex: 1, padding: 20, paddingTop: insets.top + 20, gap: 16, backgroundColor: c.background}}><Text>This provider link is unavailable. Open your provider workspace to continue.</Text>{button('Open provider overview', () => setView('overview'))}{button('Back to customer', onClose)}</View></Modal>;
  if (provider && view === 'messages') return <NativeProviderMessages token={token} route={legacyRoute} onClose={() => setView('overview')}/>;
  if (provider && view === 'requests') return <NativeProviderRequests key={`${provider.id}:${token}:${context.request}`} token={token} requestID={context.request} onClose={() => {setView('overview');}}/>;
  if (provider && view === 'merchant-orders') return <NativeProviderOrders key={`${provider.id}:${token}`} token={token} onClose={() => setView('overview')}/>;
  if (provider && (view === 'listings' || view === 'products')) return <NativeProviderCatalog key={`${token}:${view}`} token={token} kind={view} provider={provider} onClose={() => setView('overview')}/>;
  const paid = provider ? hasPaidProviderAccess(provider) : false;
  return <Modal animationType="slide" onRequestClose={onClose}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, backgroundColor: c.background, paddingTop: insets.top}}>
    <View style={[s.header, {backgroundColor: c.surface, borderColor: c.line}]}><Pressable accessibilityRole="button" onPress={onClose} style={{padding: 10}}><Text style={{color: c.accent}}>Back to customer</Text></Pressable><Text style={[s.title, {flex: 1}]}>Provider workspace</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0}} contentContainerStyle={{padding: 12, gap: 8}}>{[['overview', 'Overview'], ['verification', 'Documents'], ['subscription', 'Subscriptions'], ['support', 'Support']].map(([id, label]) => <Pressable accessibilityRole="tab" accessibilityState={{selected: view === id, disabled: busy}} disabled={busy} key={id} onPress={() => setView(id)} style={[s.button, {backgroundColor: view === id ? c.soft : c.surface, borderColor: c.line}]}><Text>{label}</Text></Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={{padding: 16, gap: 12}} refreshControl={<RefreshControl refreshing={loading && ready} onRefresh={() => {if (!busy) void load();}}/>}>
      {loading && !ready && <ActivityIndicator accessibilityLabel="Loading provider account"/>}
      {!!error && card('Please retry', <><Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>{button('Refresh account', () => void load())}<Text>After an interrupted submission, refresh before submitting again.</Text></>)}
      {!!notice && <Text accessibilityRole="alert" style={{color: c.accent}}>{notice}</Text>}
      {busy && <ActivityIndicator accessibilityLabel="Saving provider changes"/>}
      {ready && !provider && card('Provider setup', <><NativeProviderOnboarding token={token} onSaved={async () => {setNotice('Provider profile submitted. Upload your verification documents next.'); setView('verification'); await load();}} onRefresh={() => void load()}/></>)}
      {provider && view === 'overview' && <>
        <Text>Your business workspace: manage listings, documents, subscriptions and customer conversations. Use Back to customer to browse and buy with the same account.</Text>
        <View style={[s.card, {padding: 0, overflow: 'hidden', backgroundColor: c.surface, borderColor: c.line}]}><View style={{height: 126, backgroundColor: c.soft}}>{!!provider.provider_identity?.banner_url && <ResilientImage uri={provider.provider_identity.banner_url} style={{width: '100%', height: 126}}/>}</View><View style={{padding: 16, paddingTop: 0, gap: 8}}><View style={{marginTop: -35, width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: c.surface, backgroundColor: c.soft, overflow: 'hidden'}}>{provider.provider_identity?.avatar_url ? <ResilientImage uri={provider.provider_identity.avatar_url} style={{width: '100%', height: '100%'}}/> : <Text style={{padding: 20, fontSize: 24}}>{provider.business_name[0]}</Text>}</View><Text style={s.title}>{provider.business_name}</Text><Text>Verification: {provider.verification_status}</Text>{!!provider.verification_notes && <Text>{provider.verification_notes}</Text>}<Text>{paid ? `Paid access ends ${new Date(provider.subscription!.current_period_end!).toLocaleDateString()}` : 'Free access: one post and one image after approval. Upgrade for more.'}</Text>{provider.is_active === false && <Text style={{color: c.danger}}>Provider access is restricted. Permitted customer features remain available.</Text>}</View></View>
        <NativeProviderOverviewSummary key={`${provider.id}:${token}`} token={token} products={provider.can_sell_products !== false} services={provider.can_offer_services !== false}/>{card('Manage your business', <>{button('Verification documents', () => setView('verification'))}{button('Subscriptions and cancellation', () => setView('subscription'))}{provider.can_sell_products !== false && button('Products', () => setView('products'))}{provider.can_sell_products !== false && button('Previous paid orders', () => setView('merchant-orders'))}{provider.can_offer_services !== false && button('Services', () => setView('listings'))}{provider.is_driver && button('Driver availability', () => setView('driver'))}{button('Bookings and enquiries', () => setView('requests'))}{button('Customer conversations', () => {setLegacyRoute('view=messages'); setView('messages');})}{button('Town Hall', () => {setLegacyRoute('view=messages&mode=town-hall'); setView('messages');})}{button('Business profile and images', () => setView('profile'))}{onOpenSettings && button('App settings and notifications', onOpenSettings)}</>)}
      </>}
      {provider && view === 'verification' && card('Verification documents', <><Text>{provider.is_driver ? 'Upload separate clear photos of your driver licence, your car and its plate number. All three need approval before driving services go live.' : 'Upload clear evidence for your business. Documents are sent for private review.'}</Text><Text>Select a document type</Text>{verificationKinds.map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{checked: kind === value}} key={value} onPress={() => setKind(value)} style={[s.button, {borderColor: c.line, backgroundColor: kind === value ? c.soft : c.surface}]}><Text>{label}</Text></Pressable>)}{button('Take and submit photo', () => uploadDocument('camera'), provider.is_active === false || loading)}{button('Choose and submit photo', () => uploadDocument('library'), provider.is_active === false || loading)}{button('Choose document from files', () => uploadDocument('file'), provider.is_active === false || loading)}<Text>Up to 10 MB. Driver licence, car and plate evidence must be photos. Other documents may also be PDF.</Text>{documents.length === 0 && !loading && <Text>No documents submitted yet.</Text>}{documents.map(document => <View key={document.id} style={[s.card, {borderColor: c.line}]}><Text style={{fontWeight: '700'}}>{verificationKinds.find(([value]) => value === document.document_type)?.[1] || document.document_type}</Text><Text>{document.status}</Text>{button('View submitted document', () => previewDocument(document.id))}{!!document.review_notes && <Text>{document.review_notes}</Text>}</View>)}</>)}
      {provider && view === 'subscription' && card('Subscriptions and renewal', <NativeProviderSubscription key={`${provider.id}:${token}`} token={token} provider={provider} onChanged={load}/>)}
      {provider && view === 'profile' && card('Business profile', <NativeProviderProfile key={provider.id} token={token} provider={provider} onSaved={load}/>)}
      {provider && view === 'driver' && card('Driver availability', <NativeProviderDriver key={`${provider.id}:${token}`} token={token} providerID={provider.id}/>)}
    </ScrollView>
  </KeyboardFrame></Modal>;
}
const s = StyleSheet.create({header: {flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, borderBottomWidth: 1}, card: {borderWidth: 1, padding: 16, borderRadius: 18, gap: 12}, title: {fontSize: 18, fontWeight: '700'}, button: {minHeight: 46, borderRadius: 12, borderWidth: 1, padding: 12, justifyContent: 'center'}});
