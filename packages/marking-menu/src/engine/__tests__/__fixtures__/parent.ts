import type { Point } from '../../../__tests__/__fixtures__/browser-menu.js';

// Leaves room on every side of the parent's corner for the gestures the
// engine suites draw from it, all inside the 800x600 viewport.
const origin = { x: 150, y: 250 };

/**
 A parent attached to the page at a fixed spot, so real input lands on it.
 Gestures are written relative to its top-left corner: `at` turns such a
 point into the page point input is sent to, and `client` into the
 `[x, y]` client position events report for it.
 */
export const createParent = () => {
  const parent = document.createElement('div');
  Object.assign(parent.style, {
    position: 'fixed',
    left: `${origin.x}px`,
    top: `${origin.y}px`,
    width: '500px',
    height: '300px',
  });
  document.body.append(parent);

  return {
    parent,
    at: (x: number, y: number): Point => ({
      x: origin.x + x,
      y: origin.y + y,
    }),
    client: (x: number, y: number): [number, number] => [
      origin.x + x,
      origin.y + y,
    ],
    [Symbol.dispose]() {
      parent.remove();
    },
  };
};
