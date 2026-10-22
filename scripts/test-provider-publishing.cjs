const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
function compile(code, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, {exports, URL, setTimeout, clearTimeout, AbortController, ...globals});
  return exports;
}
(async () => {
  const policy = compile(fs.readFileSync('components/providerPublishingPolicy.ts', 'utf8'));
  const limits = {post_limit: 20, max_images: 8, max_videos: 2, max_video_seconds: 60};
  const service = policy.makeServiceDraft({contact_email: 'example@example.test'});
  Object.assign(service, {title: 'Repair', description: 'Repair work', city: 'Test city', media_urls: ['https://storage.test/one'], latitude: 9, longitude: 7});
  policy.validatePostDraft('listings', service, limits, true);
  assert.throws(() => policy.validatePostDraft('listings', service, limits, false), /confirm/);
  const editing = {...service, id: 'service'}; delete editing.contact_phone;
  assert.throws(() => policy.validatePostDraft('listings', editing, limits, true), /complete editable/);
  for (const max of [1, 2, 4, 8]) assert.match(policy.postMediaError({...limits, max_images: max}, Array(max + 1).fill('image'), []), /allows/);
  assert.match(policy.postMediaError({...limits, max_videos: 0}, ['image'], ['video']), /videos/);
  service.attributes = {price_mode: 'quote', video_urls: ['https://storage.test/verified-video'], price_notes: 'Parts extra', custom: {preserve: true}};
  const payload = policy.postPayload('listings', {...service, price: 200});
  assert.equal(payload.price, null);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.attributes)), service.attributes);
  payload.attributes.custom.preserve = false; assert.equal(service.attributes.custom.preserve, true, 'building payload does not mutate saved snapshot');
  const product = policy.makeProductDraft({country_code: 'NG'});
  Object.assign(product, {id: 'product', title: 'Rice', description: 'Rice bag', image_urls: ['https://storage.test/photo'], video_urls: ['https://storage.test/verified-video'], local_selling_price: 1000, inventory_count: 5, inventory_latitude: 9, inventory_longitude: 7, delivery_areas: [{country_code: 'NG', state: 'test', city: 'test', delivered_price: 1200, delivery_fee: 200, currency_code: 'NGN', uses_primary_price: true}], category_path: ['Food'], compare_at_price: 1500, is_flash_sale: true, flash_sale_price: 900, sku: 'immutable-original'});
  policy.validatePostDraft('products', product, limits, true);
  const patch = policy.postPayload('products', {...product, title: 'New title'});
  for (const key of ['delivery_areas', 'category_path', 'video_urls', 'compare_at_price', 'is_flash_sale', 'flash_sale_price', 'sku', 'inventory_latitude', 'delivery_methods', 'stock_state']) assert.deepEqual(JSON.parse(JSON.stringify(patch[key])), JSON.parse(JSON.stringify(product[key])), key+' preserved by full PATCH');
  assert.throws(() => policy.validatePostDraft('products', {...product, delivery_max_days: -1}, limits, true), /delivery times/);
  // Exercise the real shared timeout reader against 204 rather than mocking a JSON body.
  const utils = fs.readFileSync('components/utils.ts', 'utf8');
  const reader = utils.slice(utils.indexOf('export async function fetchJSONWithTimeout'), utils.indexOf('// Only history reads'));
  let parsed = 0;
  const response = compile(reader, {fetch: async () => ({status: 204, json: async () => {parsed++; throw new Error('No JSON body');}})});
  assert.equal((await response.fetchJSONWithTimeout('https://example.test')).response.status, 204);
  assert.equal(parsed, 0, 'successful 204 mutations are not reported as JSON failures');
  console.log('Provider publishing tests passed: full payload preservation, service contact guard, location confirmation, tier caps, delivery validation and no-content mutations.');
})().catch(error => {console.error(error); process.exitCode = 1;});
