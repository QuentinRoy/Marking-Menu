import {
  BehaviorSubject,
  connectable,
  Observable,
  Subject,
  type Subscription,
} from 'rxjs';
import {
  createPointerNotification,
  type PointerNotification,
} from './pointer-events.js';

type TouchActionState = {
  count: number;
  priority: string;
  value: string;
};

const touchActionStates = new WeakMap<HTMLElement, TouchActionState>();

const disableTouchAction = (rootDOM: HTMLElement): (() => void) => {
  const currentState = touchActionStates.get(rootDOM);
  if (currentState) {
    currentState.count += 1;
  } else {
    touchActionStates.set(rootDOM, {
      count: 1,
      priority: rootDOM.style.getPropertyPriority('touch-action'),
      value: rootDOM.style.getPropertyValue('touch-action'),
    });
    rootDOM.style.setProperty('touch-action', 'none', 'important');
  }

  return () => {
    const state = touchActionStates.get(rootDOM);
    if (!state) {
      return;
    }

    state.count -= 1;
    if (state.count > 0) {
      return;
    }

    touchActionStates.delete(rootDOM);
    if (
      rootDOM.style.getPropertyValue('touch-action') !== 'none' ||
      rootDOM.style.getPropertyPriority('touch-action') !== 'important'
    ) {
      return;
    }

    if (state.value === '') {
      rootDOM.style.removeProperty('touch-action');
    } else {
      rootDOM.style.setProperty('touch-action', state.value, state.priority);
    }
  };
};

type ActiveDrag = {
  connection: Subscription;
  events$: Subject<PointerNotification<PointerEvent>>;
  last: PointerNotification<PointerEvent>;
  pointerId: number;
};

/**
 Observe primary Pointer Event drags on a DOM element.

 The emitted drag observables are connected eagerly and replay their latest
 position while active.
 */
export const pointerDrags = (
  rootDOM: HTMLElement,
): Observable<Observable<PointerNotification<PointerEvent>>> =>
  new Observable((subscriber) => {
    let active: ActiveDrag | undefined;
    const restoreTouchAction = disableTouchAction(rootDOM);

    const releaseCapture = (pointerId: number) => {
      try {
        if (rootDOM.hasPointerCapture(pointerId)) {
          rootDOM.releasePointerCapture(pointerId);
        }
      } catch {
        // Capture may already have been released by the browser.
      }
    };

    const finish = (
      notification?: PointerNotification<PointerEvent>,
      shouldRelease = true,
    ) => {
      const finished = active;
      if (!finished) {
        return;
      }

      active = undefined;
      if (notification) {
        finished.events$.next(notification);
      }

      finished.events$.complete();
      finished.connection.unsubscribe();
      if (shouldRelease) {
        releaseCapture(finished.pointerId);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (active !== undefined || !event.isPrimary || event.button !== 0) {
        return;
      }

      try {
        rootDOM.setPointerCapture(event.pointerId);
      } catch (error) {
        subscriber.error(error);
        return;
      }

      const first = createPointerNotification(event);
      const events$ = new Subject<PointerNotification<PointerEvent>>();
      const drag$ = connectable(events$, {
        connector: () => new BehaviorSubject(first),
        resetOnDisconnect: false,
      });
      const connection = drag$.connect();
      active = {
        connection,
        events$,
        last: first,
        pointerId: event.pointerId,
      };
      subscriber.next(drag$);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== active?.pointerId) {
        return;
      }

      const notification = createPointerNotification(event);
      active.last = notification;
      active.events$.next(notification);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== active?.pointerId) {
        return;
      }

      finish(createPointerNotification(event));
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== active?.pointerId) {
        return;
      }

      finish({ ...createPointerNotification(event), canceled: true });
    };

    const onLostPointerCapture = (event: PointerEvent) => {
      if (event.pointerId !== active?.pointerId) {
        return;
      }

      finish(
        {
          ...active.last,
          canceled: true,
          originalEvent: event,
          timeStamp: event.timeStamp,
        },
        false,
      );
    };

    rootDOM.addEventListener('pointerdown', onPointerDown);
    rootDOM.addEventListener('pointermove', onPointerMove);
    rootDOM.addEventListener('pointerup', onPointerUp);
    rootDOM.addEventListener('pointercancel', onPointerCancel);
    rootDOM.addEventListener('lostpointercapture', onLostPointerCapture);

    return () => {
      rootDOM.removeEventListener('pointerdown', onPointerDown);
      rootDOM.removeEventListener('pointermove', onPointerMove);
      rootDOM.removeEventListener('pointerup', onPointerUp);
      rootDOM.removeEventListener('pointercancel', onPointerCancel);
      rootDOM.removeEventListener('lostpointercapture', onLostPointerCapture);
      finish();
      restoreTouchAction();
    };
  });
