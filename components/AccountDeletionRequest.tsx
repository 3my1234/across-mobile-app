import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {ThemedText as Text, ThemedTextInput as TextInput} from './ThemeProvider';
import {useAccountDesign} from './AccountDesign';
import {requestAccountDeletion} from './accountDeletionTransport';

export function AccountDeletionRequest({token, onOpenSupport}: {token: string; onOpenSupport: () => void}) {
  const c = useAccountDesign(), [expanded, setExpanded] = useState(false), [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState<'idle'|'sending'|'accepted'|'uncertain'>('idle');
  const alive = useRef(true), flight = useRef(false);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  const send = async () => {
    if (flight.current || state !== 'idle' || confirmation.trim() !== 'DELETE') return;
    flight.current = true; setState('sending');
    try {await requestAccountDeletion(token, confirmation); if (alive.current) setState('accepted');}
    catch {if (alive.current) setState('uncertain');}
    finally {flight.current = false;}
  };
  return <View style={{gap: 10, padding: 16, borderWidth: 1, borderColor: c.line, borderRadius: 16, marginBottom: 12}}>
    <Text style={{fontWeight: '700'}}>Delete account and personal data</Text>
    <Text>This applies to your customer account and linked provider business. It is different from clearing chat history on this phone.</Text>
    {!expanded && <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={{paddingVertical: 12}}><Text style={{color: c.danger}}>Request account deletion</Text></Pressable>}
    {expanded && <>
      <Text>We will receive your request in Support and reply there. Submitting does not immediately delete your account or cancel outstanding transactions. We will explain any information that must be retained.</Text>
      {state === 'idle' && <><Text>Type DELETE to confirm</Text><TextInput accessibilityLabel="Type DELETE to confirm account deletion request" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} maxLength={12} style={{borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12}}/>
        <Pressable accessibilityRole="button" disabled={confirmation.trim() !== 'DELETE'} onPress={() => void send()} style={{padding: 12, opacity: confirmation.trim() === 'DELETE' ? 1 : .5}}><Text style={{color: c.danger, fontWeight: '700'}}>Send deletion request</Text></Pressable></>}
      {state === 'sending' && <ActivityIndicator accessibilityLabel="Sending account deletion request"/>}
      {state === 'accepted' && <Text accessibilityLiveRegion="polite">Request received. Open Support to follow your request and receive confirmation.</Text>}
      {state === 'uncertain' && <Text accessibilityRole="alert" style={{color: c.danger}}>We could not confirm whether your request arrived. Check Support before sending another request.</Text>}
      {state !== 'sending' && <Pressable accessibilityRole="button" onPress={onOpenSupport} style={{padding: 12}}><Text style={{color: c.accent}}>Open Support</Text></Pressable>}
    </>}
  </View>;
}
