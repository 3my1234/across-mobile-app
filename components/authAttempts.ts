export type AuthAttempt = { signal: AbortSignal; current: () => boolean; finish: () => void };
// Shared synchronous admission for password login, signup and OAuth.
export function createAuthAttempts() {
  let generation = 0;
  let active: { controller: AbortController; version: number } | null = null;
  return {
    begin(): AuthAttempt | null {
      if (active) return null;
      const entry = { controller: new AbortController(), version: ++generation };
      active = entry;
      return {
        signal: entry.controller.signal,
        current: () => generation === entry.version && !entry.controller.signal.aborted,
        finish: () => { if (active === entry) active = null; },
      };
    },
    cancel() { generation++; active?.controller.abort(); active = null; },
    get pending() { return active !== null; },
  };
}

type Session = { access_token: string; expires_at: string | number };
type StoragePorts = {
  token: (value: string) => Promise<void>;
  expiry: (value: string) => Promise<void>;
  clear: () => Promise<void>;
  open: (session: Session) => void;
};

// All token/expiry writes, cancellation cleanup and logout deletion share one
// queue. An obsolete writer can never erase a newer writer's committed token.
// Keep that queue across AppContent remounts within the same JS runtime.
const sessionStorage = { version: 0, queue: Promise.resolve<unknown>(undefined) };
export function createSessionPersistence(ports: StoragePorts) {
  sessionStorage.version++;
  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = sessionStorage.queue.then(work);
    sessionStorage.queue = result.catch(() => undefined);
    return result;
  }
  return {
    read<T>(work: () => Promise<T>) { return serialize(work); },
    commit(session: Session, current: () => boolean = () => true) {
      const mine = sessionStorage.version;
      const valid = () => mine === sessionStorage.version && current();
      return serialize(async () => {
        if (!valid()) return false;
        if (!session || typeof session.access_token !== 'string' || !session.access_token.trim() ||
            !Number.isFinite(Number(session.expires_at)) || Number(session.expires_at) * 1000 <= Date.now()) {
          throw new Error('Sign-in returned an invalid session. Please try again.');
        }
        try {
          // Invalidate an older expiry before replacing its token, so a failed
          // partial write cannot pair a new token with an old valid expiry.
          await ports.expiry('0');
          if (!valid()) { await ports.clear(); return false; }
          await ports.token(session.access_token);
          if (!valid()) { await ports.clear(); return false; }
          await ports.expiry(String(session.expires_at));
          if (!valid()) { await ports.clear(); return false; }
        } catch (error) { await ports.clear(); throw error; }
        ports.open(session); // No asynchronous gap between final guard and UI.
        return true;
      });
    },
    clear() { sessionStorage.version++; return serialize(() => ports.clear()); },
  };
}
