import React from 'react';
import {ActivityIndicator, Keyboard, Pressable, ScrollView, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ThemedText as Text, useTheme} from './ThemeProvider';

export type NotificationDisplayItem = {key: string; title: string; body: string; created_at: string; is_read: boolean; notification: Record<string, unknown>};
export function NotificationBell({count, onPress, label = 'Notifications', expanded = false}: {count: number; onPress: () => void; label?: string; expanded?: boolean}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={count > 0 ? `${count} unread notifications` : 'No unread notifications'} accessibilityState={{expanded}} onPress={()=>{Keyboard?.dismiss?.();onPress();}} style={{padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center'}}>
    <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={24} color={theme.color('#191919')}/>
    {count > 0 && <View pointerEvents="none" style={{position: 'absolute', top: 2, right: 2, backgroundColor: '#FF4747', borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: '#FFF', fontSize: 10, fontWeight: '900'}}>{count > 99 ? '99+' : count}</Text></View>}
  </Pressable>;
}

export function NotificationPopover({items, unreadCount, top = 0, floating = true, loading = false, busy = false, error = '', unreadLabel, onClose, onRefresh, onMarkAll, onOpen}: {items: NotificationDisplayItem[]; unreadCount: number; top?: number; floating?: boolean; loading?: boolean; busy?: boolean; error?: string; unreadLabel?: string; onClose: () => void; onRefresh: () => void; onMarkAll: () => void; onOpen: (notification: Record<string, unknown>) => void}) {
  const theme = useTheme(), screen = useWindowDimensions();
  const border = theme.color('#EDEDED', 'borderColor'), height = Math.max(160, Math.min(400, screen.height - top - 24));
  return <View accessibilityViewIsModal style={{...(floating ? {position: 'absolute' as const, top, right: 8, left: 8, zIndex: 200} : {margin: 8}), backgroundColor: theme.color('#FFFFFF', 'backgroundColor'), borderRadius: 12, maxHeight: height, borderWidth: 1, borderColor: border, shadowOffset: {width: 0, height: 4}, shadowOpacity: .15, shadowRadius: 12, elevation: 10, overflow: 'hidden'}}>
    <View style={{paddingHorizontal: 12, borderBottomWidth: 1, borderColor: border}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}><Text accessibilityRole="header" style={{flex: 1, fontSize: 16, fontWeight: '800'}}>Notifications</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh notifications" disabled={loading || busy} onPress={onRefresh} style={{padding: 10, minWidth: 44, minHeight: 44}}><Ionicons name="refresh-outline" size={20} color={theme.color('#8C8C8C')}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose} style={{padding: 10, minWidth: 44, minHeight: 44}}><Ionicons name="close" size={20} color={theme.color('#8C8C8C')}/></Pressable></View>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8}}><Text accessibilityLiveRegion="polite" style={{fontSize: 11, color: theme.color('#8C8C8C'), flex: 1}}>{unreadLabel || `${unreadCount} unread`}</Text><Pressable accessibilityRole="button" accessibilityLabel="Mark all as read" disabled={loading || busy || unreadCount === 0} onPress={onMarkAll} style={{minHeight: 36, justifyContent: 'center', opacity: loading || busy || unreadCount === 0 ? .5 : 1}}><Text style={{fontSize: 12, fontWeight: '700', color: '#FF4747'}}>Mark all read</Text></Pressable></View>
      {(loading || busy) && <ActivityIndicator accessibilityLabel={busy ? 'Updating notification read status' : 'Loading notifications'} style={{marginBottom: 8}}/>}
      {!!error && <Text accessibilityRole="alert" style={{fontSize: 12, color: theme.color('#B42332'), paddingBottom: 8}}>{error}</Text>}
    </View>
    <ScrollView style={{maxHeight: Math.max(80, height - 100)}} keyboardShouldPersistTaps="handled">{items.length === 0 ? !loading && !error && <Text style={{padding: 20, textAlign: 'center', color: theme.color('#8C8C8C')}}>No notifications yet</Text> : items.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${item.title}${item.is_read ? '' : ', unread'}`} onPress={() => onOpen(item.notification)} style={{padding: 12, borderBottomWidth: 1, borderColor: theme.color('#F0F0F0', 'borderColor'), backgroundColor: theme.color(item.is_read ? '#FFFFFF' : '#FFF5F5', 'backgroundColor')}}><Text style={{fontWeight: '800', fontSize: 13}}>{item.title}</Text><Text style={{marginTop: 2, fontSize: 12, color: theme.color('#595959')}}>{item.body}</Text><Text style={{marginTop: 2, fontSize: 10, color: theme.color('#BFBFBF')}}>{new Date(item.created_at).toLocaleString()}</Text></Pressable>)}</ScrollView>
  </View>;
}
