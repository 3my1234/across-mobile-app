const {resolveAPIEnvironment} = require('../components/apiEnvironment');
const eas = require('../eas.json');
const app = require('../app.json').expo;

function checkProviderPreview(env = process.env) {
  const profile = eas.build['provider-preview'];
  if (!profile || profile.extends !== 'preview' || profile.environment !== 'preview') throw Error('Provider preview must use the existing internal Android build and preview credentials.');
  const expected = {EXPO_PUBLIC_APP_ENV: 'preview', EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT: 'true', EXPO_PUBLIC_DISTRIBUTION_CHANNEL: 'direct'};
  for (const [key, value] of Object.entries(expected)) {
    if (profile.env[key] !== value || (env[key] !== undefined && env[key] !== value)) throw Error(`Conflicting ${key}; provider preview flags must match the reviewed profile.`);
  }
  const origin = eas.build.preview.env.EXPO_PUBLIC_API_URL;
  if (origin !== 'https://api.atlxpres.com' || (env.EXPO_PUBLIC_API_URL !== undefined && env.EXPO_PUBLIC_API_URL !== origin)) throw Error('Provider preview API target differs from the reviewed existing API.');
  if (eas.build.preview.distribution !== 'internal' || eas.build.preview.android?.buildType !== 'apk' || app.android.package !== 'com.atlanticexpress.mobile' || app.scheme !== 'across') throw Error('Existing APK identity or distribution changed.');
  for (const key of ['EXPO_PUBLIC_PRIVY_APP_ID', 'EXPO_PUBLIC_PRIVY_CLIENT_ID']) if (!String(env[key] || '').trim()) throw Error(`Configure ${key} in the existing preview environment before building.`);
  return {api_origin: origin, application_id: app.android.package, scheme: app.scheme};
}

function checkProviderStaging(env = process.env) {
  const profile = eas.build['provider-staging'];
  if (!profile || profile.distribution !== 'internal' || profile.android?.buildType !== 'apk' || profile.environment !== 'preview' || profile.env.EXPO_PUBLIC_APP_ENV !== 'staging' || profile.env.EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT !== 'true' || profile.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL !== 'direct') throw Error('Provider staging build flags are incomplete.');
  if (env.EAS_BUILD_PROFILE && env.EAS_BUILD_PROFILE !== 'provider-staging') throw Error('Wrong EAS profile for provider staging validation.');
  for (const key of ['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_NATIVE_PROVIDER_ACCOUNT', 'EXPO_PUBLIC_DISTRIBUTION_CHANNEL']) {
    if (env[key] !== undefined && env[key] !== profile.env[key]) throw Error(`Conflicting ${key}; provider staging must retain its reviewed flags.`);
  }
  const origin = resolveAPIEnvironment('staging', env.EXPO_PUBLIC_PROVIDER_STAGING_API_URL);
  for (const key of ['EXPO_PUBLIC_PRIVY_APP_ID', 'EXPO_PUBLIC_PRIVY_CLIENT_ID']) if (!String(env[key] || '').trim()) throw Error(`Configure ${key} for the reviewed preview environment before requesting a usable APK.`);
  if (app.android.package !== 'com.atlanticexpress.mobile' || app.scheme !== 'across') throw Error('Application identity changed; review signing and return links before building.');
  return {api_origin: origin, application_id: app.android.package, scheme: app.scheme};
}
if (require.main === module) {
  try {
    if (process.argv.includes('--eas-hook') && !['provider-staging', 'provider-preview'].includes(process.env.EAS_BUILD_PROFILE)) process.exit(0);
    const result = process.env.EAS_BUILD_PROFILE === 'provider-preview' ? checkProviderPreview() : checkProviderStaging();
    console.log(JSON.stringify({provider_staging_configuration: 'pass', ...result, note: 'Configuration check only; backend isolation, gateway sandbox, signing and device acceptance require separate evidence.'}));
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
module.exports = {checkProviderStaging, checkProviderPreview};
