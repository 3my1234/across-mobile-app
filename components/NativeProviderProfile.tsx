import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {ThemedText as Text, ThemedTextInput as Input} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {ProviderAccount, verificationImageError} from './nativeProviderPolicy';
import {providerRequest, putProviderPhoto} from './nativeProviderApi';
import {ResilientImage} from './ResilientImage';
import {profileFields as fields, providerProfilePayload} from './providerProfilePolicy';

export function NativeProviderProfile({token, provider, onSaved}: {token: string; provider: ProviderAccount; onSaved: () => Promise<void>}) {
  const c = useAccountDesign(), [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(([key]) => [key, String(provider[key] || '')])));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const mounted = useRef(true), flight = useRef(false);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const run = async (action: () => Promise<void>) => {
    if (flight.current) return; flight.current = true; setBusy(true); setError(''); setNotice('');
    try {await action();} catch (failure) {if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not update the profile.');}
    finally {flight.current = false; if (mounted.current) setBusy(false);}
  };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{borderRadius: 12, padding: 12, minHeight: 44, backgroundColor: c.soft, opacity: busy ? .5 : 1}}><Text style={{color: c.accent, fontWeight: '700'}}>{label}</Text></Pressable>;
  const media = (banner: boolean) => void run(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) throw new Error('Allow photo access in phone settings to choose your business images.');
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes: ['images'], quality: .8, allowsEditing: true, aspect: banner ? [16, 6] : [1, 1]}); if (result.canceled) return;
    const asset = result.assets[0], mime = asset.mimeType || '';
    const validation = verificationImageError(mime, asset.fileSize || 0); if (validation) throw new Error(validation);
    if ((asset.fileSize || 0) > 5 * 1024 * 1024) throw new Error('Choose a profile or banner image no larger than 5 MB.');
    const signed = await providerRequest(token, '/providers/me/uploads/presign', {method: 'POST', body: JSON.stringify({filename: asset.fileName || 'profile.jpg', mime_type: mime, purpose: banner ? 'banner' : 'logo'})});
    await putProviderPhoto(signed.upload_url, asset.uri, mime, 5 * 1024 * 1024);
    await providerRequest(token, '/providers/me/media', {method: 'PUT', body: JSON.stringify({[banner ? 'banner_url' : 'photo_url']: signed.view_url})});
    if (mounted.current) {setNotice('Business image updated.'); await onSaved();}
  });
  const remove = (banner: boolean) => Alert.alert('Remove business image?', 'You can upload a replacement whenever you are ready.', [{text: 'Keep image', style: 'cancel'}, {text: 'Remove', style: 'destructive', onPress: () => void run(async () => {await providerRequest(token, '/providers/me/media', {method: 'PUT', body: JSON.stringify({[banner ? 'banner_url' : 'photo_url']: ''})}); if (mounted.current) {setNotice('Business image removed.'); await onSaved();}})}]);
  const save = () => void run(async () => {
    providerProfilePayload(form, {});
    // Fetch current branding immediately before full PATCH, so saving text after a
    // photo change cannot revert the avatar with an older form snapshot.
    const current = await providerRequest(token, '/providers/me');
    await providerRequest(token, '/providers/me', {method: 'PATCH', body: JSON.stringify(providerProfilePayload(form, current))});
    if (mounted.current) {setNotice('Business profile saved.'); await onSaved();}
  });
  return <View style={{gap: 12}}><View style={{height: 125, backgroundColor: c.soft, borderRadius: 16}}>{provider.provider_identity?.banner_url && <ResilientImage uri={provider.provider_identity.banner_url} style={{width: '100%', height: 125, borderRadius: 16}}/>}<View style={{position: 'absolute', bottom: -28, left: 14, width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: c.surface, overflow: 'hidden', backgroundColor: c.soft}}>{provider.provider_identity?.avatar_url && <ResilientImage uri={provider.provider_identity.avatar_url} style={{width: '100%', height: '100%'}}/>}</View></View><View style={{height: 20}}/>{button('Change profile photo', () => media(false))}{button('Change banner', () => media(true))}{!!provider.provider_identity?.avatar_url && button('Remove profile photo', () => remove(false))}{!!provider.provider_identity?.banner_url && button('Remove banner', () => remove(true))}
    {fields.map(([key, label]) => <View key={key} style={{gap: 6}}><Text>{label}</Text><Input accessibilityLabel={label} editable={!busy} value={form[key]} onChangeText={value => setForm(old => ({...old, [key]: value}))} multiline={key === 'description'} keyboardType={key === 'contact_email' ? 'email-address' : key === 'contact_phone' ? 'phone-pad' : 'default'} autoCapitalize={key === 'contact_email' || key === 'website_url' ? 'none' : 'sentences'} style={{borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, minHeight: key === 'description' ? 90 : 46}}/></View>)}
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error} Refresh after an interrupted request before retrying.</Text>}{!!notice && <Text accessibilityRole="alert">{notice}</Text>}{busy && <ActivityIndicator/>}{button('Save business profile', save)}<Text>Verification, provider category and subscription permissions are controlled by the server.</Text>
  </View>;
}
