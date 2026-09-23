import { createParent, pointer } from './__fixtures__/pointer.js';
import type { NavigationInput, NavigationPhase } from './machine.js';
import { createStandalonePointerSource } from './standalone-pointer-source.js';

/**
 A parent holding a standalone menu layer of two items, plus something
 outside it: a submenu item (a plate wrapping a label) and a leaf next to
 it, the way the renderer lays a level out.
 */
const createFixture = (phase: NavigationPhase = 'standalone') => {
  const parent = createParent();
  const layer = document.createElement('div');
  const submenu = document.createElement('div');
  submenu.className = 'marking-menu-item';
  submenu.dataset.itemId = 'submenu-key';
  const plate = document.createElement('div');
  plate.className = 'marking-menu-plate';
  const label = document.createElement('div');
  label.className = 'marking-menu-label';
  plate.append(label);
  submenu.append(plate);
  const leaf = document.createElement('div');
  leaf.className = 'marking-menu-item';
  leaf.dataset.itemId = 'leaf-key';
  layer.append(submenu, leaf);
  const outside = document.createElement('button');
  parent.append(layer, outside);
  document.body.append(parent);

  const send = vi.fn<(input: NavigationInput) => void>();
  const runtime = { phase, send };
  const source = createStandalonePointerSource({
    parent,
    getMenu: () => ({ layer }),
    runtime,
  });
  return {
    parent,
    layer,
    submenu,
    label,
    leaf,
    outside,
    send,
    source,
    setPhase(next: NavigationPhase) {
      runtime.phase = next;
    },
    [Symbol.dispose]() {
      source.dispose();
      parent.remove();
    },
  };
};

describe('createStandalonePointerSource', () => {
  it('sends a move with the item key under the pointer on hover', () => {
    using fixture = createFixture();

    fixture.leaf.dispatchEvent(
      pointer('pointermove', { clientX: 3, clientY: 4 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.move',
      position: [3, 4],
      itemKey: 'leaf-key',
    });
  });

  it('resolves the item key from a descendant, such as the label inside a plate', () => {
    using fixture = createFixture();

    fixture.label.dispatchEvent(
      pointer('pointermove', { clientX: 1, clientY: 1 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.move',
      position: [1, 1],
      itemKey: 'submenu-key',
    });
  });

  it('sends an undefined item key hovering the layer outside any item', () => {
    using fixture = createFixture();

    fixture.layer.dispatchEvent(
      pointer('pointermove', { clientX: 5, clientY: 5 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.move',
      position: [5, 5],
      itemKey: undefined,
    });
  });

  it('sends a move for contact-down, the same as a hover preview', () => {
    using fixture = createFixture();

    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.move',
      position: [0, 0],
      itemKey: 'leaf-key',
    });
  });

  it('sends an activate for a release, with the item key currently under it', () => {
    using fixture = createFixture();
    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    fixture.send.mockClear();

    fixture.submenu.dispatchEvent(
      pointer('pointerup', { pointerId: 1, clientX: 9, clientY: 9 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.activate',
      position: [9, 9],
      itemKey: 'submenu-key',
    });
  });

  it('ignores a release from a pointer that never went down', () => {
    using fixture = createFixture();

    fixture.leaf.dispatchEvent(
      pointer('pointerup', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('ignores a secondary or non-primary contact', () => {
    using fixture = createFixture();

    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { isPrimary: false, clientX: 0, clientY: 0 }),
    );
    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { button: 2, clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('ignores a concurrent second contact while the first is still down', () => {
    using fixture = createFixture();
    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    fixture.send.mockClear();

    fixture.submenu.dispatchEvent(
      pointer('pointerdown', { pointerId: 2, clientX: 0, clientY: 0 }),
    );
    fixture.submenu.dispatchEvent(
      pointer('pointerup', { pointerId: 2, clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('sends a cancel for a canceled contact, with its position', () => {
    using fixture = createFixture();
    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    fixture.send.mockClear();

    fixture.leaf.dispatchEvent(
      pointer('pointercancel', { pointerId: 1, clientX: 7, clientY: 8 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.cancel',
      position: [7, 8],
    });
  });

  it('sends an outside press for a primary press outside the menu layer', () => {
    using fixture = createFixture();

    fixture.outside.dispatchEvent(
      pointer('pointerdown', { clientX: 2, clientY: 3 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.outside',
      position: [2, 3],
    });
  });

  it('does not send both a move and an outside press for the same inside press', () => {
    using fixture = createFixture();

    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: 'standalonePointer.move' }),
    );
  });

  it('ignores everything unless a standalone menu is open', () => {
    using fixture = createFixture('novice');

    fixture.leaf.dispatchEvent(
      pointer('pointermove', { clientX: 0, clientY: 0 }),
    );
    fixture.outside.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('follows the phase as it changes', () => {
    using fixture = createFixture('idle');

    fixture.leaf.dispatchEvent(
      pointer('pointermove', { clientX: 0, clientY: 0 }),
    );
    fixture.setPhase('standalone');
    fixture.leaf.dispatchEvent(
      pointer('pointermove', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).toHaveBeenCalledTimes(1);
  });

  it('stops listening once disposed', () => {
    using fixture = createFixture();
    fixture.source.dispose();

    fixture.leaf.dispatchEvent(
      pointer('pointermove', { clientX: 0, clientY: 0 }),
    );
    fixture.outside.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('does not mistake an inside press for an outside one when parent lives inside a shadow root', () => {
    using fixture = createFixture();
    const shadowHost = document.createElement('div');
    document.body.append(shadowHost);
    // A listener outside a shadow tree (the document-level outside-press
    // one below) sees a retargeted `.target` on any event from inside it,
    // so this only proves anything once `parent` itself is nested that way.
    shadowHost.attachShadow({ mode: 'open' }).append(fixture.parent);

    fixture.leaf.dispatchEvent(
      pointer('pointerdown', { clientX: 0, clientY: 0 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.move',
      position: [0, 0],
      itemKey: 'leaf-key',
    });
  });

  it('still sends an outside press for a genuinely outside one when parent lives inside a shadow root', () => {
    using fixture = createFixture();
    const shadowHost = document.createElement('div');
    document.body.append(shadowHost);
    shadowHost.attachShadow({ mode: 'open' }).append(fixture.parent);
    const trulyOutside = document.createElement('button');
    document.body.append(trulyOutside);

    trulyOutside.dispatchEvent(
      pointer('pointerdown', { clientX: 9, clientY: 9 }),
    );

    expect(fixture.send).toHaveBeenCalledExactlyOnceWith({
      type: 'standalonePointer.outside',
      position: [9, 9],
    });
  });

  it('never takes gesture capture, prevents nothing, and never touches touch-action', () => {
    using fixture = createFixture();

    const down = pointer('pointerdown', {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      cancelable: true,
    });
    fixture.leaf.dispatchEvent(down);

    expect(down.defaultPrevented).toBe(false);
    expect(fixture.parent.hasPointerCapture(1)).toBe(false);
    expect(fixture.parent.style.getPropertyValue('touch-action')).toBe('');
  });
});
