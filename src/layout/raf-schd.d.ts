// The `raf-schd` package does not ship type declarations.
declare module 'raf-schd' {
  type ThrottledFunction<Arguments extends readonly unknown[]> = ((
    ...args: Arguments
  ) => void) & {
    cancel: () => void;
  };

  export default function rafSchd<Arguments extends readonly unknown[]>(
    fn: (...args: Arguments) => void,
  ): ThrottledFunction<Arguments>;
}
