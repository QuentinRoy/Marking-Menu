import template from './menu.pug';
import { strToHTML } from '../utils';
import './menu.scss';

/**
 * Create the Menu display.
 * @param {HTMLElement} parent - The parent node.
 * @param {ItemModel} model - The model of the menu to open.
 * @param {[int, int]} center - The center of the menu.
 * @param {String} [current] - The currently active item.
 * @param {Document} [options] - Menu options.
 * @param {Document} [options.doc=document] - The root document of the menu.
 *                                            Mostly useful for testing purposes.
 * @return {{ setActive, remove }} - The menu controls.
 */
const createMenu = (
  parent,
  model,
  center,
  current,
  { doc = document } = {}
) => {
  // Create the DOM.
  const main = strToHTML(template({ items: model.children, center }), doc)[0];
  parent.appendChild(main);

  // Clear any  active items.
  const clearActiveItems = () => {
    Array.from(main.querySelectorAll('.active')).forEach(itemDom =>
      itemDom.classList.remove('active')
    );
  };

  // Return an item DOM element from its id.
  const getItemDom = itemId =>
    main.querySelector(`.marking-menu-item[data-item-id="${itemId}"]`);

  // Mark an item as active.
  const setActive = itemId => {
    // Clear any  active items.
    clearActiveItems();

    // Set the active class.
    if (itemId || itemId === 0) {
      getItemDom(itemId).classList.add('active');
    }
  };

  // Function to remove the menu.
  const remove = () => parent.removeChild(main);

  // Initialize the menu.
  if (current) setActive(current);

  // Create the interface.
  return { setActive, remove };
};

export default createMenu;
