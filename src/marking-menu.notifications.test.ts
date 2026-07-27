import type { Observable } from 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import { map } from 'rxjs/operators';
import { exportNotification } from './marking-menu.js';
import { createModel } from './model.js';
import type { NavigationDrag } from './navigation/expert-navigation.js';
import { noviceMoves } from './navigation/novice-navigation.js';

/*
 `MarkingMenuNotification` is a reading of the navigation/layout emission
 sites, not something the compiler checks (see its doc comment in
 marking-menu.ts). These tests drive a real model through real navigation
 code (`noviceMoves`, unmocked) and check the resulting notifications — after
 `exportNotification`, exactly as the public API produces them — actually
 have the shape the type promises. `noviceMoves` alone (not the full
 `noviceNavigation`) already covers 'open', 'change'/'move' and 'select'/
 'cancel': it owns both the live moves and the end-of-drag notification.
 */

const menu = createModel({
  items: [
    { id: 'right', label: 'Right' },
    {
      id: 'bottom',
      label: 'Bottom',
      items: [{ id: 'bottom-left', label: 'Bottom Left' }],
    },
  ],
});

const options = {
  menuCenter: [0, 0] as [number, number],
  minSelectionDist: 10,
};

describe('real notification shapes', () => {
  it(
    'opens with the real menu model, and selects the real leaf hovered at the end',
    marbles((m) => {
      const drag$ = m.hot('a-b|', {
        a: { position: [5, 0] },
        b: { position: [100, 0] },
      });

      const notifications$ = noviceMoves(
        drag$ as unknown as Observable<NavigationDrag>,
        menu,
        options,
      ).pipe(map(exportNotification));

      const notifications: unknown[] = [];
      notifications$.subscribe((n) => {
        notifications.push(n);
      });
      m.flush();

      // Open (seed) -> move (a, still near center) -> change (b, now on 'right') -> select (end).
      const [open, move, change, select] = notifications as [
        { type: string; menu: typeof menu },
        { type: string; active: (typeof menu.items)[number] | null },
        { type: string; active: (typeof menu.items)[number] | null },
        { type: string; selection: (typeof menu.items)[number] | null },
      ];

      expect(open.type).toBe('open');
      expect(open.menu).toBe(menu);
      expect(open.menu.items).toHaveLength(2);

      expect(move.type).toBe('move');
      expect(move.active).toBe(null);

      expect(change.type).toBe('change');
      expect(change.active?.id).toBe('right');
      expect(change.active?.isLeaf).toBe(true);

      expect(select.type).toBe('select');
      expect(select.selection?.id).toBe('right');
      expect(select.selection?.isLeaf).toBe(true);
    }),
  );

  it(
    'cancels with the real (non-leaf) menu hovered at the end',
    marbles((m) => {
      const drag$ = m.hot('a-b|', {
        a: { position: [5, 0] },
        b: { position: [0, 100] },
      });

      const notifications$ = noviceMoves(
        drag$ as unknown as Observable<NavigationDrag>,
        menu,
        options,
      ).pipe(map(exportNotification));

      const notifications: unknown[] = [];
      notifications$.subscribe((n) => {
        notifications.push(n);
      });
      m.flush();

      const cancel = notifications.at(-1) as {
        type: string;
        selection: (typeof menu.items)[number] | null;
      };

      expect(cancel.type).toBe('cancel');
      expect(cancel.selection?.id).toBe('bottom');
      expect(cancel.selection?.isLeaf).toBe(false);
    }),
  );

  it(
    'cancels with no selection when the drag ends near the center',
    marbles((m) => {
      const drag$ = m.hot('a-b|', {
        a: { position: [5, 0] },
        b: { position: [3, 0] },
      });

      const notifications$ = noviceMoves(
        drag$ as unknown as Observable<NavigationDrag>,
        menu,
        options,
      ).pipe(map(exportNotification));

      const notifications: unknown[] = [];
      notifications$.subscribe((n) => {
        notifications.push(n);
      });
      m.flush();

      const cancel = notifications.at(-1) as {
        type: string;
        selection: unknown;
      };

      expect(cancel.type).toBe('cancel');
      expect(cancel.selection).toBeFalsy();
    }),
  );
});
