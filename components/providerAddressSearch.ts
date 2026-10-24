import * as Location from 'expo-location';

export async function providerAddressSearch(raw: string) {
  const query = raw.trim();
  if (query.length < 3 || query.length > 500) throw Error('Enter a complete address, area or landmark with its city.');
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw Error('Allow foreground location for address search, or enter the coordinates manually.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const results = await Promise.race([
      Location.geocodeAsync(query),
      new Promise<never>((_, reject) => {timer = setTimeout(() => reject(Error('Address search timed out. Retry, use GPS or enter coordinates manually.')), 12000);}),
    ]);
    const valid = results.filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && item.latitude >= -90 && item.latitude <= 90 && item.longitude >= -180 && item.longitude <= 180).slice(0, 5);
    if (!valid.length) throw Error('No location matched. Add the city or a nearby landmark, use GPS, or enter coordinates manually.');
    return valid.map(({latitude, longitude}) => ({latitude, longitude}));
  } finally {if (timer) clearTimeout(timer);}
}
