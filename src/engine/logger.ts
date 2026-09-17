import { noOp } from '../utils.js';

/**
 A logger, as accepted by {@link createMarkingMenu}. `error` is the only
 method anything in the library calls, so any object exposing it — `console`
 included — satisfies this type. `info`/`warn`/`debug` are accepted but
 ignored, so a fuller logger doesn't need to be stripped down first. Errors
 raised internally are always normalized to `Error` before reaching `error`,
 so a handler typed to expect an `Error` (rather than `unknown`) can be passed
 directly.
 */
export type MarkingMenuLogger = {
  error: (error: Error) => void;
  info?: unknown;
  warn?: unknown;
  debug?: unknown;
};

export const defaultLogger: MarkingMenuLogger = {
  error: console?.error?.bind(console) ?? noOp,
};
