import { expect, test } from '../helpers/fixtures.js';

/**
 Reads `touch-action`'s inline value and priority off `element` (both empty
 strings when the property isn't set at all).
 */
type TouchActionStyle = { priority: string; value: string };

test('multiple controllers on one parent: touch-action stays claimed until the last controller is disposed, then the exact prior inline value and priority are restored', async ({
  page,
}) => {
  // A detached element, distinct from the fixture's own `#surface` (which
  // already has its own live controller for the whole test session): this
  // test drives its own controllers directly against the library, through
  // the same `marking-menu` module the fixture's import map resolves.
  const styles = await page.evaluate(async (): Promise<TouchActionStyle[]> => {
    const { createMarkingMenu } = await import('marking-menu');
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-y', 'important');
    const readStyle = (): TouchActionStyle => ({
      priority: element.style.getPropertyPriority('touch-action'),
      value: element.style.getPropertyValue('touch-action'),
    });

    const items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const results: TouchActionStyle[] = [];

    const first = createMarkingMenu({ items, parent: element }).subscribe();
    results.push(readStyle());

    const second = createMarkingMenu({ items, parent: element }).subscribe();
    results.push(readStyle());

    first.unsubscribe();
    results.push(readStyle());

    second.unsubscribe();
    results.push(readStyle());

    return results;
  });

  const [afterFirst, afterSecond, afterFirstRelease, afterSecondRelease] =
    styles;
  const claimed = { priority: 'important', value: 'none' };

  expect(afterFirst).toEqual(claimed);
  expect(afterSecond).toEqual(claimed);
  expect(afterFirstRelease, 'still claimed by the second controller').toEqual(
    claimed,
  );
  expect(
    afterSecondRelease,
    'the exact prior inline value and priority',
  ).toEqual({ priority: 'important', value: 'pan-y' });
});
