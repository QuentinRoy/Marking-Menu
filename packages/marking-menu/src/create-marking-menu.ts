import {
  createController,
  type EngineConfig,
  type MarkingMenuController,
} from './engine/controller.js';
import type { MarkingMenuModel, ValidateInput } from './model.js';

export type { MarkingMenuLogger } from './engine/logger.js';

/**
 Configuration of a marking menu, as accepted by {@link createMarkingMenu}.
 */
export type MarkingMenuConfig = EngineConfig;

/**
 Create a Marking Menu: an already-active controller dispatching `start`,
 `open`, `move`, `change`, `select` and `cancel` events until `dispose()`d.

 @param config - The menu configuration.
 @returns The active controller.
 */
export function createMarkingMenu<const Config extends MarkingMenuConfig>(
  config: Config & ValidateInput<Config>,
): MarkingMenuController<MarkingMenuModel<Config>> {
  return createController<Config>(config);
}
