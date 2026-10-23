export type ProviderInboxItem = {id: string; source: 'provider' | 'account'; title: string; body: string; created_at: string; is_read: boolean; notification: Record<string, unknown>};
export function providerInboxItems(provider: any, account: any): ProviderInboxItem[] {
  const accountItems = account?.notifications || [];
  const dataFor = (item: any) => {if (typeof item.data !== 'string') return item.data || {}; try {return JSON.parse(item.data);} catch {return {};}};
  const mirrored = new Map<string, any>();
  for (const item of accountItems) {const data = dataFor(item); if (typeof data.provider_event_id === 'string') mirrored.set(data.provider_event_id, item);}
  const events: ProviderInboxItem[] = (provider?.items || []).filter((item: any) => typeof item.id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(item.id)).map((item: any) => {
    const kind = String(item.event_type || ''), metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    const mirror = mirrored.get(item.id);
    const view = kind === 'conversation_message' ? 'messages' : kind === 'request_created' ? 'requests' : kind.startsWith('listing_') ? 'listings' : kind.startsWith('product_') ? 'products' : kind.includes('order') ? 'merchant-orders' : kind.includes('subscription') ? 'subscription' : 'overview';
    return {id: item.id, source: 'provider', title: item.title || kind.replace(/_/g, ' '), body: item.body || item.message || '', created_at: item.created_at, is_read: !!item.read_at && (!mirror || !!mirror.is_read),
      // Avoid treating provider event IDs as ordinary notification IDs. The
      // existing provider route acknowledges its own ledger after navigation.
      notification: {...metadata, id: mirror?.id || '', notification_id: mirror?.id || '', provider_event_id: item.id, provider_view: view, notification_type: kind}};
  });
  const eventIDs = new Set(events.map(item => item.id));
  return [...events, ...accountItems.filter((item: any) => !eventIDs.has(dataFor(item).provider_event_id)).map((item: any) => ({id: item.id, source: 'account' as const, title: item.title || 'Notification', body: item.body || '', created_at: item.created_at, is_read: !!item.is_read, notification: item}))]
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
}
