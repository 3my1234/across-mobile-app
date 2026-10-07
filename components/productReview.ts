import { API_URL } from './config';
import { fetchJSONWithTimeout } from './utils';

export async function saveProductReview(productId: string, token: string, draft: { rating: number; review_text: string; media_urls: string[] }) {
  const submitted = { ...draft, review_text: draft.review_text.trim() };
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  let definitiveFailure = false;
  try {
    const { response, body } = await fetchJSONWithTimeout(`${API_URL}/api/v1/products/${productId}/reviews`, { method: 'PUT', headers, body: JSON.stringify(submitted) });
    if (!response.ok) {
      definitiveFailure = response.status >= 400 && response.status < 500;
      throw new Error(body.message || 'Could not save your review');
    }
    if (!body.review) throw new Error('Review confirmation unavailable');
    return body;
  } catch (error) {
    if (definitiveFailure) throw error;
    // A lost response does not mean the write failed. Read our own review before
    // displaying an error; never send a second write or claim an unverified XP award.
    try {
      const { response, body } = await fetchJSONWithTimeout(`${API_URL}/api/v1/products/${productId}/reviews/mine?fresh=${Date.now()}`, { headers, cache: 'no-store' });
      const review = body.review;
      if (response.ok && review && review.rating === submitted.rating && review.review_text === submitted.review_text && JSON.stringify(review.media_urls || []) === JSON.stringify(submitted.media_urls)) {
        return { review: { ...review, is_mine: true }, recovered: true };
      }
    } catch {}
    throw new Error('We could not confirm your review. It may have been saved. Reopen your review to check before trying again.');
  }
}
