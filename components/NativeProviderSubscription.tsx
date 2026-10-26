import {ProviderTierDetails, ProviderTierUsage} from './ProviderTierDetails';
import {tierExplanation, TierUsage} from './providerTierBenefits';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, Platform, Pressable, View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {hasPaidProviderAccess, ProviderAccount} from './nativeProviderPolicy';
import {money} from './utils';
import {pendingProviderCheckout, PendingProviderCheckout, ProviderPlan, providerCheckoutLink, providerCheckoutPayload, providerPaymentReturn, providerPeriodPrice} from './providerSubscriptionPolicy';
import {PlayProviderSubscription} from './PlayProviderSubscription';

type Renewal = {can_manage: boolean; renewal_status: string; current_plan_id?: string; next_plan_id?: string; next_plan_name?: string; change_at?: string};
export function NativeProviderSubscription({token, provider, onChanged}: {token: string; provider: ProviderAccount; onChanged: () => Promise<void>}) {
  return Platform.OS === 'android' && process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'play'
    ? <View style={{gap: 16}}><PlayProviderSubscription token={token} provider={provider} onChanged={onChanged}/>{provider.subscription?.billing_provider !== 'google_play' && provider.subscription?.billing_mode === 'recurring' && provider.subscription.status !== 'none' && <DirectProviderSubscription token={token} provider={provider} onChanged={onChanged} managementOnly/>}</View>
    : <DirectProviderSubscription token={token} provider={provider} onChanged={onChanged}/>;
}
export function DirectProviderSubscription({token, provider, onChanged, managementOnly = false}: {token: string; provider: ProviderAccount; onChanged: () => Promise<void>; managementOnly?: boolean}) {
  const c = useAccountDesign(), storageKey = `across.providerCheckout.v1.${provider.id}`;
  const [usage, setUsage] = useState<TierUsage|null>(null);
  const [plans, setPlans] = useState<ProviderPlan[]>([]), [renewal, setRenewal] = useState<Renewal | null>(null);
  const [pending, setPending] = useState<PendingProviderCheckout | null>(null), [loaded, setLoaded] = useState(false);
  const [months, setMonths] = useState(1), [method, setMethod] = useState('card');
  const [activeAction, setActiveAction] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(true), flight = useRef(false), readVersion = useRef(0), checking = useRef(false);
  const recovered = useRef(false);
  // Direct Android APK distribution can use the existing gateway. Store builds
  // remain closed until their billing integration/policy gate is satisfied.
  const checkoutEnabled = !managementOnly && Platform.OS === 'android' && process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'direct';
  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    const [status, catalog, raw, limits] = await Promise.all([providerRequest(token, '/providers/me/subscription-renewal'), providerRequest(token, '/marketplace/subscription-plans'), SecureStore.getItemAsync(storageKey), providerRequest(token, '/providers/me/post-policy').catch(() => null)]);
    let saved: PendingProviderCheckout | null;
    try {saved = status.can_manage ? pendingProviderCheckout(raw, provider.id) || (status.has_pending_checkout ? {provider_id:provider.id,created_at:new Date().toISOString()} : null) : null;}
    catch (failure) {
      if (alive.current && version === readVersion.current) {setUsage(limits?.usage || null); setRenewal(status); setPlans(catalog.items || []); setPending({provider_id: provider.id, created_at: new Date().toISOString()}); setLoaded(true);}
      throw failure;
    }
    if (alive.current && version === readVersion.current) {setUsage(limits?.usage || null); setRenewal(status); setPlans(catalog.items || []); setPending(saved); setLoaded(true);}
  }, [token, provider.id, storageKey]);
  const invalidateReads = useCallback(() => {readVersion.current++;}, []);
  useEffect(() => {alive.current = true; setUsage(null); void refresh().catch(failure => {if (alive.current) setError(failure instanceof Error ? failure.message : 'Billing status could not load.');}); return () => {alive.current = false; invalidateReads();};}, [refresh, invalidateReads]);
  const run = async (action: () => Promise<void>) => {
    if (flight.current || !alive.current) return; flight.current = true; setBusy(true); setError('');
    try {await action();} catch (failure) {if (alive.current) setError(failure instanceof Error ? failure.message : 'Payment could not be confirmed. Check its status before paying again.');}
    finally {flight.current = false; if (alive.current) setBusy(false);}
  };
  const confirm = useCallback(async (saved: PendingProviderCheckout | null, returnURL = '') => {
    if (checking.current) return; checking.current = true;
    try {
      const payload = returnURL && saved ? providerPaymentReturn(returnURL, saved) : {tx_ref: saved?.tx_ref || ''};
      const result = await providerRequest(token, '/providers/me/subscription-confirm', {method: 'POST', body: JSON.stringify(payload)});
      if (result.payment_state === 'settled' || result.payment_state === 'not_found') {
        await SecureStore.deleteItemAsync(storageKey);
        if (alive.current) {setPending(null); setNotice(result.payment_state === 'settled' ? 'Payment verified. Your paid access has been updated.' : 'No pending payment was found. You can choose a plan.'); await onChanged();}
      } else if (alive.current) setNotice('Payment is not confirmed yet. If you have not paid, use Cancel unpaid checkout to choose another method. If you have paid, check payment status; do not pay again.');
      if (alive.current) await refresh();
    } finally {checking.current = false;}
  }, [token, storageKey, onChanged, refresh]);
  useEffect(() => {
    if (!loaded || recovered.current) return;
    recovered.current = true;
    if (renewal?.can_manage && pending && !flight.current) void confirm(pending).catch(failure => {if (alive.current) setError(failure instanceof Error ? failure.message : 'Check payment status when connected.');});
  }, [loaded, renewal?.can_manage, pending, confirm]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {if (state === 'active' && loaded && renewal?.can_manage && pending && !flight.current && !checking.current) void confirm(pending).catch(failure => {if (alive.current) setError(failure instanceof Error ? failure.message : 'Check payment status when connected.');});});
    return () => listener.remove();
  }, [loaded, renewal?.can_manage, pending, confirm]);
  const openCheckout = async (saved: PendingProviderCheckout) => {
    if (!saved.checkout_link) throw Error('The previous checkout could not be confirmed. Check payment status or contact Support before starting another payment.');
    const result = await WebBrowser.openAuthSessionAsync(providerCheckoutLink(saved.checkout_link), 'across://providers/subscription');
    if (!alive.current) return;
    setNotice(result.type === 'cancel' || result.type === 'dismiss' ? 'Checkout closed. This does not cancel a payment already sent. Checking its status…' : 'Verifying your payment…');
    await confirm(saved, result.type === 'success' ? result.url : '');
  };
  const start = (plan: ProviderPlan) => Alert.alert('Confirm subscription', `${plan.name} · ${months} month(s) · ${money(providerPeriodPrice(plan, months) ?? 0)}. ${method === 'card' && months === 1 ? 'Monthly card payments renew until cancelled.' : 'This is prepaid access and does not renew automatically.'}`, [{text: 'Cancel', style: 'cancel'}, {text: 'Continue to payment', onPress: () => void run(async () => {
    if (!checkoutEnabled || !renewal?.can_manage || !loaded || pending || checking.current) throw Error('Refresh billing status before starting checkout.');
    if (hasPaidProviderAccess(provider)) throw Error('Your current paid period is still active. Choose a next-period plan instead.');
    const payload = providerCheckoutPayload(plan, months, method, 'across://providers/subscription');
    const marker: PendingProviderCheckout = {provider_id: provider.id, created_at: new Date().toISOString()};
    await SecureStore.setItemAsync(storageKey, JSON.stringify(marker)); if (alive.current) setPending(marker);
    const result = await providerRequest(token, '/providers/me/subscription-checkout', {method: 'POST', body: JSON.stringify(payload)});
    if (!result.tx_ref || !result.checkout_link) throw Error('The checkout response was incomplete. Check payment status before paying again.');
    const saved = pendingProviderCheckout(JSON.stringify({...marker, tx_ref: result.tx_ref, checkout_link: result.checkout_link}), provider.id)!;
    await SecureStore.setItemAsync(storageKey, JSON.stringify(saved)); if (alive.current) setPending(saved);
    if (alive.current) await openCheckout(saved);
  })}]);
  const changeRenewal = (next?: ProviderPlan) => Alert.alert(next ? 'Change at the next renewal date?' : 'Stop automatic renewal?', next ? `Your paid access stays unchanged. Existing automatic renewal will stop. ${next.name} is saved for checkout after the current paid period ends; this does not charge you or activate the new tier.` : 'Future automatic payments stop. Access already paid for remains until expiry.', [{text: 'Keep current settings', style: 'cancel'}, {text: 'Confirm', style: next ? 'default' : 'destructive', onPress: () => void run(async () => {
    await providerRequest(token, '/providers/me/subscription-renewal', {method: 'POST', body: JSON.stringify({next_plan_id: next?.id || ''})});
    if (alive.current) {setNotice('Renewal settings updated. Paid access is preserved.'); await refresh(); await onChanged();}
  })}]);
  const cancelUnpaid = () => Alert.alert('Cancel unpaid checkout?', 'Only continue if you have not paid or sent a bank transfer. We will close the old payment link and check its status before you can choose another payment method. If you have paid, use Check payment status instead.', [{text:'Keep checkout',style:'cancel'},{text:'I have not paid',onPress:()=>void run(async()=>{
    const result=await providerRequest(token,'/providers/me/subscription-checkout/cancel',{method:'POST',body:JSON.stringify({tx_ref:pending?.tx_ref || ''})});
    if(result.payment_state==='cancelled' || result.payment_state==='settled') {
      await SecureStore.deleteItemAsync(storageKey);
      if(alive.current){setPending(null);setNotice(result.payment_state==='settled'?'Payment verified. Your paid access has been updated.':'Unpaid checkout cancelled. Choose a plan and your preferred payment method.');await onChanged();}
    } else if(alive.current) setNotice('Another payment is still pending. Check payment status before paying again.');
    if(alive.current) await refresh();
  })}]);
  const button = (label: string, action: () => void, disabled = false, id = label) => <Pressable accessibilityRole="button" disabled={disabled || busy} accessibilityState={{disabled: disabled || busy, busy: busy && activeAction === id}} onPress={() => {setActiveAction(id); action();}} style={({pressed}) => ({padding: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.soft : c.surface, opacity: disabled ? .5 : 1})}><View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>{busy && activeAction === id && <ActivityIndicator accessibilityLabel={`${label} in progress`}/>}<Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></View></Pressable>;
  const paid = hasPaidProviderAccess(provider);
  return <View style={{gap: 12}}>
    {managementOnly && <Text style={{fontWeight: '700'}}>Manage your existing direct subscription</Text>}
    <Text>{paid ? `Paid access ends ${new Date(provider.subscription!.current_period_end!).toLocaleString()}.` : 'No current paid period. Existing conversations remain available.'}</Text>
    <Text>{renewal?.renewal_status === 'uncertain' ? 'Cancellation is not confirmed. Automatic billing may still be active.' : renewal?.renewal_status === 'stopped' ? 'Automatic renewal stopped.' : provider.subscription?.billing_mode === 'one_time' ? 'Prepaid access does not renew automatically.' : 'Monthly card renewals continue until cancelled.'}</Text>
    {!!renewal?.next_plan_name && <Text>Next-period choice: {renewal.next_plan_name}{renewal.change_at ? `, after ${new Date(renewal.change_at).toLocaleString()}` : ''}. Complete its checkout after your current paid period ends.</Text>}
    {busy && <ActivityIndicator/>}{!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
    <ProviderTierUsage usage={usage}/><Text style={{fontWeight:'700'}}>Compare all plans</Text><Text>{tierExplanation}</Text>
    {button('Refresh billing status', () => void run(refresh))}
    {checkoutEnabled && renewal?.can_manage && pending && !paid && button('Cancel unpaid checkout',cancelUnpaid)}
    {renewal?.can_manage && <>{button('Check payment status', () => void run(() => confirm(pending)))}{pending && button('Reopen saved checkout', () => void run(() => openCheckout(pending)), !checkoutEnabled || !pending.checkout_link)}{(paid || managementOnly && provider.subscription?.billing_mode === 'recurring' && renewal.renewal_status !== 'stopped') && button(renewal.renewal_status === 'uncertain' ? 'Retry cancellation' : 'Stop automatic renewal', () => changeRenewal())}</>}
    {checkoutEnabled && !paid && <><Text>Payment method</Text>{button(`${method === 'card' ? 'Selected: ' : ''}Card`, () => {setMethod('card'); if (![1, 12].includes(months)) setMonths(1);})}{button(`${method === 'banktransfer' ? 'Selected: ' : ''}One-off bank transfer`, () => setMethod('banktransfer'))}<Text>Paid period</Text><View style={{gap: 6}}>{(method === 'card' ? [1, 12] : [1, 3, 6, 12]).map(value => <View key={value}>{button(`${months === value ? 'Selected: ' : ''}${value} month(s)${value === 12 ? ' · yearly, 10% off' : ''}`, () => setMonths(value))}</View>)}</View></>}
    {!managementOnly && plans.map(plan => <View key={plan.id} style={{padding: 14, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.line}}><Text style={{fontSize: 18, fontWeight: '700'}}>{plan.name}</Text><Text>{money(plan.amount_ngn)} / month</Text>{!!plan.description && <Text>{plan.description}</Text>}<ProviderTierDetails plan={plan}/>{paid && plan.id === renewal?.current_plan_id && <Text>Current plan</Text>}{plan.period_prices?.filter(price => price.duration_months === 12).map(price => <Text key={price.duration_months}>{money(price.amount_ngn)} / year, prepaid</Text>)}{checkoutEnabled && months === 1 && method === 'card' && plan.card_available === false && <Text>Monthly card renewal is unavailable. Choose prepaid transfer or yearly card.</Text>}{renewal?.can_manage && (paid ? plan.id !== renewal.current_plan_id && button('Choose for next period', () => changeRenewal(plan), !!pending, plan.id) : checkoutEnabled && button(providerPeriodPrice(plan, months) === undefined ? 'Price unavailable ? refresh billing' : `Continue: ${money(providerPeriodPrice(plan, months)!)}`, () => start(plan), !loaded || !!pending || renewal.renewal_status === 'uncertain' || providerPeriodPrice(plan, months) === undefined || months === 1 && method === 'card' && plan.card_available === false, plan.id))}</View>)}
    {!managementOnly && !checkoutEnabled && <Text>New purchases are unavailable in this distribution. Existing paid access, payment verification and renewal management remain available.</Text>}
  </View>;
}
