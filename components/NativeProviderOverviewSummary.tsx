import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';

export function NativeProviderOverviewSummary({token, products, services}: {token: string; products: boolean; services: boolean}) {
  const c = useAccountDesign();
  const [reload, setReload] = useState(0), [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{label: string; value: string}[]>([]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const sources = [...(products ? [{path: 'products', label: 'Products in latest page'}] : []), ...(services ? [{path: 'listings', label: 'Services in latest page'}] : []), {path: 'requests', label: 'Open requests in latest page'}];
    void Promise.all(sources.map(async source => {
      try {
        const data = await providerRequest(token, `/providers/me/${source.path}?limit=25`);
        const rows = Array.isArray(data.items) ? data.items : [];
        const count = source.path === 'requests' ? rows.filter((item: {status: string}) => ['pending', 'accepted'].includes(item.status)).length : rows.length;
        return {label: source.label, value: String(count)};
      } catch {return {label: source.label, value: 'Unavailable'};}
    })).then(rows => {if (active) {setSummary(rows); setLoading(false);}});
    return () => {active = false;};
  }, [token, products, services, reload]);
  return <View style={{gap: 10, padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16}}><Text style={{fontWeight: '700'}}>Business snapshot</Text>{loading && <ActivityIndicator/>}{summary.map(item => <View key={item.label} style={{flexDirection: 'row', gap: 12}}><Text style={{flex: 1}}>{item.label}</Text><Text style={{fontWeight: '700'}}>{item.value}</Text></View>)}<Text>Based on up to 25 recent records per category. Open each tool to search or load more.</Text><Pressable accessibilityRole="button" disabled={loading} onPress={() => setReload(value => value + 1)} style={{padding: 12, backgroundColor: c.soft, borderRadius: 12}}><Text>Refresh snapshot</Text></Pressable></View>;
}
