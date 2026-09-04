import {
  createController,
  type EngineConfig,
  type MarkingMenuController,
} from './engine/controller.js';
import type { MarkingMenuModel, ValidateInput } from './model.js';

/**
 A logger, as accepted by {@link createMarkingMenu}. `error` is the only
 method anything in the library calls, so any object exposing it — `console`
 included — satisfies this type. `info`/`warn`/`debug` are accepted but
 ignored, so a fuller logger doesn't need to be stripped down first. Errors
 raised internally are always normalized to `Error` before reaching `error`,
 so a handler typed to expect an `Error` (rather than `unknown`) can be passed
 directly.
 */
export type MarkingMenuLogger = {
  error: (error: Error) => void;
  info?: unknown;
  warn?: unknown;
  debug?: unknown;
};

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
