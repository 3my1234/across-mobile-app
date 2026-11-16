import {NotificationPopover} from './NotificationPopover';
import {ProviderPanel} from './ProviderPanel';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAccountDesign} from './AccountDesign';
import {providerRequest} from './nativeProviderApi';
import {providerInboxItems, ProviderInboxItem} from './providerInboxPolicy';

export function NativeProviderNotifications({embedded = false, token, hasProvider, onClose, onOpen, popover = false, top = 0, onReadAll}: {popover?: boolean; top?: number; onReadAll?: () => void; embedded?: boolean; token: string; hasProvider: boolean; onClose: () => void; onOpen: (notification: Record<string, unknown>) => void}) {
  const c = useAccountDesign(), safeInsets = useSafeAreaInsets(), insets = embedded ? {top: 0, bottom: 0} : safeInsets;
  const [items, setItems] = useState<ProviderInboxItem[]>([]), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const readAllCallback=useRef(onReadAll);readAllCallback.current=onReadAll;
  const epoch = useRef(0), alive = useRef(true), reading = useRef(false), writing = useRef(false);
  const load = useCallback(async () => {
    if (reading.current || !alive.current) return; reading.current = true;
    const version = ++epoch.current; setLoading(true); setError('');
    try {
      const [provider, account] = await Promise.all([hasProvider ? providerRequest(token, '/providers/me/notifications?limit=50') : Promise.resolve({items: []}), providerRequest(token, '/notifications')]);
      if (alive.current && version === epoch.current) setItems(providerInboxItems(provider, account));
    } catch (failure) {if (alive.current && version === epoch.current) setError(failure instanceof Error ? failure.message : 'Notifications could not load. Retry.');}
    finally {reading.current = false; if (alive.current && version === epoch.current) setLoading(false);}
  }, [token, hasProvider]);
  const invalidate = useCallback(() => {alive.current = false; epoch.current++;}, []);
  useEffect(() => {alive.current = true; void load(); const listener = AppState.addEventListener('change', state => {if (state === 'active' && !writing.current) void load();}); return () => {invalidate(); listener.remove();};}, [load, invalidate]);
  const markAll = async () => {
    if (writing.current || reading.current || !alive.current) return; writing.current = true; setBusy(true); setError('');
    try {
      await Promise.all([hasProvider ? providerRequest(token, '/providers/me/notifications/read-all', {method: 'PATCH'}) : Promise.resolve(), providerRequest(token, '/notifications/read-all', {method: 'PATCH'})]);
      if (alive.current) {await load();readAllCallback.current?.();}
    } catch {if (alive.current) setError('Read status could not be fully confirmed. Some items may have updated; refresh before retrying.');}
    finally {writing.current = false; if (alive.current) setBusy(false);}
  };
  const unread=items.filter(item=>!item.is_read).length;
  const panel=<NotificationPopover floating={popover} top={top} items={items.map(item=>({key:`${item.source}:${item.id}`,title:item.title,body:item.body,created_at:item.created_at,is_read:item.is_read,notification:item.notification}))} unreadCount={unread} unreadLabel={`${unread} unread in this list`} loading={loading} busy={busy} error={error} onClose={onClose} onRefresh={()=>void load()} onMarkAll={()=>void markAll()} onOpen={onOpen}/>;
  if(popover)return panel;
  return <ProviderPanel embedded={embedded} onClose={onClose}><View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom,backgroundColor:c.background}}>{panel}</View></ProviderPanel>;
}
