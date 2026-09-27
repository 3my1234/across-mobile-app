import AsyncStorage from "@react-native-async-storage/async-storage";

export type NearbyCoordinates = { latitude: number; longitude: number; accuracy?: number; label?: string };
export type NearbySnapshot<T = Record<string, unknown>> = {
  version: 1;
  fetchedAt: string;
  coordinates: NearbyCoordinates;
  items: T[];
};

const NEARBY_CACHE_KEY = "atlantic-express:nearby-services:v1";
export const NOTIFICATION_SOUND_KEY = "atlantic-express:notification-sound:v1";

export async function readNearbySnapshot<T>(): Promise<NearbySnapshot<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(NEARBY_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as NearbySnapshot<T>;
    if (value?.version !== 1 || !Array.isArray(value.items) || !value.coordinates) return null;
    return value;
  } catch {
    return null;
  }
}

export async function writeNearbySnapshot<T>(coordinates: NearbyCoordinates, items: T[]) {
  const snapshot: NearbySnapshot<T> = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    coordinates,
    items: items.slice(0, 100)
  };
  await AsyncStorage.setItem(NEARBY_CACHE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function filterNearbySnapshot<T extends {
  listing_type?: string;
  title?: string;
  description?: string;
  category?: string;
  provider_name?: string;
  city?: string;
  state?: string;
}>(items: T[], type: string, search: string): T[] {
  const needle = search.trim().toLocaleLowerCase();
  return items.filter(item => {
    if (type && item.listing_type !== type) return false;
    if (!needle) return true;
    return [item.title, item.description, item.category, item.provider_name, item.city, item.state]
      .some(value => String(value || "").toLocaleLowerCase().includes(needle));
  });
}

export async function readNotificationSoundEnabled() {
  try {
    return (await AsyncStorage.getItem(NOTIFICATION_SOUND_KEY)) !== "false";
  } catch {
    return true;
  }
}

export async function writeNotificationSoundEnabled(enabled: boolean) {
  await AsyncStorage.setItem(NOTIFICATION_SOUND_KEY, String(enabled));
}

const REVEALED_CONTACTS_KEY = "atlantic-express:revealed-provider-contacts:v1";

export async function readCachedContact(listingID: string): Promise<{ email?: string; phone?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(REVEALED_CONTACTS_KEY);
    const contacts = raw ? JSON.parse(raw) : {};
    return contacts[listingID] || null;
  } catch {
    return null;
  }
}

export async function writeCachedContact(listingID: string, contact: { email?: string; phone?: string }) {
  try {
    const raw = await AsyncStorage.getItem(REVEALED_CONTACTS_KEY);
    const contacts = raw ? JSON.parse(raw) : {};
    contacts[listingID] = contact;
    await AsyncStorage.setItem(REVEALED_CONTACTS_KEY, JSON.stringify(contacts));
  } catch {
    // Contact caching is best-effort; the successful online reveal still works.
  }
}
