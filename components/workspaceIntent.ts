import * as SecureStore from 'expo-secure-store';
import type {WorkspaceIntent} from './ProviderEntryGate';

const KEY = 'across.pendingWorkspaceIntent.v1';
export async function rememberSignupWorkspace(email: string, workspace: Exclude<WorkspaceIntent, 'auto'>) {
  await SecureStore.setItemAsync(KEY, JSON.stringify({email: email.trim().toLowerCase(), workspace}));
}
export async function signupWorkspaceFor(email: string): Promise<WorkspaceIntent> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved?.email === email.trim().toLowerCase() && ['provider', 'customer'].includes(saved.workspace) ? saved.workspace : 'auto';
  } catch {return 'auto';}
}
export async function clearSignupWorkspace() {await SecureStore.deleteItemAsync(KEY);}

// A pending provider journey survives verification, sign-in and app restarts.
// It is only a navigation preference; confirm its email with the signed-in API.
export async function hasPendingProviderSignup(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved?.workspace === 'provider' && typeof saved.email === 'string' && !!saved.email;
  } catch {return false;}
}
