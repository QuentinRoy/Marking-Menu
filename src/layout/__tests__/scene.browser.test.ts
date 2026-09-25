import type { Point } from '../../utils.js';
import { createScene } from '../scene.js';

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
  Object.assign(parent.style, {
    position: 'fixed',
    left: '200px',
    top: '50px',
    width: '100px',
    height: '100px',
  });
  document.body.append(parent);
  const host = document.createElement('div');
  parent.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const scene = createScene({ root, parent });
  return {
    parent,
    host,
    root,
    scene,
    setLeft(value: number) {
      parent.style.left = `${value}px`;
    },
    [Symbol.dispose]() {
      scene.dispose();
      parent.remove();
    },
  };
};

describe('scene', () => {
  it('creates one slot per layer, once, in paint order', () => {
    using fixture = setUp();
    const { root } = fixture;

    const slots = [...root.querySelectorAll<HTMLElement>('[data-slot]')];
    expect(slots.map((slot) => slot.dataset.slot)).toEqual([...slotNames]);
    for (const slot of slots) {
      expect(slot.localName).toBe('div');
      expect(slot.classList.contains('marking-menu-slot')).toBe(true);
    }
  });

  it('exposes each slot by name', () => {
    using fixture = setUp();
    const { root, scene } = fixture;

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
  });

  it('converts client points to parent coordinates', () => {
    using fixture = setUp();
    const { scene } = fixture;

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
  });

  it('reads the parent rect late, on every call', () => {
    using fixture = setUp();
    const { scene, setLeft } = fixture;

    expect(scene.toLocal([220, 60])).toEqual([20, 10]);
    setLeft(210);
    expect(scene.toLocal([220, 60])).toEqual([10, 10]);
  });

  it('reads the parent rect once per batch', () => {
    using fixture = setUp();
    const { parent, scene } = fixture;
    const read = vi.spyOn(parent, 'getBoundingClientRect');

    const local = scene.toLocalMany([
      [220, 60],
      [260, 90],
      [300, 100],
    ]);

    expect(local).toEqual([
      [20, 10],
      [60, 40],
      [100, 50],
    ]);
    expect(read).toHaveBeenCalledOnce();
  });

  it('removes its slots on dispose', () => {
    using fixture = setUp();
    const { root, scene } = fixture;

    scene.dispose();

    expect(root.querySelectorAll('[data-slot]')).toHaveLength(0);
  });
});
