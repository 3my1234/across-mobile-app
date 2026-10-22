const {spawnSync} = require('node:child_process');
const suites = [
  'test-native-provider', 'test-provider-workspace', 'test-provider-onboarding',
  'test-provider-profile', 'test-provider-publishing', 'test-provider-driver',
  'test-provider-bookings', 'test-provider-orders', 'test-notification-destinations',
  'test-town-hall-feed',
];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [`scripts/${suite}.cjs`], {stdio: 'inherit'});
  if (result.error) {console.error(`Could not start ${suite}`); process.exit(1);}
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Native provider regression gate passed (${suites.length} suites). Device acceptance remains separate.`);
