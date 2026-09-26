import type { ModelItem, ModelRoot } from '../types.js';

/**
 The machine's erased node shape. It preserves the fields required by the
 renderer while leaving literal ids, labels, and parent paths at the public
 controller boundary.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- interfaces allow recursive item lists without circular alias errors.
export interface EngineModelItem extends ModelItem<
  string | undefined,
  string,
  readonly EngineModelItem[]
> {
  readonly items: readonly EngineModelItem[];
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- interfaces allow recursive item lists without circular alias errors.
export interface EngineModelRoot extends ModelRoot<readonly EngineModelItem[]> {
  readonly items: readonly EngineModelItem[];
}

export type EngineModelMenuItem = EngineModelItem & {
  readonly isLeaf: false;
};

export type EngineModelMenu = EngineModelRoot | EngineModelMenuItem;
