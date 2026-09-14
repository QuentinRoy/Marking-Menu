// How many `fakeTimers()` scopes are currently open. A count rather than a
// single flag: it stays correct even if scopes are disposed out of
// creation order (e.g. a held-onto `Disposable` rather than `using`), not
// just for properly LIFO-nested ones.
let activeScopes = 0;

/**
 Fakes timers for the scope of the `using` declaration. Reentrant: nesting
 or overlapping calls only restore real timers once every scope that faked
 them has disposed, so an inner scope never pulls timers out from under an
 outer one still relying on them being faked.
 */
export const fakeTimers = (): Disposable => {
  activeScopes += 1;
  vi.useFakeTimers();
  let hasDisposed = false;
  return {
    [Symbol.dispose]() {
      if (hasDisposed) {
        return;
      }

      hasDisposed = true;
      activeScopes -= 1;
      if (activeScopes === 0) {
        vi.useRealTimers();
      }
    },
  };
};
