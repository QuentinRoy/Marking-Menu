import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';
import {
  boundingBoxOf,
  moveTo,
  offset,
  pressAt,
  releaseAt,
} from '../helpers/gestures.js';

type DisposalTestGlobal = {
  __disposalTest: { events: string[]; mm: { dispose: () => void } };
};

/**
 Drives a controller directly against its own detached surface — the same
 approach `multiple-controllers.spec.ts` uses — since this test needs the
 controller's own handle to call `dispose()` on, not just the fixture's
 projected `#log`.
 */
async function setUpController(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { createMarkingMenu } = await import('marking-menu');
    const element = document.createElement('div');
    element.id = 'disposal-test-surface';
    element.style.cssText =
      'position:fixed;top:0;left:0;width:300px;height:300px;';
    document.body.append(element);

    const items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ];
    const events: string[] = [];
    const mm = createMarkingMenu({ items, parent: element });
    for (const type of [
      'start',
      'open',
      'move',
      'change',
      'select',
      'cancel',
    ] as const) {
      mm.on(type, () => {
        events.push(type);
      });
    }

    Object.assign(globalThis, { __disposalTest: { events, mm } });
  });
}

async function readSurfaceState(
  page: Page,
): Promise<{ canvasCount: number; cursor: string; eventCount: number }> {
  return page.evaluate(() => {
    const { events } = (globalThis as unknown as DisposalTestGlobal)
      .__disposalTest;
    const element = document.querySelector('#disposal-test-surface');
    if (!(element instanceof HTMLElement)) {
      throw new TypeError('#disposal-test-surface is missing.');
    }

    return {
      canvasCount: element.querySelectorAll('canvas').length,
      cursor: element.style.cursor,
      eventCount: events.length,
    };
  });
}

test('disposal at the browser boundary: pointer input and pending work produce no public events or visual mutations afterward, rendered resources are gone, and repeated disposal is harmless', async ({
  page,
}) => {
  await setUpController(page);

  const box = await boundingBoxOf(page, '#disposal-test-surface');
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Start a gesture and move enough to reach expert mode: a canvas gets
  // rendered and the cursor changes, so there's something disposal has to
  // undo.
  await pressAt(page, center);
  await moveTo(page, offset(center, 0, 20));

  const beforeDispose = await readSurfaceState(page);
  expect(beforeDispose.eventCount, 'start was dispatched').toBeGreaterThan(0);
  expect(beforeDispose.canvasCount, 'the stroke canvas is rendered').toBe(1);
  expect(beforeDispose.cursor, 'the gesture cursor is set').not.toBe('');

  const didRedisposeThrow = await page.evaluate(() => {
    const { mm } = (globalThis as unknown as DisposalTestGlobal).__disposalTest;
    mm.dispose();

    try {
      mm.dispose();
      return false;
    } catch {
      return true;
    }
  });
  expect(didRedisposeThrow, 'a second dispose() does not throw').toBe(false);

  const afterDispose = await readSurfaceState(page);
  expect(afterDispose.canvasCount, 'rendered resources are gone').toBe(0);
  expect(afterDispose.cursor, 'the cursor is restored').toBe('');
  expect(afterDispose.eventCount, 'disposal itself emits nothing').toBe(
    beforeDispose.eventCount,
  );

  // Pointer input arriving after disposal — including the release of the
  // gesture that was in progress — must produce no further public events or
  // visual mutations.
  await moveTo(page, offset(center, 0, 40));
  await releaseAt(page);

  const afterPointerActivity = await readSurfaceState(page);
  expect(
    afterPointerActivity.eventCount,
    'pointer input after disposal is inert',
  ).toBe(beforeDispose.eventCount);
  expect(afterPointerActivity.canvasCount).toBe(0);
});
