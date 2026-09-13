export const fakeTimers = (): Disposable => {
  vi.useFakeTimers();
  return {
    [Symbol.dispose]() {
      vi.useRealTimers();
    },
  };
};
