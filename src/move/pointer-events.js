// Create a custom pointer event from a touch event.
export const createPEventFromTouchEvent = touchEvt => {
  const touchList = Array.from(touchEvt.targetTouches);
  const sumX = touchList.reduce((acc, t) => acc + t.clientX, 0);
  const sumY = touchList.reduce((acc, t) => acc + t.clientY, 0);
  const meanX = sumX / touchList.length;
  const meanY = sumY / touchList.length;
  return {
    originalEvent: touchEvt,
    position: [meanX, meanY],
    timeStamp: touchEvt.timeStamp
  };
};

// Create a custom pointer from a mouse event.
export const createPEventFromMouseEvent = mouseEvt => ({
  originalEvent: mouseEvt,
  position: [mouseEvt.clientX, mouseEvt.clientY],
  timeStamp: mouseEvt.timeStamp
});
