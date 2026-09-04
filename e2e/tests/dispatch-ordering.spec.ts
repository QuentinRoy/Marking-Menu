import { expect, test } from '../helpers/fixtures.js';
import {
  boundingBoxOf,
  moveTo,
  offset,
  pressAt,
  releaseAt,
  waitForMenuOpen,
} from '../helpers/gestures.js';

type Observation =
  | { type: 'open'; domItemCount: number; eventItemCount: number }
  | {
      type: 'change';
      domActiveId: string | null;
      eventActiveId: string | null;
    }
  | { type: 'select'; domMenuCount: number; cursor: string };

type OrderingTestGlobal = { __orderingTest: { observations: Observation[] } };

/**
 Narrows `Observation.find(...)`'s result, throwing rather than leaving a
 later assertion to run conditionally (and silently pass) if the observation
 never happened.
 */
function observed<T extends Observation['type']>(
  observations: readonly Observation[],
  type: T,
): Extract<Observation, { type: T }> {
  const observation = observations.find((o) => o.type === type);
  if (observation === undefined) {
    throw new TypeError(`"${type}" was never observed.`);
  }

  return observation as Extract<Observation, { type: T }>;
}

// Beyond the default `minSelectionDist` (40px): far enough to select item
// "a" unambiguously, the same margin `mouse.spec.ts` uses for its own
// selections.
const SELECT_RADIUS = 100;

test('commit → render → dispatch ordering: a listener observes the complete UI and state resulting from the input that produced its event', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const { createMarkingMenu } = await import('marking-menu');
    const element = document.createElement('div');
    element.id = 'ordering-test-surface';
    element.style.cssText =
      'position:fixed;top:0;left:0;width:300px;height:300px;';
    document.body.append(element);

    const items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ] as const;
    const mm = createMarkingMenu({ items, parent: element });
    const observations: Observation[] = [];

    // `open`: the menu's DOM must already carry every item by the time the
    // listener runs, not an empty or partially built menu.
    mm.on('open', (event) => {
      observations.push({
        domItemCount: element.querySelectorAll('.marking-menu-item').length,
        eventItemCount: event.menu.items.length,
        type: 'open',
      });
    });

    // `change`: the DOM's active item must already match what the event
    // itself reports as active. `data-item-id` carries the model's internal
    // per-level `key`, not the consumer-supplied `id`, hence comparing
    // against `event.active.key`.
    mm.on('change', (event) => {
      const activeElement = element.querySelector('.marking-menu-item.active');
      observations.push({
        domActiveId:
          activeElement instanceof HTMLElement
            ? (activeElement.dataset.itemId ?? null)
            : null,
        eventActiveId: event.active?.key ?? null,
        type: 'change',
      });
    });

    // `select`: the transition back to idle — closing the menu, resetting
    // the cursor — is part of the same commit as the selection itself, so
    // both must already be reflected by the time this listener runs.
    mm.on('select', () => {
      observations.push({
        cursor: element.style.cursor,
        domMenuCount: element.querySelectorAll('.marking-menu').length,
        type: 'select',
      });
    });

    Object.assign(globalThis, { __orderingTest: { observations } });
  });

  const box = await boundingBoxOf(page, '#ordering-test-surface');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Dwell without moving: opens novice mode at the gesture origin. Then
  // move onto item "a" (making it active) and release to select it.
  await pressAt(page, center);
  await waitForMenuOpen(page);
  await moveTo(page, offset(center, 0, SELECT_RADIUS));
  await releaseAt(page);

  const observations = await page.evaluate<Observation[]>(
    () =>
      (globalThis as unknown as OrderingTestGlobal).__orderingTest.observations,
  );

  const open = observed(observations, 'open');
  expect(
    open.domItemCount,
    'the menu DOM is fully built before open dispatches',
  ).toBe(open.eventItemCount);

  const change = observed(observations, 'change');
  expect(
    change.domActiveId,
    'the DOM already shows the item change reports as active',
  ).toBe(change.eventActiveId);

  const select = observed(observations, 'select');
  expect(
    select.domMenuCount,
    'the menu is already closed by the time select dispatches',
  ).toBe(0);
  expect(
    select.cursor,
    'the cursor is already restored by the time select dispatches',
  ).toBe('');
});
