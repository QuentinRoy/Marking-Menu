import template from './menu.pug';
import './menu.scss';

/**
 * Create the Menu display.
 * @param {ItemModel} model the model of the menu to open
 * @param {HTMLElement} parent the parent node
 * @param {[int, int]} the center of the center of the menu
 * @param {String} [current] the current item
 * @param {Document} [doc] the root document of the menu,
 *                         mostly useful for testing purposes.
 * @return {{ setActive, remove }}
 */
const createMenu = (model, parent, center, current, doc = document) => {
  // Create the DOM.
  const domStr = template({ items: model.children, center });
  const main = doc.createRange().createContextualFragment(domStr).firstChild;
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
  return {
    setActive,
    remove
  };
};

export default createMenu;
