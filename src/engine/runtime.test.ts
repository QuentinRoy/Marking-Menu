import { createModel } from '../model.js';
import { createRuntime } from './runtime.js';

const model = createModel({ items: [{ id: 'right', label: 'Right' }] });
const options = { movementsThreshold: 5, noviceDwellingTime: 300 };

const createFakeRenderer = () => ({
  render: vi.fn(),
  showFeedback: vi.fn(),
  dispose: vi.fn(),
});

/** Record every event the runtime emits, in order, by name. */
const recordEmitted = (
  runtime: ReturnType<typeof createRuntime<typeof model>>,
): string[] => {
  const emitted: string[] = [];
  for (const type of ['start', 'select', 'cancel'] as const) {
    runtime.on(type, (event) => {
      emitted.push(event.type);
    });
  }

  return emitted;
};

describe('createRuntime', () => {
  it('emits the events the machine produces, in order', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [100, 0] });

    expect(emitted).toEqual(['start', 'select']);
  });

  it('throws when sending an input after disposal, to surface implementation bugs', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });

    runtime.dispose();

    expect(() => {
      runtime.send({ type: 'pointer.down', position: [0, 0] });
    }).toThrow();
  });

  it('queues a re-entrant send from within a dispatched listener, and only processes it once the listener returns', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });

    let hasStartListenerReturned = false;
    let wasStartListenerDoneWhenSelectFired = false;

    runtime.on('start', () => {
      // Re-entrant: a listener synthesizing another input, exactly the
      // scenario https://github.com/QuentinRoy/Marking-Menu/issues/153's
      // "Reentrancy" section describes.
      runtime.send({ type: 'pointer.up', position: [100, 0] });
      hasStartListenerReturned = true;
    });
    runtime.on('select', () => {
      wasStartListenerDoneWhenSelectFired = hasStartListenerReturned;
    });

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(wasStartListenerDoneWhenSelectFired).toBe(true);
  });

  it('stops notifying a listener removed with off()', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });

    const started = vi.fn<() => void>();
    runtime.on('start', started);
    runtime.off('start', started);

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(started).not.toHaveBeenCalled();
  });

  it('dispose() is idempotent', () => {
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, renderer });

    runtime.dispose();
    runtime.dispose();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('emits cancel, not select, for a gesture with no movement at all', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [0, 0] });

    expect(emitted).toEqual(['start', 'cancel']);
  });

  it('emits cancel, not select, when the pointer is cancelled mid-gesture', () => {
    const runtime = createRuntime({
      model,
      options,
      renderer: createFakeRenderer(),
    });
    const emitted = recordEmitted(runtime);

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.move', position: [100, 0] });
    runtime.send({ type: 'pointer.cancel', position: [100, 0] });

    expect(emitted).toEqual(['start', 'cancel']);
  });

  it('shows the canceled feedback style for cancel, and the normal style for select', () => {
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, renderer });

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [100, 0] });
    expect(renderer.showFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ canceled: false }),
    );

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [0, 0] });
    expect(renderer.showFeedback).toHaveBeenLastCalledWith(
      expect.objectContaining({ canceled: true }),
    );
  });
});
