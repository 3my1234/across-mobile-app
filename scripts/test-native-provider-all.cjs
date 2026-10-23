const {spawnSync} = require('node:child_process');
const suites = [
  'test-native-provider', 'test-provider-entry', 'test-workspace-transport', 'test-auth-workspace', 'test-provider-workspace', 'test-provider-onboarding', 'test-provider-onboarding-screen',
  'test-provider-profile', 'test-provider-publishing', 'test-provider-catalog-screen', 'test-price-display', 'test-referrals', 'test-provider-inbox', 'test-provider-driver',
  'test-provider-bookings', 'test-provider-booking-screen', 'test-provider-booking-images', 'test-provider-orders', 'test-notification-destinations', 'test-provider-address-search', 'test-provider-location-picker', 'test-notification-diagnostics', 'test-notification-setup',
  'test-town-hall-feed', 'test-provider-subscription', 'test-provider-subscription-screen', 'test-provider-fulfillment-screen', 'test-provider-staging',
];
for (const suite of suites) {
  const result = spawnSync(process.execPath, [`scripts/${suite}.cjs`], {stdio: 'inherit'});
  if (result.error) {console.error(`Could not start ${suite}`); process.exit(1);}
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Native provider regression gate passed (${suites.length} suites). Device acceptance remains separate.`);
