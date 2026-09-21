import type { Page } from '@playwright/test';
import { expect, test } from '../helpers/fixtures.js';

type StandaloneTestGlobal = { __standaloneEvents: string[] };

/**
 Opens a menu with a submenu on its own, through the built package, after
 focusing a button so tests can tell where focus goes back to. Each `open`,
 `change`, `select`, and `cancel` event is logged as `type:mode`, with the
 selection's `id` appended for `select`.
 */
async function openStandaloneMenu(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { createMarkingMenu } = await import('marking-menu');
    const trigger = document.createElement('button');
    trigger.id = 'standalone-trigger';
    trigger.textContent = 'Open';
    const surface = document.createElement('div');
    surface.style.cssText =
      'position:fixed;top:0;left:0;width:400px;height:400px;';
    document.body.append(trigger, surface);

    const mm = createMarkingMenu({
      parent: surface,
      items: [
        { id: 'right', label: 'Right' },
        {
          id: 'others',
          label: 'Others',
          items: [
            { id: 'sub-right', label: 'Sub Right' },
            { id: 'sub-down', label: 'Sub Down' },
          ],
        },
        { id: 'left', label: 'Left' },
      ],
    });

    const events: string[] = [];
    for (const type of ['open', 'change', 'select', 'cancel'] as const) {
      mm.on(type, (event) => {
        const detail = 'selection' in event ? `:${event.selection.id}` : '';
        events.push(`${type}:${event.mode}${detail}`);
      });
    }

    Object.assign(globalThis, { __standaloneEvents: events });
    trigger.focus();
    mm.open();
  });
}

const readEvents = async (page: Page): Promise<string[]> =>
  page.evaluate(
    () => (globalThis as unknown as StandaloneTestGlobal).__standaloneEvents,
  );

test('standalone menu: the arrow keys walk its items and submenus, and Enter selects a leaf', async ({
  page,
}) => {
  await openStandaloneMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Right' })).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Others' })).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Sub Right' })).toBeFocused();

  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('menuitem', { name: 'Others' })).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Sub Down' })).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('#standalone-trigger')).toBeFocused();
  const events = await readEvents(page);
  expect(events.at(-1)).toBe('select:standalone:sub-down');
});

test('standalone menu: Escape goes up a level, then closes the menu with a cancel', async ({
  page,
}) => {
  await openStandaloneMenu(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Sub Right' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Others' })).toBeFocused();
  expect(await readEvents(page)).not.toContain('cancel:standalone');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('#standalone-trigger')).toBeFocused();
  const events = await readEvents(page);
  expect(events.at(-1)).toBe('cancel:standalone');
});
