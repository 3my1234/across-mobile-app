import {ProviderPanel} from './ProviderPanel';
import {ProviderPostImages} from './ProviderPostImages';
import React, {useRef, useState, useEffect} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {KeyboardFrame} from './KeyboardFrame';
import {providerRequest} from './nativeProviderApi';
import {availabilityPayload, AvailabilityDraft} from './providerBookingPolicy';

export function NativeProviderAvailability({embedded = false, token, service, onClose}: {embedded?: boolean; token: string; service: {id: string; title: string; media_urls?: string[]}; onClose: () => void}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets;
  const [form, setForm] = useState<AvailabilityDraft>({startDate: '', startTime: '', endDate: '', endTime: '', capacity: '1'});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(true), flight = useRef(false);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  const save = () => {
    if (flight.current) return;
    let payload: ReturnType<typeof availabilityPayload>;
    try {payload = availabilityPayload(form);} catch (failure) {setError(failure instanceof Error ? failure.message : 'Check the dates and capacity.'); return;}
    Alert.alert('Confirm availability', `${new Date(payload.starts_at).toLocaleString()} to ${new Date(payload.ends_at).toLocaleString()} · Capacity ${payload.capacity}`, [{text: 'Cancel', style: 'cancel'}, {text: 'Save', onPress: () => {void (async () => {
      if (flight.current || !alive.current) return; flight.current = true; setBusy(true); setError(''); setNotice('');
      try {await providerRequest(token, `/providers/me/listings/${service.id}/availability`, {method: 'POST', body: JSON.stringify(payload)}); if (alive.current) setNotice('Availability saved. Existing bookings remain reserved.');}
      catch (failure) {if (alive.current) setError(`${failure instanceof Error ? failure.message : 'Could not confirm availability.'} Check the result before submitting again.`);}
      finally {flight.current = false; if (alive.current) setBusy(false);}
    })();}}]);
  };
  const field = (key: keyof AvailabilityDraft, label: string, placeholder: string) => <View style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={form[key]} onChangeText={value => setForm(old => ({...old, [key]: value}))} placeholder={placeholder} keyboardType={key === 'capacity' ? 'number-pad' : 'numbers-and-punctuation'} style={{padding: 12, minHeight: 46, borderWidth: 1, borderColor: c.line, borderRadius: 12}}/></View>;
  return <ProviderPanel embedded={embedded} onClose={onClose}><KeyboardFrame bottomInset={insets.bottom} style={{flex: 1, paddingTop: insets.top, backgroundColor: c.background}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, gap: 12}}>
    <Pressable accessibilityRole="button" onPress={onClose} style={{padding: 12}}><Text style={{color: c.accent}}>Back to services</Text></Pressable>
    <Text style={{fontSize: 20, fontWeight: '700'}}>Add availability</Text><Text>{service.title}</Text><ProviderPostImages title={service.title} urls={service.media_urls}/><Text>Dates and times use your phone’s time zone. You will review the exact time before saving.</Text>
    {field('startDate', 'Start date', 'YYYY-MM-DD')}{field('startTime', 'Start time', 'HH:MM')}{field('endDate', 'End date', 'YYYY-MM-DD')}{field('endTime', 'End time', 'HH:MM')}{field('capacity', 'Customers for this time slot', '1')}
    <Text>Capacity is the number of people, guests or vehicles you can accept. Saving the same time slot updates capacity while retaining existing reservations.</Text>
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}{busy && <ActivityIndicator/>}
    <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled: busy}} onPress={save} style={{padding: 14, minHeight: 46, borderRadius: 12, backgroundColor: c.soft}}><Text style={{color: c.accent, fontWeight: '700'}}>Review and save availability</Text></Pressable>
  </ScrollView></KeyboardFrame></ProviderPanel>;
}
