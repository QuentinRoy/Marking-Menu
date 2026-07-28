import { last, map, merge, share, startWith, type Observable } from 'rxjs';
import { draw } from '../move/draw.js';
import { recognizeMarkingMenuStroke as recognize } from '../recognizer/recognize-mm-stroke.js';
import type { MarkingMenuModelItem } from '../types.js';
import type { Point } from '../utils.js';

/**
 A drag notification consumed by the navigation: it carries at least a pixel
 position. Extra fields (timeStamp, originalEvent, …) are threaded through
 unchanged.
 */
export type NavigationDrag = { canceled?: boolean; position: Point };

/*
 `MarkingMenuModelItem` — the base item type this file is generic over,
 since it describes no particular tree — has a non-literal `isLeaf: boolean`
 field, so `ModelLeaves<MarkingMenuModelItem>` (and the leaf-narrowing
 overload it drives) collapses to `never`. The widened `boolean` (rather
 than the literal `true` the leaf-narrowing overload matches on) forces
 overload resolution onto the general one instead, matching this pipeline's
 always-had `ModelNodes<N> | null` typing. `src/engine` recognizes against a
 concrete, tuple-shaped model and gets the narrow leaf type for free.
 */
const recognizeLeaf: { requireLeaf: boolean } = { requireLeaf: true };

/**
 A drawing notification: a drag notification augmented with the stroke drawn so
 far.
 */
export type DrawNotification<D> = D & { stroke: Point[]; type?: string };

/**
 The notifications emitted by the expert navigation.
 */
export type ExpertNavigationNotification<D> =
  | DrawNotification<D>
  | { type: 'cancel' }
  | (DrawNotification<D> & {
      type: 'select';
      selection: MarkingMenuModelItem;
    })
  | (DrawNotification<D> & { type: 'cancel' });

/**
 Navigate the menu in expert mode: recognize the gesture drawn during the drag.

 @param drag$ - An observable of drag movements.
 @param model - The model of the menu.
 @param initStroke - Initial stroke.
 @returns An observable on the gesture drawing and recognition.
 */
export function expertNavigation<D extends NavigationDrag>(
  drag$: Observable<D>,
  model: MarkingMenuModelItem,
  initStroke: Point[] = [],
): Observable<ExpertNavigationNotification<D>> {
  // Observable on gesture drawing.
  const draw$ = draw(drag$, { initStroke, type: 'draw' }).pipe(share());

  // Track the end of the drawing and attempt to recognize the gesture.
  const end$ = draw$.pipe(
    startWith(null),
    last(),
    map((event_): ExpertNavigationNotification<D> => {
      if (!event_) {
        return { type: 'cancel' };
      }

      if (event_.canceled) {
        return { ...event_, type: 'cancel' };
      }

      const selection = recognize(event_.stroke, model, recognizeLeaf);
      if (selection) {
        return { ...event_, type: 'select', selection };
      }

      return { ...event_, type: 'cancel' };
    }),
  );
  return merge(draw$, end$);
}
