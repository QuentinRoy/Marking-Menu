import { deltaAngle } from './utils';

const getAngleRange = items => (items.length > 4 ? 45 : 90);

/**
 * Represents an item (leaf) of the Marking Menu.
 */
class Item {
  /**
   * @param {String} [id] - The item's id. Required except for the root item.
   * @param {String} [name] - The item's name. Required except for the root item.
   * @param {Integer} [angle] - The item's angle. Required except for the root item.
   */
  constructor(id, name, angle) {
    this.id = id;
    this.name = name;
    this.angle = angle;
  }

  // eslint-disable-next-line class-methods-use-this
  isLeaf() {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  isRoot() {
    return false;
  }
}

class MenuItem extends Item {
  /**
   * @param {String} [id] - The item's id. Required except for the root item.
   * @param {String} [name] - The item's name. Required except for the root item.
   * @param {Integer} [angle] - The item's angle. Required except for the root item.
   * @param {List<ItemModel>} children - The items contained in the menu.
   */
  constructor(id, name, angle, children) {
    super(id, name, angle);
    this.children = children;
  }

  isRoot() {
    return !this.id;
  }

  // eslint-disable-next-line class-methods-use-this
  isLeaf() {
    return false;
  }

  /**
   * @param {String} childId - The identifier of the child to look for.
   * @return {Item} the children with the id `childId`.
   */
  getChildren(childId) {
    return this.children.find(child => child.id === childId);
  }

  /**
   * @param {String} childName - The name of the child to look for.
   * @return {Item} the (first) children with the name `childName`.
   */
  getChildrenByName(childName) {
    return this.children.find(child => child.name === childName);
  }

  /**
   * @param {Integer} angle - An angle.
   * @return {Item} the closest children to the angle `angle`.
   */
  getNearestChildren(angle) {
    return this.children.reduce((c1, c2) => {
      const delta1 = Math.abs(deltaAngle(c1.angle, angle));
      const delta2 = Math.abs(deltaAngle(c2.angle, angle));
      return delta1 > delta2 ? c2 : c1;
    });
  }
}

// Create the model item from a list of items.
const recursivelyCreateModelItems = (items, baseId = undefined) => {
  // Calculate the angle range for each items.
  const angleRange = getAngleRange(items);
  // Create the list of model items.
  return items.map((item, i) => {
    // Standard item id.
    const stdId = baseId ? [baseId, i].join('-') : i.toString();
    // Create the item.
    const itemArgs = [
      item.id == null ? stdId : item.id,
      typeof item === 'string' ? item : item.name,
      i * angleRange
    ];
    if (item.children) {
      return new MenuItem(
        ...itemArgs,
        recursivelyCreateModelItems(item.children, stdId)
      );
    }
    return new Item(...itemArgs);
  });
};

/**
 * Create the marking menu model.
 *
 * @param {List<String|{name,children}>} itemList - The list of items.
 * @return {MenuItem} - The root item of the model.
 */
const createModel = itemList =>
  new MenuItem(null, null, null, recursivelyCreateModelItems(itemList));

export default createModel;
