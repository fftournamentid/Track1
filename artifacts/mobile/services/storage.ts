import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  INVOICES: '@TruckInvoice:invoices',
  PROFILE: '@TruckInvoice:profile',
  SETTINGS: '@TruckInvoice:settings',
} as const;

export { KEYS };

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
