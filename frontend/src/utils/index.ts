import { LogInfo, LogError, LogDebug, LogWarning } from '@wailsjs/runtime/runtime';

export const Log = (...args: unknown[]): void => LogInfo(args.map(String).join(' '));
export const LogErr = (...args: unknown[]): void => LogError(args.map(String).join(' '));
export const LogDbg = (...args: unknown[]): void => LogDebug(args.map(String).join(' '));
export const LogWarn = (...args: unknown[]): void => LogWarning(args.map(String).join(' '));

export { matchesFilter, matchesNumericFilter, intersectFilter } from './filterHelpers';
export { getEntityPageURL, toggleEntityPageTab } from './navigation';
export { showValidationResult } from './validation';
export { generateTitlePageHTML } from './titlePageHTML';
export {
  generateCopyrightHTML,
  generateDedicationHTML,
  generateAcknowledgementsHTML,
  generateAboutAuthorHTML,
} from './bookPageHTML';

const HASH_COLORS = [
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
] as const;

export function hashColor(value: string | null | undefined, fallback = 'gray'): string {
  if (!value) return fallback;
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash = hash & hash;
  }
  return HASH_COLORS[Math.abs(hash) % HASH_COLORS.length];
}
