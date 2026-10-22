import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ResilientImage} from './ResilientImage';
import {LegacyProviderWorkspace} from './LegacyProviderWorkspace';
import {hasPaidProviderAccess, nativeProviderView, ProviderAccount, verificationImageError, verificationKinds} from './nativeProviderPolicy';
import {providerRequest, ProviderRequestError, putProviderPhoto} from './nativeProviderApi';
import {money} from './utils';
import {NativeProviderCatalog} from './NativeProviderCatalog';
import {NativeProviderOnboarding} from './NativeProviderOnboarding';
import {NativeProviderProfile} from './NativeProviderProfile';

type Document = {id: string; document_type: string; status: string; review_notes?: string};
type Renewal = {can_manage: boolean; renewal_status: string; next_plan_name?: string};
type Plan = {id: string; name: string; amount_ngn: number; period_prices?: {duration_months: number; amount_ngn: number}[]};
type Props = {token: string; route?: string; onClose: () => void; onSignedOut: () => void};

// Opt in only after candidate device acceptance. The existing portal remains intact.
export function ProviderWorkspace(props: Props) {
  if (process.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT !== 'true') return <LegacyProviderWorkspace {...props}/>;
  return <NativeProviderAccount {...props}/>;
}
export function NativeProviderAccount({token, route = '', onClose, onSignedOut}: Props) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [view, setView] = useState(() => nativeProviderView(route)), [legacyRoute, setLegacyRoute] = useState(route);
  const [provider, setProvider] = useState<ProviderAccount | null>(null);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]), [renewal, setRenewal] = useState<Renewal | null>(null), [plans, setPlans] = useState<Plan[]>([]);
  const [kind, setKind] = useState<string>('government_id');
  const generation = useRef(0), mutation = useRef(false), mounted = useRef(true);
  const invalidate = useCallback(() => {generation.current++;}, []);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; invalidate();};}, [invalidate]);
  useEffect(() => {setView(nativeProviderView(route)); setLegacyRoute(route);}, [route]);
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
      if (account && view === 'subscription') {
        const [status, catalog] = await Promise.all([providerRequest(token, '/providers/me/subscription-renewal'), providerRequest(token, '/marketplace/subscription-plans')]);
        if (mounted.current && version === generation.current) {setRenewal(status); setPlans(catalog.items || []);}
      }
    } catch (failure) {
      if (mounted.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Could not load provider access. Retry below.');
    } finally {if (mounted.current && version === generation.current) setLoading(false);}
  }, [token, view]);
  useEffect(() => {if (view !== 'legacy') void load(); return invalidate;}, [load, view, invalidate]);
  const run = async (action: () => Promise<void>) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {await action();}
    catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not complete this operation.');}
    finally {mutation.current = false; if (mounted.current) setBusy(false);}
  };
  const openTools = (next = '') => {setLegacyRoute(next); setView('legacy');};
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{disabled: disabled || busy}} disabled={disabled || busy} onPress={action} style={[s.button, {backgroundColor: c.soft, borderColor: c.line, opacity: disabled || busy ? .55 : 1}]}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  const card = (title: string, children: React.ReactNode) => <View style={[s.card, {backgroundColor: c.surface, borderColor: c.line}]}><Text style={s.title}>{title}</Text>{children}</View>;
  const uploadDocument = () => void run(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Allow photo access to choose a verification image. You can change this in your phone settings.');
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: 1, allowsEditing: false});
    if (result.canceled) return;
    const asset = result.assets[0], mime = asset.mimeType || '';
    const validation = verificationImageError(mime, asset.fileSize || 0);
    if (validation) throw new Error(validation);
    const signed = await providerRequest(token, '/providers/me/uploads/presign', {method: 'POST', body: JSON.stringify({filename: asset.fileName || 'verification.jpg', mime_type: mime, purpose: 'verification'})});
    await putProviderPhoto(signed.upload_url, asset.uri, mime);
    // Never replay this mutation automatically after an ambiguous timeout.
    await providerRequest(token, '/providers/me/verification-documents', {method: 'POST', body: JSON.stringify({document_type: kind, document_url: signed.view_url})});
    if (mounted.current) {setNotice('Document submitted for review.'); await load();}
  });
  const cancelRenewal = () => Alert.alert('Stop automatic renewal?', 'Access already paid for remains until expiry. Future automatic payments and any next-plan choice will be stopped.', [
    {text: 'Keep renewal', style: 'cancel'},
    {text: 'Stop renewal', style: 'destructive', onPress: () => void run(async () => {
      await providerRequest(token, '/providers/me/subscription-renewal', {method: 'POST', body: JSON.stringify({next_plan_id: ''})});
      if (mounted.current) {setNotice('Cancellation submitted. Check the updated renewal status below.'); await load();}
    })},
  ]);
  if (view === 'legacy') return <LegacyProviderWorkspace token={token} route={legacyRoute} onClose={() => setView('overview')} onSignedOut={onSignedOut}/>;
  if (provider && (view === 'listings' || view === 'products')) return <NativeProviderCatalog key={`${token}:${view}`} token={token} kind={view} provider={provider} onClose={() => setView('overview')} onLegacy={() => openTools(`view=${view}`)}/>;
  const paid = provider ? hasPaidProviderAccess(provider) : false;
  return <Modal animationType="slide" onRequestClose={onClose}><View style={{flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom}}>
    <View style={[s.header, {backgroundColor: c.surface, borderColor: c.line}]}><Pressable accessibilityRole="button" onPress={onClose} style={{padding: 10}}><Text style={{color: c.accent}}>Back to customer</Text></Pressable><Text style={[s.title, {flex: 1}]}>Provider workspace</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0}} contentContainerStyle={{padding: 12, gap: 8}}>{[['overview', 'Overview'], ['verification', 'Documents'], ['subscription', 'Subscriptions']].map(([id, label]) => <Pressable accessibilityRole="tab" accessibilityState={{selected: view === id, disabled: busy}} disabled={busy} key={id} onPress={() => setView(id)} style={[s.button, {backgroundColor: view === id ? c.soft : c.surface, borderColor: c.line}]}><Text>{label}</Text></Pressable>)}</ScrollView>
    <ScrollView contentContainerStyle={{padding: 16, gap: 12}} refreshControl={<RefreshControl refreshing={loading && ready} onRefresh={() => {if (!busy) void load();}}/>}>
      {loading && !ready && <ActivityIndicator accessibilityLabel="Loading provider account"/>}
      {!!error && card('Please retry', <><Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>{button('Refresh account', () => void load())}<Text>After an interrupted submission, refresh before submitting again.</Text></>)}
      {!!notice && <Text accessibilityRole="alert" style={{color: c.accent}}>{notice}</Text>}
      {busy && <ActivityIndicator accessibilityLabel="Saving provider changes"/>}
      {ready && !provider && card('Provider setup', <><NativeProviderOnboarding token={token} onSaved={async () => {setNotice('Provider profile submitted. Upload your verification documents next.'); setView('verification'); await load();}} onRefresh={() => void load()}/>{button('Existing provider tools', () => openTools())}</>)}
      {provider && view === 'overview' && <>
        <View style={[s.card, {padding: 0, overflow: 'hidden', backgroundColor: c.surface, borderColor: c.line}]}><View style={{height: 126, backgroundColor: c.soft}}>{!!provider.provider_identity?.banner_url && <ResilientImage uri={provider.provider_identity.banner_url} style={{width: '100%', height: 126}}/>}</View><View style={{padding: 16, paddingTop: 0, gap: 8}}><View style={{marginTop: -35, width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: c.surface, backgroundColor: c.soft, overflow: 'hidden'}}>{provider.provider_identity?.avatar_url ? <ResilientImage uri={provider.provider_identity.avatar_url} style={{width: '100%', height: '100%'}}/> : <Text style={{padding: 20, fontSize: 24}}>{provider.business_name[0]}</Text>}</View><Text style={s.title}>{provider.business_name}</Text><Text>Verification: {provider.verification_status}</Text>{!!provider.verification_notes && <Text>{provider.verification_notes}</Text>}<Text>{paid ? `Paid access ends ${new Date(provider.subscription!.current_period_end!).toLocaleDateString()}` : 'Free access: one post and one image after approval. Upgrade for more.'}</Text>{provider.is_active === false && <Text style={{color: c.danger}}>Provider access is restricted. Permitted customer features remain available.</Text>}</View></View>
        {card('Manage your business', <>{button('Verification documents', () => setView('verification'))}{button('Subscriptions and cancellation', () => setView('subscription'))}{provider.can_sell_products !== false && button('Products', () => setView('products'))}{provider.can_offer_services !== false && button('Services', () => setView('listings'))}{button('Customer conversations', () => openTools('view=messages'))}{button('Business profile and images', () => setView('profile'))}</>)}
      </>}
      {provider && view === 'verification' && card('Verification documents', <><Text>{provider.is_driver ? 'Upload separate clear photos of your driver licence, your car and its plate number. All three need approval before driving services go live.' : 'Upload clear evidence for your business. Documents are sent for private review.'}</Text><Text>Select a document type</Text>{verificationKinds.map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{checked: kind === value}} key={value} onPress={() => setKind(value)} style={[s.button, {borderColor: c.line, backgroundColor: kind === value ? c.soft : c.surface}]}><Text>{label}</Text></Pressable>)}{button('Choose and submit photo', uploadDocument, provider.is_active === false || loading)}<Text>JPG, PNG or WebP, up to 10 MB. PDF submission remains available in existing provider tools during migration.</Text>{documents.length === 0 && !loading && <Text>No documents submitted yet.</Text>}{documents.map(document => <View key={document.id} style={[s.card, {borderColor: c.line}]}><Text style={{fontWeight: '700'}}>{verificationKinds.find(([value]) => value === document.document_type)?.[1] || document.document_type}</Text><Text>{document.status}</Text>{!!document.review_notes && <Text>{document.review_notes}</Text>}</View>)}</>)}
      {provider && view === 'subscription' && card('Your provider access', <><Text>{paid ? `Paid access continues until ${new Date(provider.subscription!.current_period_end!).toLocaleString()}.` : 'No current paid period. Existing customer conversations remain available.'}</Text><Text>{!renewal ? 'Renewal settings are not yet available. Refresh to verify billing status.' : renewal.renewal_status === 'stopped' ? 'Automatic renewal stopped.' : renewal?.renewal_status === 'uncertain' ? 'Cancellation is not confirmed. Future billing may still be active.' : provider.subscription?.billing_mode === 'one_time' ? 'Prepaid access does not renew automatically.' : 'Monthly card renewals continue until cancelled.'}</Text>{!!renewal?.next_plan_name && <Text>Next choice: {renewal.next_plan_name}. Complete checkout after your current paid period ends.</Text>}{renewal?.can_manage && button(renewal.renewal_status === 'uncertain' ? 'Retry cancellation' : 'Stop automatic renewal', cancelRenewal, loading)}{plans.map(plan => <View key={plan.id} style={[s.card, {borderColor: c.line}]}><Text style={s.title}>{plan.name}</Text><Text>{money(plan.amount_ngn)} / month</Text>{plan.period_prices?.filter(price => price.duration_months === 12).map(price => <Text key={price.duration_months}>{money(price.amount_ngn)} / year, prepaid</Text>)}</View>)}<Text>Subscription purchasing and next-plan checkout are not enabled in this mobile build. Existing paid access is preserved.</Text></>)}
      {provider && view === 'profile' && card('Business profile', <NativeProviderProfile key={provider.id} token={token} provider={provider} onSaved={load}/>)}
      {provider && button('Open existing provider tools', () => openTools())}
    </ScrollView>
  </View></Modal>;
}
const s = StyleSheet.create({header: {flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, borderBottomWidth: 1}, card: {borderWidth: 1, padding: 16, borderRadius: 18, gap: 12}, title: {fontSize: 18, fontWeight: '700'}, button: {minHeight: 46, borderRadius: 12, borderWidth: 1, padding: 12, justifyContent: 'center'}});
