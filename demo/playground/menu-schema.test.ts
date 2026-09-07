import { describe, expect, it } from 'vitest';
import { DEFAULT_MENU } from '../menu-config.js';
import { validateMenuSource } from './menu-schema.js';
import { formatMenu } from './menu-source.js';

describe('validateMenuSource', () => {
  it('accepts the menu the page opens on', () => {
    expect(validateMenuSource(formatMenu(DEFAULT_MENU))).toEqual({
      ok: true,
      menu: DEFAULT_MENU,
    });
  });

  it('accepts an item with an id', () => {
    const source = '{ "items": [{ "id": "right", "label": "Right" }] }';
    expect(validateMenuSource(source).ok).toBe(true);
  });

  it('accepts an item with an angle', () => {
    const result = validateMenuSource(
      '{ "items": [{ "label": "Right", "angle": 45 }] }',
    );
    expect(result).toEqual({
      ok: true,
      menu: { items: [{ angle: 45, label: 'Right' }] },
    });
  });

  it('rejects an unknown item property', () => {
    const result = validateMenuSource(
      '{ "items": [{ "label": "Right", "unknown": true }] }',
    );
    expect(result.ok).toBe(false);
  });

  it('names the item an error is about', () => {
    const result = validateMenuSource(
      '{ "items": [{ "label": "Others", "items": [{ "label": 3 }] }] }',
    );
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.message).toContain('Others');
  });

  it('reports text that is not JSON at all', () => {
    const result = validateMenuSource('{ "items": ');
    expect(result.ok ? '' : result.message).toMatch(/^Invalid JSON: /v);
  });
});
