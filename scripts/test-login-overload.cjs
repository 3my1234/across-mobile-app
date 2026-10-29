const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, Date, Number, Math, Error, Promise, AbortController, performance, setTimeout, clearTimeout };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/loginOverload.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const { loginRetryDelay: delay, loginWithOverloadRetry: run, LoginCancelled, LoginTemporarilyBusy } = context.exports;
const flush = () => new Promise(resolve => setImmediate(resolve));
const origin = Date.parse('Tue, 27 Oct 2026 18:00:00 GMT');
function clock(random = .5) {
  let now = 0, id = 0;
  const tasks = new Map();
  return {
    monotonic: () => now, wall: () => origin + now, random: () => random,
    setTimer: (fn, ms) => { const key = ++id; tasks.set(key, { at: now + ms, fn }); return key; },
    clearTimer: key => tasks.delete(key),
    get now() { return now; }, get pending() { return tasks.size; },
    async next() {
      await flush();
      const next = [...tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) return false;
      now = next[1].at; tasks.delete(next[0]); next[1].fn(); await flush(); return true;
    },
  };
}
async function execute(send, { rng = .5, cancel, before = false } = {}) {
  const time = clock(rng), controller = new AbortController(), waits = [];
  let calls = 0, done = false, value, error;
  if (before) controller.abort();
  const promise = run(signal => { calls++; return send(calls, signal); }, controller.signal,
    wait => { waits.push(wait); if (cancel === 'wait') controller.abort(); }, time)
    .then(result => { value = result; }, failure => { error = failure; }).finally(() => { done = true; });
  await flush();
  if (cancel === 'request') { controller.abort(); await flush(); }
  for (let steps = 0; !done && steps < 20; steps++) {
    assert.ok(await time.next(), 'a pending operation must have a deadline');
  }
  await promise;
  assert.equal(time.pending, 0, 'all request/wait/deadline timers released');
  return { calls, waits, value, error, elapsed: time.now };
}
const reply = (status, retryAfter = null) => ({ status, retryAfter });
(async () => {
  assert.equal(delay('2'), 2000);
  assert.equal(delay('0'), 1000);
  assert.equal(delay('Tue, 27 Oct 2026 18:00:05 GMT', 'Tue, 27 Oct 2026 18:00:00 GMT'), 6000);
  assert.equal(delay('Tue, 27 Oct 2026 17:00:00 GMT', 'Tue, 27 Oct 2026 18:00:00 GMT'), 1000);
  for (const header of [null, '', '-1', '1.5', 'Infinity', 'tomorrow', '999999999999999999999', 'Wed, 27 Oct 2026 18:00:05 GMT']) assert.equal(delay(header), null);
  assert.equal(delay('Tue, 27 Oct 2026 18:00:05 GMT'), null, 'date retry needs server Date, never the phone clock');
  assert.equal(delay('Tue, 27 Oct 2026 18:00:05 GMT', 'invalid'), null);
  const immediate = await execute(async () => reply(200));
  assert.equal(immediate.calls, 1); assert.equal(immediate.value.status, 200);
  const recovered = await execute(async n => reply(n === 1 ? 503 : 200, '2'));
  assert.equal(recovered.calls, 2); assert.equal(recovered.elapsed, 2500);
  assert.equal(recovered.waits[0].nextAttempt, 2); assert.equal(recovered.waits[0].maxAttempts, 6);
  const exhausted = await execute(async () => reply(503, '2'));
  assert.equal(exhausted.calls, 6); assert.equal(exhausted.waits.length, 5);
  assert.ok(exhausted.error instanceof LoginTemporarilyBusy);
  assert.equal(exhausted.elapsed, 12500);
  for (const status of [400, 401, 403, 409, 422, 429, 500, 502, 504]) {
    const result = await execute(async () => reply(status, '2'));
    assert.equal(result.calls, 1); assert.equal(result.value.status, status);
  }
  for (const header of [null, '', '-1', '1.5', 'garbage']) {
    const result = await execute(async () => reply(503, header));
    assert.equal(result.calls, 1); assert.equal(result.value.status, 503);
  }
  const longWait = await execute(async () => reply(503, '31'));
  assert.equal(longWait.calls, 1); assert.equal(longWait.waits.length, 0);
  assert.ok(longWait.error instanceof LoginTemporarilyBusy);
  const networkError = Error('ambiguous network failure');
  const network = await execute(async () => { throw networkError; });
  assert.equal(network.calls, 1); assert.equal(network.error, networkError);
  const stalled = await execute(() => new Promise(() => {}));
  assert.equal(stalled.calls, 1); assert.equal(stalled.elapsed, 30000);
  assert.ok(stalled.error instanceof LoginTemporarilyBusy);
  const cancelledBefore = await execute(async () => reply(200), { before: true });
  assert.equal(cancelledBefore.calls, 0); assert.ok(cancelledBefore.error instanceof LoginCancelled);
  const cancelledWait = await execute(async () => reply(503, '2'), { cancel: 'wait' });
  assert.equal(cancelledWait.calls, 1); assert.ok(cancelledWait.error instanceof LoginCancelled);
  const cancelledRequest = await execute(() => new Promise(() => {}), { cancel: 'request' });
  assert.equal(cancelledRequest.calls, 1); assert.ok(cancelledRequest.error instanceof LoginCancelled);
  let late;
  const lateResult = await execute(() => new Promise(resolve => { late = resolve; }), { cancel: 'request' });
  late(reply(200)); await flush();
  assert.equal(lateResult.value, undefined); assert.ok(lateResult.error instanceof LoginCancelled);
  const early = await execute(async n => reply(n === 1 ? 503 : 200, '2'), { rng: 0 });
  const lateJitter = await execute(async n => reply(n === 1 ? 503 : 200, '2'), { rng: 1 });
  assert.equal(early.elapsed, 2000); assert.equal(lateJitter.elapsed, 3000);
  const shrinkingBudget = await execute(async () => reply(503, '10'));
  assert.equal(shrinkingBudget.calls, 3); assert.equal(shrinkingBudget.elapsed, 21000);
  assert.ok(shrinkingBudget.error instanceof LoginTemporarilyBusy);
  console.log('Login transport proposal passed: header validation, retry floor/jitter, six-attempt/30s budgets, non-retryable statuses/network outcomes, cancellation, stale responses and timer cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
