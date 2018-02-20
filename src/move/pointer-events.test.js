import test from 'ava';
import {
  createPEventFromMouseEvent,
  createPEventFromTouchEvent
} from './pointer-events';

test('createPEventFromMouseEvent', t => {
  const mouseEvt = {
    clientX: 10,
    clientY: 20,
    timeStamp: 1980
  };
  t.deepEqual(createPEventFromMouseEvent(mouseEvt), {
    position: [10, 20],
    timeStamp: 1980,
    originalEvent: mouseEvt
  });
  t.is(createPEventFromMouseEvent(mouseEvt).originalEvent, mouseEvt);
});

test('createPEventFromTouchEvent', t => {
  const touchEvent = {
    // Use an object instead of an array because it needs to work with
    // array-like objects (TouchEvent#targetTouches is not an array).
    targetTouches: {
      0: { clientX: 23, clientY: 12 },
      1: { clientX: 0, clientY: 2 },
      2: { clientX: 10, clientY: 4 },
      length: 3
    },
    timeStamp: 1990
  };
  t.deepEqual(createPEventFromTouchEvent(touchEvent), {
    position: [11, 6],
    timeStamp: 1990,
    originalEvent: touchEvent
  });
  t.is(createPEventFromTouchEvent(touchEvent).originalEvent, touchEvent);
});
