import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {ThemedText as Text} from './ThemeProvider';
import {useAccountDesign, accountDesign} from './AccountDesign';
import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';

const states: Record<string, string> = {
  pending: 'Queued: waiting for the notification worker.',
  sending: 'Sending: the worker is contacting the push gateway.',
  retry: 'Retry scheduled: the server will try again. Do not send another test yet.',
  sent: 'Push gateway accepted the test. Waiting for the phone push-service receipt.',
  delivered: 'Phone push service accepted the test. This does not confirm display or sound.',
  failed: 'Delivery failed. Reconnect notifications, then retry. Contact Support if it continues.',
  disabled: 'This phone registration is disabled. Reconnect notifications before another test.',
};
export function NativeNotificationDiagnostics({token, notificationId, received}: {token: string; notificationId: string; received: boolean}) {
  const c = useAccountDesign();
  const [status, setStatus] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [updated, setUpdated] = useState('');
  const epoch = useRef(0), flight = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    if (flight.current !== null) return;
    const version = epoch.current; flight.current = version; setBusy(true); setError('');
    try {
      const {response, body} = await fetchJSONWithTimeout(`${API_URL}/api/v1/notifications/test-push/${encodeURIComponent(notificationId)}`, {cache: 'no-store', headers: {Authorization: `Bearer ${token}`}}, 10000);
      if (version !== epoch.current) return;
      if (!response.ok) throw Error(response.status === 404 ? 'Detailed delivery tracking is not available for this test on this server. Queuing alone does not confirm delivery.' : 'Delivery status could not load. Retry when connected.');
      if (!states[body?.status]) throw Error('The server returned an unknown delivery state. Refresh or contact Support.');
      setStatus(states[body.status]);
      const date = new Date(body.updated_at);
      setUpdated(Number.isFinite(date.getTime()) ? date.toLocaleTimeString() : '');
    } catch (failure) {if (version === epoch.current) setError(failure instanceof Error ? failure.message : 'Delivery status could not load. Retry.');}
    finally {if (flight.current === version) flight.current = null; if (version === epoch.current) setBusy(false);}
  }, [token, notificationId]);
  const invalidate = useCallback(() => {epoch.current++; flight.current = null;}, []);
  useEffect(() => {invalidate(); setStatus(''); setError(''); setUpdated(''); void refresh(); return invalidate;}, [refresh, invalidate]);
  return <View style={{gap: 8}}>
    {!!status && <Text accessibilityRole="alert">{status}</Text>}{!!updated && <Text>Last server update: {updated}</Text>}
    {received && <Text>This app received the test on this phone.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{color: c.danger}}>{error}</Text>}
    {busy && <ActivityIndicator/>}<Pressable accessibilityRole="button" disabled={busy} onPress={() => void refresh()} style={[accountDesign.action, {backgroundColor: c.soft, borderColor: c.line}]}><Text>{busy ? 'Checking delivery…' : 'Refresh test delivery'}</Text></Pressable>
    <Text style={{color: c.muted}}>Receipts may take several minutes. To check background delivery, leave the app and wait for the notification. Sound also depends on phone notification volume, channel settings and Do Not Disturb.</Text>
  </View>;
}
