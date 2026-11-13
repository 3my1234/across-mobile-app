import {API_URL} from './config';

// Only unsigned public ATL media belongs in the shared, persistent image cache.
// Keep the complete URL as identity: replacing/versioning a photo must refresh it.
export function publicImageCachePolicy(uri: string): 'memory-disk' | 'memory' {
  try {
    const url = new URL(uri);
    const api = new URL(API_URL);
    if (url.username || url.password || url.hash) return 'memory';
    const path = decodeURIComponent(url.pathname).toLowerCase();
    if (path.split('/').some(part => ['private', 'verification', 'private-chat'].includes(part))) return 'memory';
    // Unknown query parameters may carry authorization. Do not strip them or
    // persist signed URLs merely because they use a familiar hostname.
    const publicParameters = new Set(['v', 'version', 'format', 'width', 'height', 'w', 'h', 'q', 'quality', 'fit', 'avatar']);
    for (const key of url.searchParams.keys()) if (!publicParameters.has(key.toLowerCase())) return 'memory';
    const apiImage = url.origin === api.origin && url.pathname.startsWith(`${api.pathname.replace(/\/$/, '')}/api/v1/public/images/view/`);
    const cdnImage = url.protocol === 'https:' && url.hostname === 'media.atlxpres.com' && url.port === '';
    return apiImage || cdnImage ? 'memory-disk' : 'memory';
  } catch { return 'memory'; }
}
