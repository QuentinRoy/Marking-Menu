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
