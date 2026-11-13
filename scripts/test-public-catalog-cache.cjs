const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
const compile = source => ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;

async function main() {
  let raw = null, fail = false;
  const storage = {getItem: async () => raw, setItem: async (_, value) => {if (fail) throw Error('disk full'); raw = value;}, removeItem: async () => {raw = null;}};
  const load = (api = 'https://api.test') => {
    const scope = {exports: {}, require: name => name.includes('async-storage') ? storage : {API_URL: api}};
    vm.runInNewContext(compile(fs.readFileSync('components/publicCatalogCache.ts', 'utf8')), scope);
    return scope.exports;
  };
  const cache = load();
  const product = {id: 'one', sku: 'SKU1', title: 'Public listing', price: 12, currency: 'NGN', review_count: 0, sold_count: 0, average_rating: 0, category_path: ['Goods'], image_urls: ['https://media.atlxpres.com/one.webp'], inventory_count: 4,
    token: 'must-not-persist', latitude: 9, provider_identity: {name: 'Public shop', verified: true, secret: 'must-not-persist'}};
  await cache.writePublicCatalog('NG||', [product], 1000);
  assert.ok(!raw.includes('must-not-persist') && !raw.includes('latitude'), 'only allowlisted public presentation fields persist');
  assert.equal((await load().readPublicCatalog('NG||', 2000))[0].title, product.title, 'a fresh process recovers the saved feed');
  assert.equal(await cache.readPublicCatalog('US||', 2000), null, 'never reuse another delivery market');
  assert.equal(await load('https://staging.test').readPublicCatalog('NG||', 2000), null, 'API environments remain isolated');
  assert.equal(await cache.readPublicCatalog('NG||', 1000 + 86400001), null, 'old presentation snapshots expire');
  assert.equal(await cache.readPublicCatalog('NG||', 999), null, 'future/corrupt timestamps are rejected');
  await cache.writePublicCatalog('NG||', Array.from({length: 100}, (_, id) => ({...product, id: String(id)})), 1000);
  assert.equal((await cache.readPublicCatalog('NG||', 1001)).length, 80, 'the snapshot has a bounded item count');
  await Promise.all([cache.writePublicCatalog('NG||', [{...product, title: 'older'}], 1000), cache.writePublicCatalog('NG||', [{...product, title: 'newer'}], 1001)]);
  assert.equal((await cache.readPublicCatalog('NG||', 1002))[0].title, 'newer', 'writes retain completion ordering');
  await cache.writePublicCatalog('NG||', [{...product, description: 'a'.repeat(140000)}]);
  assert.equal(raw, null, 'oversized snapshots do not accumulate');
  raw = '{broken'; assert.equal(await cache.readPublicCatalog('NG||'), null);
  fail = true; await cache.writePublicCatalog('NG||', [product]); fail = false;
  await cache.writePublicCatalog('NG||', [product], 1000);
  assert.equal((await cache.readPublicCatalog('NG||', 1001)).length, 1, 'storage errors do not poison subsequent writes');

  // Execute the real startup effect to cover storage/network/navigation races.
  const app = ts.createSourceFile('App.tsx', fs.readFileSync('App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(app) === 'useEffect' && node.arguments[0]?.getText(app).includes('void readPublicCatalog(key)')) effect = node.getText(app);
    ts.forEachChild(node, visit);
  }
  visit(app); assert.ok(effect, 'startup installs public snapshot recovery');
  let resolve, cleanup, displayed = [], saved = '';
  const keys = new Set();
  const scope = {catalogCountry: 'NG', catalogState: '', catalogCity: '', freshCatalogKeys: {current: keys},
    readPublicCatalog: () => new Promise(r => {resolve = r;}), setProducts: value => {displayed = value;}, setSavedCatalogKey: value => {saved = value;}, useEffect: callback => {cleanup = callback();}};
  const run = () => vm.runInNewContext(compile(effect), scope);
  run(); resolve([product]); await flush(); assert.equal(displayed[0].id, 'one'); assert.equal(saved, 'NG||');
  displayed = []; run(); keys.add('NG||'); resolve([product]); await flush(); assert.equal(displayed.length, 0, 'a late disk result cannot overwrite a successful network response');
  keys.clear(); run(); cleanup(); resolve([product]); await flush(); assert.equal(displayed.length, 0, 'a previous destination/unmounted screen cannot populate the feed');
  console.log('Public catalogue cache passed: process recovery, market/API isolation, expiry, bounded storage, public fields, storage failures and startup races.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
