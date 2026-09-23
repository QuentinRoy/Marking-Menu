// JSDOM doesn't implement the CSS Shadow Parts API
// (https://github.com/jsdom/jsdom/issues/3335), so `Element.prototype.part`
// is undefined under test even though every real browser has it. Real
// browsers return a live `DOMTokenList`; the codebase only ever calls
// `.toggle()` on it, so this reflects just that against the `part`
// attribute instead of implementing the full interface.
if (!('part' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'part', {
    configurable: true,
    get(this: Element): DOMTokenList {
      return {
        toggle: (token: string, shouldBePresent?: boolean): boolean => {
          const tokens = new Set(
            (this.getAttribute('part') ?? '').split(' ').filter(Boolean),
          );
          const isPresent = shouldBePresent ?? !tokens.has(token);
          if (isPresent) {
            tokens.add(token);
          } else {
            tokens.delete(token);
          }

          this.setAttribute('part', [...tokens].join(' '));
          return isPresent;
        },
      } as unknown as DOMTokenList;
    },
  });
}

// JSDOM doesn't implement `matchMedia` at all. `indicator.ts` only reads
// `.matches`, and the unit project never emulates `prefers-reduced-motion`,
// so a fixed "never matches" stand-in is enough; the browser project has
// the real thing.
if (typeof globalThis.matchMedia !== 'function') {
  Object.defineProperty(globalThis, 'matchMedia', {
    configurable: true,
    value(query: string): MediaQueryList {
      const result: Pick<MediaQueryList, 'matches' | 'media'> = {
        matches: false,
        media: query,
      };
      return result as MediaQueryList;
    },
  });
}

// JSDOM doesn't implement pointer capture either. Nothing is ever captured
// under it, so an element that is asked always has nothing to release.
// `createParent` in `src/engine/__fixtures__/pointer.ts` stubs a stateful
// version on the one element tests actually capture to.
if (!('hasPointerCapture' in Element.prototype)) {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
  });
}
