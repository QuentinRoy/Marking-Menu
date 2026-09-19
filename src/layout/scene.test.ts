import type { Point } from '../utils.js';
import { createScene } from './scene.js';

const slotNames = [
  'lower',
  'menu',
  'indicator-background',
  'upper',
  'indicator-dot',
  'feedback',
] as const;

const setUp = () => {
  const parent = document.createElement('div');
  document.body.append(parent);
  const host = document.createElement('div');
  parent.append(host);
  const root = host.attachShadow({ mode: 'open' });
  let left = 200;
  parent.getBoundingClientRect = () =>
    ({ left, top: 50 }) as unknown as DOMRect;
  const scene = createScene({ root, parent });
  return {
    parent,
    host,
    root,
    scene,
    setLeft(value: number) {
      left = value;
    },
    tearDown() {
      scene.dispose();
      parent.remove();
    },
  };
};

describe('scene', () => {
  it('creates one slot per layer, once, in paint order', () => {
    const { root, tearDown } = setUp();

    const slots = [...root.querySelectorAll<HTMLElement>('[data-slot]')];
    expect(slots.map((slot) => slot.dataset.slot)).toEqual([...slotNames]);
    for (const slot of slots) {
      expect(slot.localName).toBe('div');
      expect(slot.classList.contains('marking-menu-slot')).toBe(true);
      expect(slot.style.display).toBe('contents');
    }

    tearDown();
  });

  it('exposes each slot by name', () => {
    const { root, scene, tearDown } = setUp();

    expect(scene.slots.lower.dataset.slot).toBe('lower');
    expect(scene.slots.menu.dataset.slot).toBe('menu');
    expect(scene.slots.indicatorBackground.dataset.slot).toBe(
      'indicator-background',
    );
    expect(scene.slots.upper.dataset.slot).toBe('upper');
    expect(scene.slots.indicatorDot.dataset.slot).toBe('indicator-dot');
    expect(scene.slots.feedback.dataset.slot).toBe('feedback');
    for (const slot of Object.values(scene.slots)) {
      expect(slot.parentNode).toBe(root);
    }

    tearDown();
  });

  it('converts client points to parent coordinates', () => {
    const { scene, tearDown } = setUp();

    const point: Point = [220, 60];
    expect(scene.toLocal(point)).toEqual([20, 10]);
    expect(
      scene.toLocalMany([
        [220, 60],
        [260, 90],
      ]),
    ).toEqual([
      [20, 10],
      [60, 40],
    ]);
    tearDown();
  });

  it('reads the parent rect late, on every call', () => {
    const { scene, setLeft, tearDown } = setUp();

    expect(scene.toLocal([220, 60])).toEqual([20, 10]);
    setLeft(210);
    expect(scene.toLocal([220, 60])).toEqual([10, 10]);
    tearDown();
  });

  it('removes its slots on dispose', () => {
    const { root, scene, parent } = setUp();

    scene.dispose();

    expect(root.querySelectorAll('[data-slot]')).toHaveLength(0);
    parent.remove();
  });
});
