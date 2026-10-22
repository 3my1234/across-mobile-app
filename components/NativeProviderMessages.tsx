import React, {useEffect, useState} from 'react';
import {Modal, Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CommunityScreen} from './CommunityScreen';
import {useAccountDesign} from './AccountDesign';
import {ThemedText as Text} from './ThemeProvider';
import {providerMessageDestination, providerRouteContext} from './nativeProviderPolicy';
import {acknowledgeProviderRoute} from './nativeProviderApi';

export function NativeProviderMessages({token, route, onClose}: {token: string; route: string; onClose: () => void}) {
  const c = useAccountDesign(), insets = useSafeAreaInsets(), destination = providerMessageDestination(route);
  const [ackError, setAckError] = useState(false);
  const context = providerRouteContext(route);
  useEffect(() => {
    let mounted = true;
    setAckError(false);
    if (context.event || context.notification) void acknowledgeProviderRoute(token, context.event, context.notification).catch(() => {if (mounted) setAckError(true);});
    return () => {mounted = false;};
  }, [token, context.event, context.notification]);
  return <Modal animationType="slide" onRequestClose={onClose}><View style={{flex: 1, paddingTop: insets.top, backgroundColor: c.background}}><View style={{padding: 12, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: c.surface}}><Pressable accessibilityRole="button" onPress={onClose} style={{padding: 8}}><Text style={{color: c.accent}}>Back to provider</Text></Pressable><Text style={{fontSize: 17, fontWeight: '700'}}>Chats and Town Hall</Text></View>{ackError && <Text style={{padding: 10}}>Messages are available. The notification read status could not update yet.</Text>}<CommunityScreen key={`${token}:${route}`} token={token} bottomInset={insets.bottom} initialMode={destination.mode} initialConversationId={destination.conversation} initialHallRoomId={destination.hall} providerWorkspace/></View></Modal>;
}
