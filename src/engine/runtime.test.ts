import type { MarkingMenuEvent } from '../events.js';
import { createModel } from '../model.js';
import type { AnyModelNode } from '../types.js';
import { createRuntime } from './runtime.js';

const model = createModel({ items: [{ id: 'right', label: 'Right' }] });
const options = { movementsThreshold: 5 };

const createFakeRenderer = () => ({
  render: vi.fn(),
  showFeedback: vi.fn(),
  dispose: vi.fn(),
});

/**
 A fake emit-only sink: records every emitted event, and lets a test attach a
 reaction per event type (a stand-in for a listener, since the sink itself
 does not fan out to multiple listeners).
 */
const createFakeSink = <M extends AnyModelNode>() => {
  const emitted: Array<MarkingMenuEvent<M>> = [];
  const reactions = new Map<string, () => void>();
  return {
    emitted,
    on(type: string, reaction: () => void): void {
      reactions.set(type, reaction);
    },
    emit(event: MarkingMenuEvent<M>): void {
      emitted.push(event);
      reactions.get(event.type)?.();
    },
  };
};

describe('createRuntime', () => {
  it('emits the events the machine produces, in order', () => {
    const target = createFakeSink();
    const runtime = createRuntime({
      model,
      options,
      target,
      renderer: createFakeRenderer(),
    });

    runtime.send({ type: 'pointer.down', position: [0, 0] });
    runtime.send({ type: 'pointer.up', position: [100, 0] });

    expect(target.emitted.map((event) => event.type)).toEqual([
      'start',
      'select',
    ]);
  });

  it('throws when sending an input after disposal, to surface implementation bugs', () => {
    const target = createFakeSink();
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
    const target = createFakeSink();
    const runtime = createRuntime({
      model,
      options,
      target,
      renderer: createFakeRenderer(),
    });

    let hasStartListenerReturned = false;
    let wasStartListenerDoneWhenSelectFired = false;

    target.on('start', () => {
      // Re-entrant: a listener synthesizing another input, exactly the
      // scenario https://github.com/QuentinRoy/Marking-Menu/issues/153's
      // "Reentrancy" section describes.
      runtime.send({ type: 'pointer.up', position: [100, 0] });
      hasStartListenerReturned = true;
    });
    target.on('select', () => {
      wasStartListenerDoneWhenSelectFired = hasStartListenerReturned;
    });

    runtime.send({ type: 'pointer.down', position: [0, 0] });

    expect(wasStartListenerDoneWhenSelectFired).toBe(true);
  });

  it('dispose() is idempotent', () => {
    const target = createFakeSink();
    const renderer = createFakeRenderer();
    const runtime = createRuntime({ model, options, target, renderer });

    runtime.dispose();
    runtime.dispose();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
});
