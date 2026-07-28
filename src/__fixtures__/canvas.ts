import { vi } from 'vitest';

/*
 JSDOM has no real canvas 2D context (the `canvas` package isn't a
 dependency), so every test that draws to a canvas needs one stubbed in. This
 fixture is shared by every test file that does: `src/layout/stroke.test.ts`,
 `src/engine/renderer.test.ts` and `src/engine/controller.test.ts`.

 `vi` is imported explicitly (rather than relied on as the ambient test
 global) because this file itself isn't a `*.test.ts` entry point matched by
 `tsconfig.test.json`, so the global augmentation from `vitest/globals` isn't
 in scope here.
 */

/*
 `document.createElement`'s typings include a deprecated overload. Alias the
 document through a minimal, non-deprecated shape so overriding the method
 does not reference that overload.
 */
const doc = document as unknown as {
  createElement: (tag: string, options?: ElementCreationOptions) => HTMLElement;
};

export type MockContext = {
  mock: {
    methodCalls: Array<{ method: string | symbol; args: readonly unknown[] }>;
  };
};

const createMockContext = (): MockContext => {
  const target: MockContext = { mock: { methodCalls: [] } };
  return new Proxy(target, {
    get(t, name) {
      return Object.hasOwn(t, name)
        ? (t as Record<string | symbol, unknown>)[name]
        : (...args: unknown[]) => {
            t.mock.methodCalls.push({ method: name, args });
          };
    },
  });
};

/** Give every canvas created while held a recording 2D context. */
export const stubbedCanvasContexts = (): Disposable => {
  // Kept unbound so disposal restores the exact original method, rather than
  // leaving a bound copy of it behind on `document`.
  const original = doc.createElement;
  doc.createElement = vi.fn((tag: string, options?: ElementCreationOptions) => {
    const elt = original.call(document, tag, options);
    if (tag === 'canvas') {
      const context = createMockContext();
      (elt as HTMLCanvasElement).getContext = (() =>
        context) as unknown as HTMLCanvasElement['getContext'];
    }

    return elt;
  });
  return {
    [Symbol.dispose]() {
      doc.createElement = original;
    },
  };
};

export const fakeTimers = (): Disposable => {
  vi.useFakeTimers();
  return {
    [Symbol.dispose]() {
      vi.useRealTimers();
    },
  };
};

/** Read the mock 2D context of the first canvas under `parent`. */
export const queryCanvasContext = (parent: HTMLElement): MockContext =>
  (
    parent.querySelector('canvas')?.getContext as unknown as () => MockContext
  )();
