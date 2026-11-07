/**
 * Safe logger for FleetInvoice.
 *
 * - debug and info only print when __DEV__ is true.
 * - error prints a short sanitized message and NEVER sensitive payloads.
 * - Never logs invoice objects, profile data, bank, UPI, phone, or GST values.
 */

declare const __DEV__: boolean;

export const log = {
  debug: (...args: unknown[]) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (msg: string | Error) => {
    const message = msg instanceof Error ? msg.message : String(msg);
    // Print short message only, never any payload or sensitive info
    console.error(`[Error] ${message.split('\n')[0].slice(0, 150)}`);
  },
};
