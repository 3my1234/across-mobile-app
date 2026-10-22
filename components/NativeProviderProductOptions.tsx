import React from 'react';
import {Pressable, Switch, View} from 'react-native';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ProviderPost} from './providerPublishingPolicy';

export function NativeProviderProductOptions({draft, patch, busy}: {draft: ProviderPost; patch: (key: string, value: unknown) => void; busy: boolean}) {
  const c = useAccountDesign();
  const field = (key: string, label: string) => <View style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={draft[key] == null ? '' : String(draft[key])} keyboardType="decimal-pad" onChangeText={text => patch(key, text.trim() ? Number(text) : null)} style={{padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line}}/></View>;
  const choice = (label: string, checked: boolean, action: () => void) => <Pressable accessibilityRole="radio" accessibilityState={{checked, disabled: busy}} disabled={busy} onPress={action} style={{padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: checked ? c.soft : c.surface}}><Text>{label}</Text></Pressable>;
  return <View style={{gap: 12}}>
    <Text style={{fontSize: 18, fontWeight: '700'}}>Stock and delivery</Text>
    {choice('Stock already at its stated location', draft.fulfillment_mode === 'merchant_local', () => {patch('fulfillment_mode', 'merchant_local'); patch('stock_state', 'locally_available');})}
    {choice('Sourced or imported by me', draft.fulfillment_mode === 'merchant_cross_border', () => {patch('fulfillment_mode', 'merchant_cross_border'); patch('stock_state', 'foreign_stock'); patch('inventory_latitude', null); patch('inventory_longitude', null);})}
    {draft.fulfillment_mode === 'merchant_cross_border' && <>{choice('Available from foreign stock', draft.stock_state === 'foreign_stock', () => patch('stock_state', 'foreign_stock'))}{choice('Imported on demand', draft.stock_state === 'import_on_demand', () => patch('stock_state', 'import_on_demand'))}</>}
    <Text>The stock location and buyer’s delivery country determine the delivery route. You remain responsible for fulfillment.</Text>
    <Text>Product category</Text><Input accessibilityLabel="Product category path" editable={!busy} value={(draft.category_path || []).join(' > ')} onChangeText={value => patch('category_path', value.split('>').map(part => part.trim()))} placeholder="Food > Rice" style={{padding: 12, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/>
    <Text>Delivery methods</Text>{['delivery', 'pickup'].map(method => <View key={method} style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><Text style={{flex: 1}}>{method === 'delivery' ? 'Delivery' : 'Customer pickup'}</Text><Switch disabled={busy} value={(draft.delivery_methods || []).includes(method)} onValueChange={value => patch('delivery_methods', value ? [...(draft.delivery_methods || []).filter((item: string) => item !== method), method] : (draft.delivery_methods || []).filter((item: string) => item !== method))}/></View>)}
    <Text style={{fontSize: 18, fontWeight: '700'}}>Sale pricing</Text>{field('compare_at_price', 'Crossed-out price (optional)')}
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><Text style={{flex: 1}}>Flash sale</Text><Switch disabled={busy} value={Boolean(draft.is_flash_sale)} onValueChange={value => patch('is_flash_sale', value)}/></View>
    {draft.is_flash_sale && field('flash_sale_price', 'Flash sale price')}
  </View>;
}
