import { createPointerNotification } from './pointer-events.js';

describe('createPointerNotification', () => {
  it('normalizes a Pointer Event without replacing the original event', () => {
    const event = { clientX: 10, clientY: 20, timeStamp: 1980 };
    expect(createPointerNotification(event)).toEqual({
      originalEvent: event,
      position: [10, 20],
      timeStamp: 1980,
    });
    expect(createPointerNotification(event).originalEvent).toBe(event);
  });
});
