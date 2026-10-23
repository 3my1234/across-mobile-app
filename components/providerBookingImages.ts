import {providerRequest} from './nativeProviderApi';

// The current booking API returns listing IDs but no media. Reuse the existing
// private service read, deduplicate this page and cap concurrent reads at three.
export async function loadBookingImages(token: string, bookings: {listing_id?: string}[], current: () => boolean, onResult: (id: string, urls: string[] | null) => void) {
  const ids = Array.from(new Set(bookings.map(item => item.listing_id).filter((id): id is string => !!id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))).slice(0, 25);
  let index = 0;
  await Promise.all(Array.from({length: Math.min(3, ids.length)}, async () => {
    while (current() && index < ids.length) {
      const id = ids[index++];
      try {
        const listing = await providerRequest(token, `/providers/me/listings/${id}`);
        if (!listing || listing.id !== id || !Array.isArray(listing.media_urls)) throw Error('Invalid service image response');
        if (current()) onResult(id, listing.media_urls.filter((url: unknown): url is string => typeof url === 'string' && !!url.trim()));
      } catch {if (current()) onResult(id, null);}
    }
  }));
}
