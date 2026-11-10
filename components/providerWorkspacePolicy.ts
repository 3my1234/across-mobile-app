// Only navigation is carried by a link. Login and provider authorization remain unchanged.
export function providerAppRoute(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'across:' || url.hostname !== 'providers' || url.username || url.password || url.port || !['', '/'].includes(url.pathname)) return null;
    const query = new URLSearchParams();
    const views = ['overview', 'profile', 'verification', 'subscription', 'products', 'listings', 'requests', 'messages', 'support', 'merchant-orders', 'more'];
    const view = url.searchParams.get('view');
    if (view && views.includes(view)) query.set('view', view);
    for (const key of ['conversation', 'shared', 'hall', 'ticket', 'event', 'notification', 'listing', 'request']) {
      const id = url.searchParams.get(key);
      if (id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) query.set(key, id);
    }
    return query.toString();
  } catch { return null; }
}
