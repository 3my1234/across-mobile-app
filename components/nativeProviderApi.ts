import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';
export class ProviderRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function providerRequest(token: string, path: string, options: RequestInit = {}) {
  if (!path.startsWith('/providers/') && path !== '/marketplace/subscription-plans') throw new Error('Unsupported provider operation');
  try {
    const {response, body} = await fetchJSONWithTimeout(`${API_URL}/api/v1${path}`, {
      ...options, cache: 'no-store', headers: {...options.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    }, path.endsWith('/videos/complete') ? 90000 : options.method === 'POST' && path.endsWith('subscription-renewal') ? 45000 : 15000);
    if (!response.ok) throw new ProviderRequestError(response.status,
      typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : 'This operation could not complete. Please retry.');
    return body;
  } catch (error) {
    if (error instanceof ProviderRequestError) throw error;
    throw new Error('Could not connect. Check your connection and try again. Your account has not been removed.');
  }
}
// Signed storage requests deliberately carry no application credentials.
export async function putProviderPhoto(uploadURL: string, uri: string, mime: string, maximumBytes = 10 * 1024 * 1024) {
  const url = new URL(uploadURL);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('The upload link is invalid. Please retry.');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
  try {
    const source = await fetch(uri, {signal: controller.signal});
    const blob = await source.blob();
    if (typeof blob.size === 'number' && (blob.size <= 0 || blob.size > maximumBytes)) throw new Error('The selected file exceeds the upload limit.');
    const response = await fetch(uploadURL, {method: 'PUT', headers: {'Content-Type': mime}, body: blob, signal: controller.signal, credentials: 'omit'});
    if (!response.ok) throw new Error('Storage could not accept this photo. Please retry or contact Support.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The file upload timed out. Check your connection and retry.');
    throw error;
  } finally { clearTimeout(timer); }
}
