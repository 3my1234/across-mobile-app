import {API_URL} from './config';
import {fetchJSONWithTimeout} from './utils';

// Reuse the authenticated, durable Support workflow. This never invokes the
// administrator's destructive delete endpoint or accepts a claimed user ID.
export async function requestAccountDeletion(token: string, confirmation: string) {
  if (!token || confirmation.trim() !== 'DELETE') throw Error('Type DELETE to confirm your request.');
  const {response, body} = await fetchJSONWithTimeout(`${API_URL}/api/v1/support/tickets`, {
    method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({subject: 'Account and associated data deletion request', message: 'I request deletion of my ATL Xpress account and associated personal data, including the business profile linked to this account where applicable. Please review outstanding transactions and any legally required retention, and confirm the outcome in this Support conversation.'}),
  }, 15000);
  if (response.status !== 201 || typeof body?.ticket_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.ticket_id)) {
    throw Error('We could not confirm your request. Check Support before sending another request.');
  }
  return body.ticket_id as string;
}
