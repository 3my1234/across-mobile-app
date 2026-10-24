import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign, accountDesign} from './AccountDesign';
import {providerRequest, ProviderRequestError} from './nativeProviderApi';
import {hasPendingProviderSignup, signupWorkspaceFor} from './workspaceIntent';

export type WorkspaceIntent = 'auto' | 'customer' | 'provider';

// Entry preference is navigation only. The existing API authorizes every tool.
export function ProviderEntryGate({token, intent, onResolved}: {token: string; intent: WorkspaceIntent; onResolved: (provider: boolean) => void}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets();
  const [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const callback = useRef(onResolved); callback.current = onResolved;
  const epoch = useRef(0), flight = useRef<number | null>(null), finished = useRef(false);
  const resolve = useCallback((provider: boolean) => {if (finished.current) return; finished.current = true; epoch.current++; callback.current(provider);}, []);
  const load = useCallback(async () => {
    if (flight.current !== null || finished.current) return;
    if (intent !== 'auto') {resolve(intent === 'provider'); return;}
    const version = ++epoch.current; flight.current = version; setBusy(true); setError('');
    try {
      const account = await providerRequest(token, '/providers/me');
      if (epoch.current !== version) return;
      if (!account || typeof account.id !== 'string' || !account.id) throw Error('Invalid provider account response');
      // Applicants and restricted/expired providers retain their workspace. The
      // server controls document/publishing/subscription permissions separately.
      resolve(true);
    } catch (failure) {
      if (epoch.current !== version) return;
      if (failure instanceof ProviderRequestError && failure.status === 404) {
        try {
          let pendingProvider = false;
          if (await hasPendingProviderSignup()) {
            const profile = await providerRequest(token, '/profile');
            if (!profile || typeof profile.email !== 'string' || !profile.email) throw Error('Invalid account response');
            pendingProvider = await signupWorkspaceFor(profile.email) === 'provider';
          }
          if (epoch.current === version) resolve(pendingProvider);
        } catch {if (epoch.current === version) setError('We could not restore your provider application. Retry or open provider tools directly.');}
      }
      else setError('We could not check your provider access. Retry, open provider tools directly, or continue as a customer.');
    } finally {if (flight.current === version) flight.current = null; if (epoch.current === version) setBusy(false);}
  }, [token, intent, resolve]);
  const invalidate = useCallback(() => {epoch.current++; flight.current = null;}, []);
  useEffect(() => {finished.current = false; void load(); return invalidate;}, [load, invalidate]);
  const action = (label: string, fn: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={fn} style={[accountDesign.action, {borderColor: c.line, backgroundColor: c.soft}]}><Text style={{color: c.accent}}>{label}</Text></Pressable>;
  return <View style={{flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 20, justifyContent: 'center', gap: 16, backgroundColor: c.background}}>
    <Text style={{fontSize: 23, fontWeight: '700'}}>Opening your workspace</Text>
    {busy && <ActivityIndicator accessibilityLabel="Checking provider access"/>}
    {!!error && <><Text accessibilityRole="alert">{error}</Text>{action('Retry account access', () => void load())}{action('Open provider workspace', () => resolve(true))}{action('Continue as customer', () => resolve(false))}</>}
  </View>;
}
