import { noOp } from '../utils.js';

/**
 A logger, as accepted by {@link createMarkingMenu}. Every method is
 optional: omit `error` and internal failures fall back to
 `console.error`; `info`/`warn`/`debug` are accepted but ignored, typed as
 `(message: string) => void` rather than `unknown` so the library can
 start calling them later without forcing every caller to widen their
 logger's type first. Errors raised internally are always normalized to
 `Error` before reaching `error`, so a handler typed to expect an `Error`
 (rather than `unknown`) can be passed directly.
 */
export type MarkingMenuLogger = {
  error?: (error: Error) => void;
  info?: (message: string) => void;
  warn?: (message: string) => void;
  debug?: (message: string) => void;
};

/**
A logger with its `error` fallback already resolved, as every consumer
downstream of {@link resolveEngineOptions} receives it.
*/
export type ResolvedLogger = MarkingMenuLogger & {
  error: (error: Error) => void;
};

export const defaultLogger: ResolvedLogger = {
  error: console?.error?.bind(console) ?? noOp,
};
