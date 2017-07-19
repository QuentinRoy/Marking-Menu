import template from './menu.pug';
import './menu.scss';

/**
 * Create the Menu display.
 * @param {Array<String>} itemList the name of the menu items
 * @param {HTMLElement} parent the parent node
 * @param {[int, int]} the position of the center of the menu
 * @param {String} [current] the current item
 */
const createMenu = (itemList, parent, position, current) => {
  // Create the model.
  const itemGap = itemList.length > 4 ? 45 : 90;
  const itemEntries = itemList.map((itemName, i) => ({
    name: itemName,
    angle: i * itemGap,
    id: i
  }));

  // Create the DOM.
  const domStr = template({ itemEntries, position });
  const main = document.createRange().createContextualFragment(domStr).firstChild;
  parent.appendChild(main);

  // Return an item DOM element from its id.
  const getItemDom = itemId =>
    main.querySelector(`.marking-menu-item[data-item-id="${itemId}"]`);

  // Function to set the currently active item.
  const setActive = itemName => {
    // Clear any previously active items.
    Array.from(main.querySelectorAll('.active')).forEach(itemDom =>
      itemDom.classList.remove('active')
    );
    // Fetch the target item.
    const itemEntry = itemEntries.find(it => it.name === itemName);
    const itemDom = getItemDom(itemEntry.id);
    // Set the active class.
    itemDom.classList.add('active');
  };

  // Function to remove the menu.
  const remove = () => parent.removeChild(main);

  // Initialize the menu.
  if (current) setActive(current);

  // Create the interface.
  return { setActive, remove };
};

export default createMenu;
