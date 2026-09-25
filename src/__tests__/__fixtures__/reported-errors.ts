/**
 The browser reports an error a listener throws instead of letting it
 escape the dispatch, and Vitest fails the test on any error reported that
 way unless the test listens for them itself. This does, and keeps them.
 */
export const catchReportedErrors = () => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    errors.push(event.error);
  };

  globalThis.addEventListener('error', onError);
  return {
    errors,
    [Symbol.dispose]() {
      globalThis.removeEventListener('error', onError);
    },
  };
};
