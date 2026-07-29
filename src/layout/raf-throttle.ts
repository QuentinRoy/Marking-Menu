/** A `rafThrottle`d function, with a handle to cancel its pending frame. */
export type Throttled<Arguments extends readonly unknown[]> = {
  (...args: Arguments): void;
  /** Cancel the pending frame, if any. A no-op when none is scheduled. */
  cancel: () => void;
};

/**
 Throttle `fn` so that it runs at most once per animation frame.

 Calls made while a frame is already scheduled are coalesced: the frame runs
 `fn` once, with the arguments of the most recent call.

 @param fn - The function to throttle.
 @returns The throttled function, with a `cancel` method.
 */
export function rafThrottle<Arguments extends readonly unknown[]>(
  fn: (...args: Arguments) => void,
): Throttled<Arguments> {
  // The arguments and frame handle of the most recent call, while a frame is
  // scheduled. `null` when no frame is pending.
  let pending: { args: Arguments; frame: number } | null = null;

  function throttled(...args: Arguments): void {
    if (pending !== null) {
      pending.args = args;
      return;
    }

    // Captured in its own `const` so the callback below can read the latest
    // arguments without having to re-narrow the nullable `pending`.
    const scheduled = { args, frame: -1 };
    pending = scheduled;
    scheduled.frame = requestAnimationFrame(() => {
      pending = null;
      fn(...scheduled.args);
    });
  }

  throttled.cancel = () => {
    if (pending === null) {
      return;
    }

    cancelAnimationFrame(pending.frame);
    pending = null;
  };

  return throttled;
}
