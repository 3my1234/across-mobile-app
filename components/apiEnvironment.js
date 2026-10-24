const productionHosts = new Set(['api.atlxpres.com', 'atlxpres.com', 'www.atlxpres.com', 'provider.atlxpres.com', 'admin.atlxpres.com']);

function resolveAPIEnvironment(environment, stagingURL, defaultURL) {
  if (environment !== 'staging') return defaultURL ?? 'https://api.atlxpres.com';
  let url;
  try {url = new URL(stagingURL || '');} catch {throw Error('A reviewed HTTPS staging API address is required. Production fallback is disabled.');}
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || productionHosts.has(host) || /\.(invalid|localhost|local|test|example)$/.test(host) || /(^|\.)example\.(com|org|net)$/.test(host) || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) {
    throw Error('Use a reviewed staging HTTPS origin with no credentials, path or query. Production, placeholder and local addresses are forbidden.');
  }
  return url.origin;
}
module.exports = {resolveAPIEnvironment};
