import React, {useState} from 'react';
import {Pressable, Switch, View} from 'react-native';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {deliveryAreaPayload, ProviderPost} from './providerPublishingPolicy';

export function NativeProviderDeliveryOffer({draft, patch, busy}: {draft: ProviderPost; patch: (key: string, value: unknown) => void; busy: boolean}) {
  const c = useAccountDesign();
  const [form, setForm] = useState({country: draft.inventory_country_code || 'NG', state: '', city: '', currency: draft.currency_code || 'NGN', fee: '0', itemPrice: '', primary: true, confirmed: false});
  const [error, setError] = useState('');
  const field = (key: 'country' | 'state' | 'city' | 'currency' | 'fee' | 'itemPrice', label: string) => <View style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={form[key]} onChangeText={value => setForm(old => ({...old, [key]: value, confirmed: false}))} keyboardType={['fee', 'itemPrice'].includes(key) ? 'decimal-pad' : 'default'} style={{padding: 12, minHeight: 46, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/></View>;
  const add = () => {try {const area = deliveryAreaPayload(form, draft); patch('delivery_areas', [...(draft.delivery_areas || []), area]); setError(''); setForm(old => ({...old, state: '', city: '', confirmed: false}));} catch (failure) {setError(failure instanceof Error ? failure.message : 'Check the delivery offer.');}};
  return <View style={{gap: 12}}><Text style={{fontWeight: '700'}}>Add delivery offer</Text>{field('country', 'Delivery country (two-letter code)')}{field('state', 'Delivery state (blank means entire country)')}{field('city', 'Delivery city (optional)')}{field('currency', 'Delivery currency (three-letter code)')}{field('fee', 'Delivery fee')}
    <View style={{flexDirection: 'row', gap: 12, alignItems: 'center'}}><Text style={{flex: 1}}>Use the main item price</Text><Switch disabled={busy} value={form.primary} onValueChange={primary => setForm(old => ({...old, primary, confirmed: false}))}/></View>
    {!form.primary && <>{field('itemPrice', 'Item price for this destination')}<View style={{flexDirection: 'row', gap: 12, alignItems: 'center'}}><Text style={{flex: 1}}>I confirm this independent destination price</Text><Switch disabled={busy} value={form.confirmed} onValueChange={confirmed => setForm(old => ({...old, confirmed}))}/></View></>}
    <Text>The delivered price is the item price plus delivery fee. Linked offers follow changes to the main price; independent offers keep their destination price.</Text>
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}<Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled: busy}} onPress={add} style={{padding: 12, minHeight: 46, borderRadius: 12, backgroundColor: c.soft}}><Text style={{fontWeight: '700', color: c.accent}}>Add delivery offer</Text></Pressable>
  </View>;
}
