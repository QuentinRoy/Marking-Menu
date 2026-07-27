import type { Observable } from 'rxjs';
import { pointerDrags } from './pointer-drag.js';
import type { PointerNotification } from './pointer-events.js';

const createRoot = () => {
  const root = document.createElement('div');
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  const hasPointerCapture = vi.fn(() => true);
  Object.assign(root, {
    hasPointerCapture,
    releasePointerCapture,
    setPointerCapture,
  });
  return {
    hasPointerCapture,
    releasePointerCapture,
    root,
    setPointerCapture,
  };
};

const pointer = (
  type: string,
  pointerId: number,
  init: PointerEventInit = {},
) =>
  new PointerEvent(type, {
    button: 0,
    clientX: 10,
    clientY: 20,
    isPrimary: true,
    pointerId,
    ...init,
  });

type Notification = PointerNotification<PointerEvent>;

const observeDrag = (drag$: Observable<Notification>) => {
  const complete = vi.fn();
  const values: Notification[] = [];
  drag$.subscribe({
    complete() {
      complete();
    },
    next(value) {
      values.push(value);
    },
  });
  return { complete, values };
};

describe('pointerDrags', () => {
  it('tracks one primary, primary-button pointer through pointer up', () => {
    const { releasePointerCapture, root, setPointerCapture } = createRoot();
    const drags: Array<Observable<Notification>> = [];
    const subscription = pointerDrags(root).subscribe((drag) => {
      drags.push(drag);
    });

    root.dispatchEvent(pointer('pointerdown', 1, { button: 1 }));
    root.dispatchEvent(pointer('pointerdown', 1, { isPrimary: false }));
    root.dispatchEvent(pointer('pointerdown', 7));
    root.dispatchEvent(pointer('pointerdown', 8));
    expect(drags).toHaveLength(1);

    const drag = drags[0];
    expect(drag).toBeDefined();
    if (!drag) {
      throw new Error('Expected a drag observable');
    }

    const observed = observeDrag(drag);
    root.dispatchEvent(pointer('pointermove', 8, { clientX: 80 }));
    root.dispatchEvent(pointer('pointermove', 7, { clientX: 30 }));
    root.dispatchEvent(pointer('pointerup', 8));
    root.dispatchEvent(pointer('pointerup', 7, { clientX: 40 }));

    expect(observed.values.map(({ position }) => position)).toEqual([
      [10, 20],
      [30, 20],
      [40, 20],
    ]);
    expect(observed.complete).toHaveBeenCalledOnce();
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    subscription.unsubscribe();
  });

  it('eagerly retains and replays the latest position while active', () => {
    const { root } = createRoot();
    let drag$: Observable<Notification> | undefined;
    const subscription = pointerDrags(root).subscribe((drag) => {
      drag$ = drag;
    });

    root.dispatchEvent(pointer('pointerdown', 1));
    root.dispatchEvent(pointer('pointermove', 1, { clientX: 25 }));

    expect(drag$).toBeDefined();
    if (!drag$) {
      throw new Error('Expected a drag observable');
    }

    expect(observeDrag(drag$).values[0]?.position).toEqual([25, 20]);
    subscription.unsubscribe();
  });

  it('emits pointer cancellation as the final position', () => {
    const { root } = createRoot();
    let observed: ReturnType<typeof observeDrag> | undefined;
    const subscription = pointerDrags(root).subscribe((drag) => {
      observed = observeDrag(drag);
    });

    root.dispatchEvent(pointer('pointerdown', 3));
    const cancel = pointer('pointercancel', 3, { clientX: 50 });
    root.dispatchEvent(cancel);

    expect(observed?.values.at(-1)).toMatchObject({
      canceled: true,
      originalEvent: cancel,
      position: [50, 20],
    });
    expect(observed?.complete).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });

  it('treats unexpected capture loss as cancellation at the last position', () => {
    const { releasePointerCapture, root } = createRoot();
    let observed: ReturnType<typeof observeDrag> | undefined;
    const subscription = pointerDrags(root).subscribe((drag) => {
      observed = observeDrag(drag);
    });

    root.dispatchEvent(pointer('pointerdown', 3));
    root.dispatchEvent(pointer('pointermove', 3, { clientX: 35, clientY: 45 }));
    const lost = pointer('lostpointercapture', 3);
    root.dispatchEvent(lost);

    expect(observed?.values.at(-1)).toMatchObject({
      canceled: true,
      originalEvent: lost,
      position: [35, 45],
      timeStamp: lost.timeStamp,
    });
    expect(observed?.complete).toHaveBeenCalledOnce();
    expect(releasePointerCapture).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it('errors the outer observable when pointer capture fails', () => {
    const { root, setPointerCapture } = createRoot();
    const error = new Error('capture failed');
    setPointerCapture.mockImplementation(() => {
      throw error;
    });
    const receivedError = vi.fn();
    pointerDrags(root).subscribe({
      error(received: unknown) {
        receivedError(received);
      },
    });

    root.dispatchEvent(pointer('pointerdown', 1));

    expect(receivedError).toHaveBeenCalledWith(error);
    expect(root.style.getPropertyValue('touch-action')).toBe('');
  });

  it('tears down listeners and completes active and retained inner observers', () => {
    const { releasePointerCapture, root } = createRoot();
    const removeEventListener = vi.spyOn(root, 'removeEventListener');
    let drag$: Observable<Notification> | undefined;
    const subscription = pointerDrags(root).subscribe((drag) => {
      drag$ = drag;
    });
    root.dispatchEvent(pointer('pointerdown', 4));
    expect(drag$).toBeDefined();
    if (!drag$) {
      throw new Error('Expected a drag observable');
    }

    const active = observeDrag(drag$);

    subscription.unsubscribe();

    expect(active.complete).toHaveBeenCalledOnce();
    expect(releasePointerCapture).toHaveBeenCalledWith(4);
    expect(removeEventListener).toHaveBeenCalledTimes(5);
    const retained = observeDrag(drag$);
    expect(retained.values).toEqual([]);
    expect(retained.complete).toHaveBeenCalledOnce();
  });

  it('reference-counts and safely restores inline touch-action', () => {
    const { root } = createRoot();
    root.style.setProperty('touch-action', 'pan-x', 'important');
    const first = pointerDrags(root).subscribe();
    const second = pointerDrags(root).subscribe();

    expect(root.style.getPropertyValue('touch-action')).toBe('none');
    expect(root.style.getPropertyPriority('touch-action')).toBe('important');
    first.unsubscribe();
    expect(root.style.getPropertyValue('touch-action')).toBe('none');
    second.unsubscribe();
    expect(root.style.getPropertyValue('touch-action')).toBe('pan-x');
    expect(root.style.getPropertyPriority('touch-action')).toBe('important');

    const third = pointerDrags(root).subscribe();
    root.style.setProperty('touch-action', 'manipulation');
    third.unsubscribe();
    expect(root.style.getPropertyValue('touch-action')).toBe('manipulation');
  });
});
