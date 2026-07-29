/*
 The library's own types deliberately expose `dispose()` and nothing else, so
 consumers are never asked to have `using` (see `controller.ts`). Tests run on
 the pinned dev Node and are free to use it, so this adapts anything with a
 `dispose()` to the protocol `using` needs.
 */

/**
 Hold `value` for the current scope, calling its `dispose()` on the way out.

 Attaches the key to `value` itself rather than to a copy: the things worth
 holding are class instances, and spreading one would leave its prototype
 methods behind.
 */
export const held = <T extends { dispose: () => void }>(
  value: T,
): T & Disposable =>
  Object.assign(value, {
    [Symbol.dispose]() {
      value.dispose();
    },
  });
