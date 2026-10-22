const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const policy = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/providerBookingPolicy.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}}).outputText, {exports: policy, Date, Error});
const id = '33333333-3333-4333-8333-333333333333';
assert.equal(policy.bookingTransition({id, status: 'pending'}, 'accepted').status, 'accepted');
assert.equal(policy.bookingTransition({id, status: 'pending'}, 'rejected').status, 'rejected');
assert.equal(policy.bookingTransition({id, status: 'accepted'}, 'completed').status, 'completed');
for (const status of ['pending', 'accepted', 'completed', 'rejected', 'cancelled', 'unknown']) for (const next of ['accepted', 'rejected', 'completed']) {
  if (!(status === 'pending' && ['accepted', 'rejected'].includes(next) || status === 'accepted' && next === 'completed')) assert.throws(() => policy.bookingTransition({id, status}, next));
}
assert.throws(() => policy.bookingTransition({id: '../another-account', status: 'pending'}, 'accepted'));
const form = {startDate: '2027-02-22', startTime: '09:00', endDate: '2027-02-22', endTime: '10:00', capacity: '2'};
const payload = policy.availabilityPayload(form, new Date(2027, 1, 21).getTime());
assert.equal(payload.capacity, 2); assert.equal(payload.status, 'open');
assert.equal(new Date(payload.starts_at).getHours(), 9, 'entered local times must be converted to UTC without shifting the appointment');
assert.equal(new Date(payload.ends_at) - new Date(payload.starts_at), 3600000);
for (const changes of [{startDate: '2027-02-30'}, {startTime: '24:00'}, {endTime: '08:00'}, {startDate: '22/02/2027'}, {capacity: '0'}, {capacity: '1.5'}, {capacity: '2e2'}, {capacity: '2147483648'}]) assert.throws(() => policy.availabilityPayload({...form, ...changes}, 0));
assert.throws(() => policy.availabilityPayload(form, new Date(2027, 2, 1).getTime()), /future/);
console.log('Provider bookings passed: permitted transitions only, valid resource identity, local-time conversion, impossible dates, future slots and bounded whole-number capacity.');
