// Experimental password-login transport only. Never wrap signup, payment,
// OAuth, token refresh or another mutating request in this retry policy.
export const LOGIN_MAX_ATTEMPTS = 6;
export const LOGIN_BUDGET_MS = 30_000;

export class LoginCancelled extends Error {
  constructor() { super('Sign-in cancelled.'); this.name = 'LoginCancelled'; }
}
export class LoginTemporarilyBusy extends Error {
  constructor() {
    super('Sign-in is temporarily busy. Please wait a moment, then try again.');
    this.name = 'LoginTemporarilyBusy';
  }
}

export type LoginWait = { nextAttempt: number; maxAttempts: number; delayMs: number };
type Reply = { status: number; retryAfter: string | null; serverDate?: string | null };
type Clock = {
  monotonic: () => number;
  random: () => number;
  setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
};
const realClock: Clock = {
  monotonic: () => performance.now(), random: () => Math.random(),
  setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: timer => clearTimeout(timer),
};

// Delay-seconds and the current HTTP-date format only. Malformed/absent values
// never authorize an automatic retry. A zero/past value still gets a 1s floor.
export function loginRetryDelay(value: string | null, serverDate: string | null = null): number | null {
  if (value === null) return null;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Number.isSafeInteger(ms) ? Math.max(1000, ms) : null;
  }
  const httpDate = (text: string | null): number | null => {
    if (!text || !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) return null;
    const date = Date.parse(text);
    return Number.isFinite(date) && new Date(date).toUTCString() === text ? date : null;
  };
  const date = httpDate(raw), reference = httpDate(serverDate?.trim() || null);
  // A skewed phone clock must not shorten a server's requested wait. Date-based
  // retries therefore need the same response's valid Date header. Add one
  // second for HTTP-date precision; missing Date means manual retry only.
  if (date === null || reference === null) return null;
  return Math.max(1000, date - reference + 1000);
}

// Race the entire transport (including reading its body), not just response
// headers. Even a transport ignoring AbortSignal cannot apply a late result.
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new LoginCancelled());
    if (signal.aborted) { work.catch(() => undefined); abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    work.then(value => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) abort(); else resolve(value);
    }, error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

export async function loginWithOverloadRetry<T extends Reply>(
  send: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  onWait: (wait: LoginWait) => void,
  clock: Clock = realClock,
): Promise<T> {
  if (signal.aborted) throw new LoginCancelled();
  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener('abort', cancel, { once: true });
  const began = clock.monotonic();
  let timedOut = false;
  const deadline = clock.setTimer(() => { timedOut = true; request.abort(); }, LOGIN_BUDGET_MS);
  try {
    for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt++) {
      if (request.signal.aborted) throw new LoginCancelled();
      if (clock.monotonic() - began >= LOGIN_BUDGET_MS) throw new LoginTemporarilyBusy();
      const reply = await abortable(send(request.signal), request.signal);
      if (signal.aborted) throw new LoginCancelled();
      if (clock.monotonic() - began >= LOGIN_BUDGET_MS) throw new LoginTemporarilyBusy();
      if (reply.status !== 503) return reply;
      const delay = loginRetryDelay(reply.retryAfter, reply.serverDate);
      if (delay === null) return reply;
      if (attempt === LOGIN_MAX_ATTEMPTS) throw new LoginTemporarilyBusy();
      const jitter = Math.floor(Math.min(1, Math.max(0, clock.random())) * 1000);
      const wait = delay + jitter;
      if (wait >= LOGIN_BUDGET_MS - (clock.monotonic() - began)) throw new LoginTemporarilyBusy();
      onWait({ nextAttempt: attempt + 1, maxAttempts: LOGIN_MAX_ATTEMPTS, delayMs: wait });
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clock.clearTimer(timer); reject(new LoginCancelled()); };
        const timer = clock.setTimer(() => {
          request.signal.removeEventListener('abort', abort);
          resolve();
        }, wait);
        request.signal.addEventListener('abort', abort, { once: true });
        if (request.signal.aborted) abort();
      });
    }
    throw new LoginTemporarilyBusy();
  } catch (error) {
    if (signal.aborted) throw new LoginCancelled();
    if (timedOut) throw new LoginTemporarilyBusy();
    throw error; // Never replay a timeout/network error or an unknown outcome.
  } finally {
    clock.clearTimer(deadline);
    signal.removeEventListener('abort', cancel);
    request.abort();
  }
}
