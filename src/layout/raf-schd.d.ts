// The `raf-schd` package does not ship type declarations.
declare module 'raf-schd' {
  type ThrottledFunction<Arguments extends readonly unknown[]> = ((
    ...args: Arguments
  ) => void) & {
    cancel: () => void;
  };

  // eslint-disable-next-line import-x/no-default-export -- This is a third-party module, we do not control its export structure.
  export default function rafSchd<Arguments extends readonly unknown[]>(
    fn: (...args: Arguments) => void,
  ): ThrottledFunction<Arguments>;
}
