import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, Switch, View} from 'react-native';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {ProviderApplication, providerApplicationPayload, providerTypes} from './providerOnboardingPolicy';

export function NativeProviderOnboarding({token, onSaved, onRefresh}: {token: string; onSaved: () => Promise<void>; onRefresh: () => void}) {
  const c = useAccountDesign();
  const [form, setForm] = useState<ProviderApplication>({business_name: '', provider_type: '', provider_type_other: '', description: '', contact_email: '', contact_phone: '', website_url: '', address_line: '', city: '', state: '', country_code: 'NG', is_driver: false});
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const flight = useRef(false), mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const input = (key: Exclude<keyof ProviderApplication, 'is_driver' | 'provider_type'>, label: string, multiline = false) => <View key={key} style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={form[key]} onChangeText={value => setForm(old => ({...old, [key]: value}))} multiline={multiline} autoCapitalize={key === 'contact_email' || key === 'website_url' ? 'none' : 'sentences'} keyboardType={key === 'contact_email' ? 'email-address' : key === 'contact_phone' ? 'phone-pad' : 'default'} style={{borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, minHeight: multiline ? 85 : 46}}/></View>;
  const submit = async () => {
    if (flight.current) return; flight.current = true; setBusy(true); setError('');
    try {const payload = providerApplicationPayload(form); await providerRequest(token, '/providers/onboarding', {method: 'POST', body: JSON.stringify(payload)}); if (mounted.current) await onSaved();}
    catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not submit your provider profile.');}
    finally {flight.current = false; if (mounted.current) setBusy(false);}
  };
  return <View style={{gap: 12}}><Text>Create a provider profile using your current account. Your customer access and conversations remain associated with the same identity.</Text><Text>If you already have a provider profile and cannot see it, refresh account access before submitting another application.</Text>
    {input('business_name', 'Business name')}<Text>What do you provide?</Text>{providerTypes.map(([value, label]) => <Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{checked: form.provider_type === value}} onPress={() => setForm(old => ({...old, provider_type: value}))} style={{borderWidth: 1, borderColor: c.line, backgroundColor: form.provider_type === value ? c.soft : c.surface, padding: 12, borderRadius: 12, minHeight: 46}}><Text>{label}</Text></Pressable>)}{form.provider_type === 'other' && input('provider_type_other', 'Describe what you provide')}{input('description', 'About your business', true)}{input('contact_email', 'Business contact email')}{input('contact_phone', 'Business contact phone')}{input('country_code', 'Country code (NG for Nigeria)')}{input('city', 'City')}{input('state', 'State / region')}{input('address_line', 'Business address')}{input('website_url', 'Website (optional HTTPS link)')}
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><Text style={{flex: 1}}>I provide driving services</Text><Switch disabled={busy} value={form.is_driver} onValueChange={value => setForm(old => ({...old, is_driver: value}))}/></View>{form.is_driver && <Text>After submission, upload separate clear photos of your driver licence, your car and the plate number. All three must be reviewed before driving services go live.</Text>}<Text>Creating this profile does not publish listings. Business verification and listing review apply.</Text>
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error} If your connection was interrupted, refresh account access before submitting again.</Text>}{busy && <ActivityIndicator accessibilityLabel="Submitting provider application"/>}<Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={{backgroundColor: c.soft, borderRadius: 12, padding: 14, opacity: busy ? .5 : 1}}><Text style={{color: c.accent, fontWeight: '700'}}>Submit provider profile</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onRefresh} style={{padding: 12}}><Text>Refresh account access</Text></Pressable>
  </View>;
}
