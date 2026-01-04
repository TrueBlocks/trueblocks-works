import { LogInfo, LogError, LogDebug, LogWarning } from '@wailsjs/runtime/runtime';

export const Log = (...args: unknown[]): void => LogInfo(args.map(String).join(' '));
export const LogErr = (...args: unknown[]): void => LogError(args.map(String).join(' '));
export const LogDbg = (...args: unknown[]): void => LogDebug(args.map(String).join(' '));
export const LogWarn = (...args: unknown[]): void => LogWarning(args.map(String).join(' '));
