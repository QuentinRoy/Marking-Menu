/**
 Throttle `fn` so that it runs at most once per animation frame.

 Calls made while a frame is already scheduled are coalesced: the frame runs
 `fn` once, with the arguments of the most recent call.

 @param fn - The function to throttle.
 @returns The throttled function.
 */
export function rafThrottle<Arguments extends readonly unknown[]>(
  fn: (...args: Arguments) => void,
): (...args: Arguments) => void {
  // The arguments of the most recent call, while a frame is scheduled. `null`
  // when no frame is pending.
  let pending: { args: Arguments } | null = null;

  return (...args: Arguments) => {
    if (pending !== null) {
      pending.args = args;
      return;
    }

    // Captured in its own `const` so the callback below can read the latest
    // arguments without having to re-narrow the nullable `pending`.
    const scheduled = { args };
    pending = scheduled;
    requestAnimationFrame(() => {
      pending = null;
      fn(...scheduled.args);
    });
  };
}
