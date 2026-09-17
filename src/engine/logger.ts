import { noOp } from '../utils.js';

/**
 A logger, as accepted by {@link createMarkingMenu}. `error` is the only
 method anything in the library calls, so any object exposing it, `console`
 included, satisfies this type. `info`/`warn`/`debug` are accepted but
 ignored, typed as `(message: string) => void` rather than `unknown` so the
 library can start calling them later without forcing every caller to widen
 their logger's type first. Errors raised internally are always normalized
 to `Error` before reaching `error`, so a handler typed to expect an `Error`
 (rather than `unknown`) can be passed directly.
 */
export type MarkingMenuLogger = {
  error: (error: Error) => void;
  info?: (message: string) => void;
  warn?: (message: string) => void;
  debug?: (message: string) => void;
};

export const defaultLogger: MarkingMenuLogger = {
  error: console?.error?.bind(console) ?? noOp,
};
