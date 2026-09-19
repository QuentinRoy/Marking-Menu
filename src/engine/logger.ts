import { noOp } from '../utils.js';

/**
 A logger, as accepted by {@link createMarkingMenu}. Only `error` is called:
 omit it and internal failures fall back to `console.error`. Errors raised
 internally are always normalized to `Error` before reaching `error`, so a
 handler typed to expect an `Error` (rather than `unknown`) can be passed
 directly.
 */
export type MarkingMenuLogger = {
  error?: (error: Error) => void;
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
