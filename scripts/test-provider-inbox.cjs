const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true}}).outputText;
const policy = {}, destinations = {}; vm.runInNewContext(compile('components/providerInboxPolicy.ts'), {exports: policy}); vm.runInNewContext(compile('components/notificationDestination.ts'), {exports: destinations, URLSearchParams});
const event = '11111111-1111-4111-8111-111111111111', requestID = '22222222-2222-4222-8222-222222222222', mirrorID = '33333333-3333-4333-8333-333333333333';
let read = false, hooks = [], index = 0, effects = [], changed = false, tree, held, fail = false, foreground;
const calls = [], opened = [];
const provider = () => ({items: [{id: event, event_type: 'request_created', metadata: {request_id: requestID}, created_at: '2026-10-23T10:00:00Z', read_at: read ? '2026-10-23T10:00:00Z' : null}]});
const account = () => ({notifications: [{id: mirrorID, type: 'provider_activity', title: 'Mirrored event', data: {provider_event_id: event}, is_read: read, created_at: '2026-10-23T10:00:00Z'}, {id: 'support', type: 'ticket_reply', title: 'Support replied', data: {ticket_id: requestID}, is_read: read, created_at: '2026-10-23T09:00:00Z'}]});
const merged = policy.providerInboxItems(provider(), account()); assert.equal(merged.length, 2, 'mirrored native event is not listed twice'); assert.equal(merged[0].notification.id, mirrorID, 'only real user-notification ID reaches generic read acknowledgement');
const destination = destinations.notificationDestination(merged[0].notification); assert.equal(destination.tab, 'provider'); assert.equal(new URLSearchParams(destination.route).get('request'), requestID); assert.equal(new URLSearchParams(destination.route).get('event'), event);
assert.equal(destinations.notificationDestination(merged[1].notification).tab, 'support');
const old = policy.providerInboxItems(provider(), {notifications: []}); assert.equal(old[0].notification.id, '', 'historical provider event is never mistaken for user notification ID');
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createElement: (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity)}),
  useState: value => {const i = index++; if (!(i in hooks)) hooks[i] = typeof value === 'function' ? value() : value; return [hooks[i], next => {hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; changed = true;}];},
  useRef: value => {const i = index++; return hooks[i] || (hooks[i] = {current: value});},
  useEffect: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) {const old = hooks[i]; hooks[i] = {deps}; effects.push(() => {old?.cleanup?.(); hooks[i].cleanup = fn();});}},
  useCallback: (fn, deps) => {const i = index++; if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = {deps, fn}; return hooks[i].fn;},
};
const context = {exports: {}, require: name => {
  if (name === 'react') return react;
  if (name === 'react-native') return {ActivityIndicator: 'Spinner', AppState: {addEventListener: (_event, fn) => {foreground = fn; return {remove() {}};}}, Modal: 'Modal', Pressable: 'Button', ScrollView: 'Scroll', View: 'View'};
  if (name === 'react-native-safe-area-context') return {useSafeAreaInsets: () => ({top: 12, bottom: 20})};
  if (name === './ThemeProvider') return {ThemedText: 'Text'};
  if (name === './AccountDesign') return {useAccountDesign: () => ({})};
  if (name === './providerInboxPolicy') return policy;
  if (name === './nativeProviderApi') return {providerRequest: async (token, path, options) => {
    calls.push({token, path, options}); if (held) await held;
    if (options?.method) {if (fail) throw Error('Synthetic partial read-status failure'); read = true; return {};}
    return path.startsWith('/providers/') ? provider() : account();
  }};
  throw Error('Unexpected import ' + name);
}};
vm.runInNewContext(compile('components/NativeProviderNotifications.tsx'), context);
function render() {index = 0; effects = []; changed = false; tree = context.exports.NativeProviderNotifications({token: 'synthetic-owner', hasProvider: true, onClose() {}, onOpen: item => opened.push(item)}); effects.forEach(fn => fn());}
const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(nodes)];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : node?.children?.map(text).join('') || '';
const button = label => {const value = nodes(tree).find(n => n.type === 'Button' && text(n) === label); assert.ok(value, label); return value;};
async function settle() {for (let i = 0; i < 8; i++) {await new Promise(resolve => setImmediate(resolve)); if (changed) render();}}
(async () => {
  render(); await settle(); assert.match(text(tree), /2 unread/); assert.ok(calls.every(call => call.token === 'synthetic-owner'));
  nodes(tree).find(n => n.type === 'Button' && text(n).startsWith('request created')).props.onPress(); assert.equal(opened.length, 1); assert.equal(opened[0].provider_event_id, event);
  let release; held = new Promise(resolve => {release = resolve;}); button('Mark all as read').props.onPress(); button('Mark all as read').props.onPress(); await settle();
  assert.equal(calls.filter(call => call.options?.method).length, 2, 'single confirmation writes each ledger once despite double taps'); assert.match(text(tree), /2 unread/, 'read status is not cleared before server confirmation');
  release(); held = null; await settle(); assert.match(text(tree), /0 unread/);
  read = false; foreground('active'); await settle(); fail = true; button('Mark all as read').props.onPress(); await settle(); assert.match(text(tree), /could not be fully confirmed/); assert.match(text(tree), /2 unread/);
  const before = calls.length; await settle(); assert.equal(calls.length, before, 'uncertain read-status writes are not auto-replayed');
  hooks.forEach(h => h?.cleanup?.());
  console.log('Provider inbox passed: native/legacy event deduplication, exact routes and ledger IDs, owned reads, single-flight confirmed mark-all, foreground refresh and uncertain-error handling.');
})().catch(error => {console.error(error); process.exitCode = 1;});
