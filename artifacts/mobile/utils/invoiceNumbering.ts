import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@FleetInvoice:device_id';
const PROVISIONAL_COUNTER_KEY = '@FleetInvoice:provisional_counter';

let inMemoryCounter = 0;

export async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10).toUpperCase();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'DEV1';
  }
}

/**
 * Generates an offline provisional invoice number:
 * Format: DRAFT-<first 4 chars of deviceId>-<counter>
 * Guarantees monotonic non-repeating numbers even offline.
 */
export async function generateProvisionalInvoiceNumber(): Promise<string> {
  const deviceId = await getDeviceId();
  const prefix = deviceId.slice(0, 4).toUpperCase().padEnd(4, 'X');

  let counter = 1;
  try {
    const raw = await AsyncStorage.getItem(PROVISIONAL_COUNTER_KEY);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= inMemoryCounter) {
        counter = parsed + 1;
      } else {
        counter = inMemoryCounter + 1;
      }
    } else if (inMemoryCounter > 0) {
      counter = inMemoryCounter + 1;
    }
    inMemoryCounter = counter;
    await AsyncStorage.setItem(PROVISIONAL_COUNTER_KEY, String(counter));
  } catch {
    inMemoryCounter++;
    counter = inMemoryCounter;
  }

  return `DRAFT-${prefix}-${counter}`;
}

export function isProvisionalNumber(invoiceNumber: string): boolean {
  return typeof invoiceNumber === 'string' && invoiceNumber.startsWith('DRAFT-');
}
