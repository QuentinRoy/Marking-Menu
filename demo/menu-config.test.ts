import { describe, expect, it } from 'vitest';
import type { MarkingMenuInput } from '../src/types.js';
import { readMenuConfig, writeMenuConfig } from './menu-config.js';

const menu: MarkingMenuInput = {
  items: [
    { angle: 45, id: 'a', label: 'A', items: [{ angle: 90, label: 'A1' }] },
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

  it('rejects a non-finite item angle', () => {
    expect(
      readMenuConfig(
        '?config=%7B%22items%22%3A%5B%7B%22label%22%3A%22A%22%2C%22angle%22%3A1e999%7D%5D%7D',
      ),
    ).toBeNull();
  });
});
