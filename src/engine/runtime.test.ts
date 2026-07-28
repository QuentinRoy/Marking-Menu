import { createModel } from '../model.js';
import { createRuntime } from './runtime.js';

const model = createModel({ items: [{ id: 'right', label: 'Right' }] });
const options = { movementsThreshold: 5 };

const createFakeRenderer = () => ({
  render: vi.fn(),
  showFeedback: vi.fn(),
  dispose: vi.fn(),
});

describe('createRuntime', () => {
  it('throws when sending an input after disposal, to surface implementation bugs', () => {
    const target = new EventTarget();
    const runtime = createRuntime({
      model,
      options,
      target,
      renderer: createFakeRenderer(),
    });

    runtime.dispose();

    expect(() => {
      runtime.send({ type: 'pointer.down', position: [0, 0] });
    }).toThrow();
  });

  it('queues a re-entrant send from within a dispatched listener, and only processes it once the listener returns', () => {
    const target = new EventTarget();
    const runtime = createRuntime({
      model,
      options,
      target,
      renderer: createFakeRenderer(),
    });

    let hasStartListenerReturned = false;
    let wasStartListenerDoneWhenSelectFired = false;

    target.addEventListener('start', () => {
      // Re-entrant: a listener synthesizing another input, exactly the
      // scenario https://github.com/QuentinRoy/Marking-Menu/issues/153's
      // "Reentrancy" section describes.
      runtime.send({ type: 'pointer.up', position: [100, 0] });
      hasStartListenerReturned = true;
    });
    target.addEventListener('select', () => {
      wasStartListenerDoneWhenSelectFired = hasStartListenerReturned;
    });

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(wasStartListenerDoneWhenSelectFired).toBe(true);
  });

  it('dispose() is idempotent', () => {
    const target = new EventTarget();
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, target, renderer });

    runtime.dispose();
    runtime.dispose();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
