// One exchange per user action. OAuth may resolve/create an identity, so a
// timeout or network failure must never replay this POST automatically.
export async function googleSessionRequest(url: string, init: RequestInit, signal: AbortSignal, timeoutMs = 12000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => {controller.abort(); reject(new Error('Google sign-in was interrupted. Please try again.'));};
    signal.addEventListener('abort', abort, {once: true});
    timer = setTimeout(() => {controller.abort(); reject(new Error('The server took too long to complete Google sign-in. Please try again.'));}, timeoutMs);
  });
  if (signal.aborted) abort();
  try {
    if (signal.aborted) return await stopped;
    return await Promise.race([stopped, (async () => {
      const response = await fetch(url, {...init, signal: controller.signal});
      const text = await response.text();
      let body: any = {};
      if (text.trim()) {try {body = JSON.parse(text);} catch {if (response.ok) throw Error('Google sign-in returned an incomplete response. Please try again.'); body = {message: text};}}
      return {response, body};
    })()]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
