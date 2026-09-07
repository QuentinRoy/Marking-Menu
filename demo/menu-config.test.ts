import { describe, expect, it } from 'vitest';
import type { MarkingMenuInput } from '../src/types.js';
import { readMenuConfig, writeMenuConfig } from './menu-config.js';

const menu: MarkingMenuInput = {
  items: [
    { id: 'a', label: 'A', items: [{ label: 'A1' }] },
    { label: 'Wait, (really) @ home?' },
  ],
};

describe('readMenuConfig / writeMenuConfig', () => {
  it('round-trips a menu', () => {
    expect(readMenuConfig(writeMenuConfig('', menu))).toEqual(menu);
  });

  it('leaves the query string’s other parameters alone', () => {
    expect(writeMenuConfig('?theme=dark', { items: [] })).toBe(
      '?theme=dark&config=%7B%22items%22%3A%5B%5D%7D',
    );
  });

  it('replaces a menu already in the query string', () => {
    const search = writeMenuConfig(writeMenuConfig('', menu), { items: [] });
    expect(readMenuConfig(search)).toEqual({ items: [] });
  });

  it('reads no menu from a query string without the parameter', () => {
    expect(readMenuConfig('?theme=dark')).toBeNull();
  });

  it('reads no menu from a parameter that is not JSON', () => {
    expect(readMenuConfig('?config=nope')).toBeNull();
  });

  it('reads no menu from JSON of the wrong shape', () => {
    expect(readMenuConfig('?config=%7B%22items%22%3A%5B4%5D%7D')).toBeNull();
  });
});
