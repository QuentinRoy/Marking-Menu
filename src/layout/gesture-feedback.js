import createStrokeCanvas from './stroke';

export default (
  parentDOM,
  { duration, strokeOptions = {}, canceledStrokeOptions = {} }
) => {
  let strokeTimeoutEntries = [];

  const show = (stroke, isCanceled = false) => {
    const canvas = createStrokeCanvas(parentDOM, {
      ...strokeOptions,
      ...(isCanceled ? canceledStrokeOptions : {}),
    });
    canvas.drawStroke(stroke);
    const timeoutEntry = {
      canvas,
      timeout: setTimeout(() => {
        // Remove the entry from the strokeTimeoutEntries.
        strokeTimeoutEntries = strokeTimeoutEntries.filter(
          (x) => x !== timeoutEntry
        );
        // Clear the stroke canvas.
        canvas.remove();
      }, duration),
    };
    strokeTimeoutEntries.push(timeoutEntry);
  };

  const remove = () => {
    strokeTimeoutEntries.forEach(({ timeout, canvas }) => {
      clearTimeout(timeout);
      canvas.remove();
    });
    strokeTimeoutEntries = [];
  };

  return { show, remove };
};
