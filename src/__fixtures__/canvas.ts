import { vi } from 'vitest';

/*
 JSDOM has no real canvas 2D context (the `canvas` package isn't a
 dependency), so every test that draws to a canvas needs one stubbed in. This
 fixture is shared by every test file that does: `src/layout/stroke.test.ts`,
 `src/engine/renderer.test.ts` and `src/engine/controller.test.ts`.

 `vi` is imported rather than used as the ambient test global: this file
 isn't a `*.test.ts` entry point matched by `tsconfig.test.json`, so
 `vitest/globals`' augmentation isn't in scope here.
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
  // Drawing state a 2D context normally exposes as properties, not method
  // calls: readable directly after a draw, rather than recovered from
  // `methodCalls`.
  strokeStyle?: string;
  fillStyle?: string;
  lineWidth?: number;
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

/**
 Give every canvas created while held a recording 2D context.

 `vi.spyOn`'s return value is natively `Disposable`: disposal calls
 `mockRestore()`, which puts `document.createElement` back.
 */
export const stubbedCanvasContexts = (): Disposable => {
  // Captured unbound, ahead of the spy, so the mock implementation below can
  // still call through to the real `createElement`.
  const original = doc.createElement;
  return vi
    .spyOn(doc, 'createElement')
    .mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const elt = original.call(document, tag, options);
      if (tag === 'canvas') {
        const context = createMockContext();
        (elt as HTMLCanvasElement).getContext = (() =>
          context) as unknown as HTMLCanvasElement['getContext'];
      }

      return elt;
    });
};

export const fakeTimers = (): Disposable => {
  vi.useFakeTimers();
  return {
    [Symbol.dispose]() {
      vi.useRealTimers();
    },
  };
};

/**
Read the mock 2D context of a canvas.
*/
export const canvasContext = (canvas: HTMLCanvasElement): MockContext =>
  (canvas.getContext as unknown as () => MockContext)();

/**
Read the mock 2D context of the first canvas under `parent`.
*/
export const queryCanvasContext = (parent: HTMLElement): MockContext => {
  const canvas = parent.querySelector('canvas');
  if (canvas === null) {
    throw new Error('No canvas was rendered under the parent.');
  }

  return canvasContext(canvas);
};
