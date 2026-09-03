import type { MarkingMenuEventEmitter } from '../events.js';
import type { AnyModelNode } from '../types.js';
import type { LayoutView } from './layout-view.js';
import {
  navigationMachine,
  type NavigationInput,
  type NavigationOptions,
} from './machine.js';
import type { LayoutRenderer } from './renderer.js';

/**
All an input source needs of the runtime: no events, no model.
*/
export type NavigationInputSink = {
  send: (input: NavigationInput) => void;
};

/**
 The runtime owns the emitter: interpreting the machine's public outputs is
 the only thing that ever originates an event.
 */
export type NavigationRuntime<M extends AnyModelNode> = NavigationInputSink &
  MarkingMenuEventEmitter<M> & {
    dispose: () => void;
  };

const publicOutputs = [
  'start',
  'move',
  'open',
  'change',
  'select',
  'cancel',
] as const;

/**
 The runtime owns mutable infrastructure only: starting the host, forwarding
 its outputs, and disposal ordering. It never makes domain decisions: those
 live in `navigationMachine`.

 A consumer listener is never a totorobot `on` listener: a throwing `on`
 listener propagates out of the `emit` call and interrupts the action that
 raised it mid-setup, so every public output is re-announced through a plain
 `EventTarget`, whose `dispatchEvent` absorbs a throwing listener instead.
 */
export function createRuntime<M extends AnyModelNode>({
  model,
  options,
  renderer,
}: {
  model: M;
  options: NavigationOptions;
  renderer: LayoutRenderer<M>;
}): NavigationRuntime<M> {
  const target = new EventTarget();
  // One registration per (type, listener) pair, in registration order, so
  // `off` removes exactly the one `addEventListener` call `on` made for it —
  // mirroring mitt's own on/off contract, which the public API is typed
  // against.
  const registrations = new Map<
    string,
    Array<{ listener: (event: never) => void; wrapper: EventListener }>
  >();

  const host = navigationMachine.start({ deps: { model, options } });

  const offLayout = host.on('layout', ({ data }) => {
    renderer.render(data as unknown as LayoutView<M>);
  });
  const offFeedback = host.on('feedback', ({ data }) => {
    renderer.showFeedback(data);
  });
  const offPublic = publicOutputs.map((name) =>
    host.on(name, ({ data }) => {
      target.dispatchEvent(new CustomEvent(name, { detail: data }));
    }),
  );

  let isDisposed = false;

  const send = (input: NavigationInput): void => {
    if (isDisposed) {
      throw new Error('Cannot send an input to a disposed controller.');
    }

    switch (input.type) {
      case 'pointer.down': {
        host.send('down', { position: input.position });
        break;
      }

      case 'pointer.move': {
        host.send('move', { position: input.position });
        break;
      }

      case 'pointer.up': {
        host.send('up', { position: input.position });
        break;
      }

      case 'pointer.cancel': {
        host.send('cancel', { position: input.position });
        break;
      }
    }
  };

  const on = (type: string, listener: (event: never) => void): void => {
    const wrapper: EventListener = (event) => {
      listener((event as CustomEvent).detail as never);
    };

    const list = registrations.get(type) ?? [];
    list.push({ listener, wrapper });
    registrations.set(type, list);
    target.addEventListener(type, wrapper);
  };

  const off = (type: string, listener: (event: never) => void): void => {
    const list = registrations.get(type);
    if (list === undefined) {
      return;
    }

    const index = list.findIndex(
      (registration) => registration.listener === listener,
    );
    if (index === -1) {
      return;
    }

    const [removed] = list.splice(index, 1);
    if (removed !== undefined) {
      target.removeEventListener(type, removed.wrapper);
    }
  };

  const dispose = (): void => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    offLayout();
    offFeedback();
    for (const unsubscribe of offPublic) {
      unsubscribe();
    }

    // Unsubscribed first, so this can never reach a listener: the machine
    // still runs its own teardown and wildcard actions, but nothing is left
    // to announce them to, and nothing renders during teardown.
    host.send('dispose');
    renderer.dispose();
  };

  return {
    send,
    dispose,
    on,
    off,
  };
}
