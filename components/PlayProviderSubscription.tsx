import {ProviderTierDetails, ProviderTierUsage} from './ProviderTierDetails';
import {tierExplanation, type TierUsage} from './providerTierBenefits';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, Linking, Pressable, View} from 'react-native';
import {useIAP, type Purchase} from 'expo-iap';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {hasPaidProviderAccess, type ProviderAccount} from './nativeProviderPolicy';
import {createPlayPurchaseProcessor, playCatalog, playOffer, type PlayCatalog, type PlayPlan} from './playSubscriptionPolicy';

export function PlayProviderSubscription({token, provider, onChanged}: {token: string; provider: ProviderAccount; onChanged: () => Promise<void>}) {
  const c = useAccountDesign(), [catalog, setCatalog] = useState<PlayCatalog | null>(null), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(true), action = useRef(false), catalogRef = useRef<PlayCatalog | null>(null), processor = useRef<ReturnType<typeof createPlayPurchaseProcessor> | null>(null);
  const [usage, setUsage] = useState<TierUsage|null>(null);
  const readVersion=useRef(0);
  const onPurchase = useRef<(purchase: Purchase) => void>(() => {});
  const iap = useIAP({onPurchaseSuccess: purchase => onPurchase.current(purchase), onPurchaseError: failure => {
    if (alive.current) {setBusy(''); setNotice(failure.code === 'user-cancelled' ? 'Checkout closed. Restore purchases if a payment was sent. A checkout reservation expires after 15 minutes.' : 'Google Play could not finish checkout. Restore purchases before paying again.');}
    action.current = false;
  }});
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => {
      action.current = false;
      if (alive.current) {setBusy(''); setNotice('Google Play confirmation is taking longer than expected. Restore purchases before paying again. Your checkout reservation expires after 15 minutes.');}
    }, 45000);
    return () => clearTimeout(timer);
  }, [busy]);
  const refresh = useCallback(async () => {
    const version=++readVersion.current;
    const [raw,limits]=await Promise.all([providerRequest(token, '/providers/me/play-billing'),providerRequest(token, '/providers/me/post-policy').catch(()=>null)]);
    const result=playCatalog(raw);
    if (alive.current && version===readVersion.current) {catalogRef.current = result; setCatalog(result); setUsage(limits?.usage||null);}
  }, [token]);
  useEffect(() => {
    alive.current = true;
    processor.current = createPlayPurchaseProcessor(body => providerRequest(token, '/providers/me/play-billing/verify', {method: 'POST', body: JSON.stringify(body)}), purchase => iap.finishTransaction({purchase, isConsumable: false}), async () => {if (alive.current) {await onChanged(); await refresh();}});
    return () => {alive.current = false; readVersion.current++; processor.current = null; catalogRef.current = null;};
  }, [token, provider.id, onChanged, refresh, iap.finishTransaction]);
  onPurchase.current = purchase => {
    const current = catalogRef.current, process = processor.current;
    if (!alive.current || !current || !process) return;
    setBusy('verify'); setError('');
    void Promise.resolve().then(() => process(purchase, current)).then(message => {if (alive.current) setNotice(message);}).catch(() => {if (alive.current) setError('Payment could not be confirmed. Restore purchases or contact Support before paying again.');}).finally(() => {action.current = false; if (alive.current) setBusy('');});
  };
  useEffect(() => {void refresh().catch(() => {if (alive.current) setError('Google Play plans could not load. Retry when connected.');});}, [refresh]);
  const products = iap.fetchProducts, available = iap.getAvailablePurchases;
  useEffect(() => {if (iap.connected && catalog?.items.length) void products({skus: [...new Set(catalog.items.map(plan => plan.product_id))], type: 'subs'}).catch(() => {if (alive.current) setError('Google Play prices could not load.');});}, [iap.connected, catalog?.items.map(plan => plan.product_id).join('|'), products]);
  useEffect(() => {if (iap.connected && catalog) void available().catch(() => {if (alive.current) setError('Purchases could not be restored. Please retry.');});}, [iap.connected, !!catalog, available]);
  useEffect(() => {
    if (!catalog) return;
    for (const purchase of iap.availablePurchases.slice(0, 10)) {
      if (purchase.store === 'google' && catalog.items.some(plan => plan.product_id === purchase.productId) && (!('obfuscatedAccountIdAndroid' in purchase) || !purchase.obfuscatedAccountIdAndroid || purchase.obfuscatedAccountIdAndroid === catalog.account_id)) onPurchase.current(purchase);
    }
  }, [iap.availablePurchases, catalog?.account_id]);
  const restore = async () => {
    if (action.current) return; action.current = true; setBusy('restore'); setError('');
    try {await refresh(); await available(); if (alive.current) setNotice('Purchases restored from Google Play. Any pending payment is checked with the server.');}
    catch {if (alive.current) setError('Restore could not finish. Your paid access has not been removed. Retry when connected.');}
    finally {action.current = false; if (alive.current) setBusy('');}
  };
  useEffect(() => {const subscription = AppState.addEventListener('change', state => {if (state === 'active' && iap.connected) void restore();}); return () => subscription.remove();}, [iap.connected, refresh, available]);
  const start = (plan: PlayPlan) => {
    const offer = playOffer(plan, iap.subscriptions);
    if (!catalog || plan.purchasable === false || !offer || !iap.connected || action.current || hasPaidProviderAccess(provider)) return;
    Alert.alert('Confirm provider subscription', plan.prepaid ? `${plan.name}: ${offer.displayPrice} for ${plan.duration_months} month(s). One payment; does not renew automatically.` : `${plan.name}: ${offer.displayPrice} every ${plan.duration_months === 12 ? 'year' : `${plan.duration_months} month(s)`}. Renews automatically until cancelled in Google Play.`, [{text: 'Cancel', style: 'cancel'}, {text: 'Continue with Google Play', onPress: () => {
      if (action.current) return; action.current = true; setBusy(`${plan.product_id}:${plan.base_plan_id}`); setError('');
      void (async () => {
        const approved = await providerRequest(token, '/providers/me/play-billing/prepare', {method: 'POST', body: JSON.stringify({product_id: plan.product_id, base_plan_id: plan.base_plan_id})});
        if (!alive.current) return;
        if (approved.account_id !== catalog.account_id) throw Error('Account changed');
        await iap.requestPurchase({type: 'subs', request: {google: {skus: [plan.product_id], obfuscatedAccountIdAndroid: approved.account_id, subscriptionOffers: [{sku: plan.product_id, offerToken: offer.offerToken}]}}});
        // Completion is event-driven. A resolved request is not payment proof.
      })().catch(() => {action.current = false; if (alive.current) {setBusy(''); setError('Checkout did not complete. Restore purchases before paying again.');}});
    }}]);
  };
  const button = (label: string, id: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{busy: busy === id, disabled: !!busy || disabled}} disabled={!!busy || disabled} onPress={onPress} style={({pressed}) => ({padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.soft : c.surface, opacity: disabled ? .5 : 1})}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text>{busy === id && <ActivityIndicator/>}</Pressable>;
  return <View style={{gap: 12}}>
    <Text>Provider subscriptions through Google Play</Text>
    <Text>{hasPaidProviderAccess(provider) ? `Your paid access ends ${new Date(provider.subscription!.current_period_end!).toLocaleString()}.` : 'No current paid access. Your existing conversations remain available.'}</Text>
    {catalog?.state && <Text>{catalog.auto_renews ? 'Automatic renewal is on in Google Play.' : 'Google Play automatic renewal is off or this purchase is inactive.'}</Text>}
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    {busy === 'verify' && <View style={{gap: 6}}><ActivityIndicator accessibilityLabel="Checking Google Play payment"/><Text>Checking your Google Play payment. Please do not pay again.</Text></View>}
    {button('Restore purchases and refresh status', 'restore', () => void restore(), !iap.connected)}
    {button('Reload available plans', 'catalog', () => {void refresh().catch(() => {if (alive.current) setError('Plans could not load. Retry when connected.');});})}
    {button('Manage or cancel in Google Play', 'manage', () => {void Linking.openURL('https://play.google.com/store/account/subscriptions?package=com.atlanticexpress.mobile').catch(() => setError('Google Play could not open. Open Play Store → Payments and subscriptions → Subscriptions.'));})}
    {!iap.connected && <Text>Connecting to Google Play. Install this version through Google Play to make store purchases.</Text>}
    <ProviderTierUsage usage={usage}/><Text style={{fontWeight:"700"}}>Compare available plans</Text>
    {catalog?.items.map(plan => {let offer; try {offer = playOffer(plan, iap.subscriptions);} catch {offer = null;} return <View key={`${plan.product_id}:${plan.base_plan_id}`} style={{padding: 14, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: c.line}}><Text style={{fontWeight: '700'}}>{plan.name}</Text><Text>{offer ? `${offer.displayPrice} / ${plan.prepaid ? `${plan.duration_months} month(s), prepaid` : plan.duration_months === 12 ? 'year' : 'month'}` : 'Google Play price is unavailable. Refresh before purchasing.'}</Text><ProviderTierDetails plan={plan}/>{plan.amount_ngn !== undefined && <Text>Monthly plan price: NGN {plan.amount_ngn.toLocaleString()}</Text>}{button('Subscribe with Google Play', `${plan.product_id}:${plan.base_plan_id}`, () => start(plan), plan.purchasable === false || !offer || !iap.connected || hasPaidProviderAccess(provider))}</View>;})}
    {catalog && !catalog.items.length && <Text>No Google Play subscription products are available yet. Existing provider access is preserved.</Text>}
    <Text>{tierExplanation}</Text><Text>Google Play controls recurring payments. Cancellation stops future renewal; paid access continues until the confirmed expiry. If your current subscription was purchased directly, manage its renewal in the original checkout channel or contact Support.</Text>
  </View>;
}
