import recognize from '../recognizer';

/**
 * @param {Observable} drag$ - An observable of drag movements.
 * @param {MenuItem} model - The model of the menu.
 * @return {Observable} An observable on the gesture drawing and recognition.
 */
export default (drag$, model) => {
  // Observable on gesture drawing.
  const draw$ = drag$
    .scan(
      (acc, notification) =>
        Object.assign(
          { stroke: [...acc.stroke, notification.position], type: 'draw' },
          notification
        ),
      { stroke: [] }
    )
    .share();
  // Track the end of the drawing and attempt to recognize the gesture.
  const end$ = draw$.startWith(null).last().map(e => {
    if (!e) return { type: 'cancel' };
    const selection = recognize(e.stroke, model);
    if (selection) {
      return Object.assign(e, { type: 'select', selection });
    }
    return Object.assign(e, { type: 'cancel' });
  });
  return draw$.merge(end$);
};
