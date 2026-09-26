import { emitNativeConsoleDiagnostic } from '../utils/ios-native-diagnostic.ts';

/** Retire one failed owner and report once; never called on a healthy frame. */
export function retireFailedSpecialTickerOwner(family: string, error: unknown, retire: () => void): void {
  let cleanupError: unknown;
  try { retire(); } catch (failure) { cleanupError = failure; }
  const describe = (value: unknown): string => {
    try { return String(value instanceof Error ? value.stack || value.message : value).slice(0, 1200); }
    catch { return 'unreadable error'; }
  };
  emitNativeConsoleDiagnostic('[CC_SPECIAL_TICKER]', 'owner-retired', {
    family,
    error: describe(error),
    ...(cleanupError === undefined ? {} : { cleanupError: describe(cleanupError) }),
  });
}
