/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(name, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", "components", name), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ exports: {}, require: name => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, ...globals });
  vm.runInContext(compiled, context);
  return context;
}

async function main() {
  const { exports: state } = load("catalogState.ts", {});
  const old = { id: "watch", price: 20, currency: "NGN", inventory_count: 3, updated_at: "2026-10-05T10:00:00Z", catalog_version: 1 };
  const latest = { ...old, price: 100, inventory_count: 1, updated_at: "2026-10-05T11:00:00Z", catalog_version: 2 };
  assert.equal(state.latestProductSnapshot(latest, old).price, 100, "late response must not restore the old price");
  const cart = [{ product: old, quantity: 2 }, { product: { ...old, id: "outside-feed" }, quantity: 1 }];
  const updated = state.reconcileCart(cart, new Map([["watch", latest]]), new Set());
  assert.equal(updated[0].product.price, 100);
  assert.equal(updated[0].quantity, 1, "stock reduction must cap cart quantity");
  assert.equal(updated.length, 2, "a bounded feed must not remove unrelated cart items");
  assert.notEqual(state.cartOfferFingerprint(cart), state.cartOfferFingerprint(updated), "changed payable offer must invalidate the quote");
  assert.equal(state.reconcileCart(cart, new Map(), new Set(["watch"])).length, 1);
  assert.equal(state.cartOfferFingerprint(cart), state.cartOfferFingerprint([{ ...cart[0], product: { ...old, title: "New description" } }, cart[1]]), "cosmetic edits must not discard an agreed quote");

  let version = "1", requests = 0, stateListener;
  const cleanups = [], timers = new Set();
  const appState = { currentState: "active", addEventListener: (_, callback) => {
    stateListener = callback; return { remove: () => { stateListener = null; } };
  } };
  const freshness = load("catalogFreshness.ts", {
    react: { useRef: value => ({ current: value }), useEffect: effect => cleanups.push(effect()) },
    "react-native": { AppState: appState },
    "./config": { API_URL: "https://example.test" },
    "./utils": { fetchWithTimeout: async (url, options) => {
      requests += 1;
      assert.match(url, /\/catalog\/version\?refresh=/);
      assert.equal(options.headers["Cache-Control"], "no-cache");
      return { ok: true, json: async () => ({ change_token: version }) };
    } }
  }, { setInterval: callback => { timers.add(callback); return callback; }, clearInterval: callback => timers.delete(callback) });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  let home = 0, detail = 0;
  freshness.exports.useCatalogFreshness(() => { home += 1; });
  freshness.exports.useCatalogFreshness(() => { detail += 1; });
  await flush();
  assert.equal(requests, 1, "mounted screens must share one version request");
  assert.equal(timers.size, 1);
  await vm.runInContext("poll()", freshness);
  await flush();
  assert.equal(home, 0, "unchanged revision must not reload full catalogues");
  version = "2";
  await vm.runInContext("poll()", freshness);
  await flush();
  assert.equal(home, 1);
  assert.equal(detail, 1, "a committed edit must refresh both list and open detail");
  appState.currentState = "background";
  const before = requests;
  await vm.runInContext("poll()", freshness);
  assert.equal(requests, before, "background app must not poll");
  appState.currentState = "active";
  stateListener("active");
  await flush();
  assert.equal(home, 2);
  assert.equal(detail, 2, "foreground resume must revalidate immediately");
  cleanups.forEach(cleanup => cleanup());
  assert.equal(timers.size, 0);
  assert.equal(stateListener, null);
  console.log("Catalogue regression tests passed: price/stock reconciliation, stale-response protection, shared change polling, and foreground refresh.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
