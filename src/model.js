import { deltaAngle } from './utils';

const getAngleRange = (items) => (items.length > 4 ? 45 : 90);

/**
 * Represents an item of the Marking Menu.
 */
export class MMItem {
  /**
   * @param {String} id - The item's id. Required except for the root item.
   * @param {String} name - The item's name. Required except for the root item.
   * @param {Integer} angle - The item's angle. Required except for the root item.
   * @param {object} [options] - Some additional options.
   * @param {ItemModel} [options.parent] - The parent menu of the item.
   * @param {List<ItemModel>} [options.children] - The children of the item menu.
   */
  constructor(id, name, angle, { parent, children } = {}) {
    this.id = id;
    this.name = name;
    this.angle = angle;
    this.children = children;
    this.parent = parent;
  }

  isLeaf() {
    return !this.children || this.children.length === 0;
  }

  isRoot() {
    return !this.parent;
  }

  /**
   * @param {String} childId - The identifier of the child to look for.
   * @return {Item} the children with the id `childId`.
   */
  getChild(childId) {
    return this.children.find((child) => child.id === childId);
  }

  /**
   * @param {String} childName - The name of the children to look for.
   * @return {Item} the children with the name `childName`.
   */
  getChildrenByName(childName) {
    return this.children.filter((child) => child.name === childName);
  }

  /**
   * @param {Integer} angle - An angle.
   * @return {Item} the closest children to the angle `angle`.
   */
  getNearestChild(angle) {
    return this.children.reduce((c1, c2) => {
      const delta1 = Math.abs(deltaAngle(c1.angle, angle));
      const delta2 = Math.abs(deltaAngle(c2.angle, angle));
      return delta1 > delta2 ? c2 : c1;
    });
  }

  /**
   * @return {number} The maximum depth of the menu.
   */
  getMaxDepth() {
    return this.isLeaf()
      ? 0
      : Math.max(0, ...this.children.map((child) => child.getMaxDepth())) + 1;
  }

  /**
   * @return {number} The maximum breadth of the menu.
   */
  getMaxBreadth() {
    return this.isLeaf()
      ? 0
      : Math.max(
          this.children.length,
          ...this.children.map((child) => child.getMaxBreadth())
        );
  }
}

// Create the model item from a list of items.
const recursivelyCreateModelItems = (
  items,
  baseId = undefined,
  parent = undefined
) => {
  // Calculate the angle range for each items.
  const angleRange = getAngleRange(items);
  // Create the list of model items (frozen).
  return Object.freeze(
    items.map((item, i) => {
      // Standard item id.
      const stdId = baseId ? [baseId, i].join('-') : i.toString();
      // Create the item.
      const mmItem = new MMItem(
        item.id == null ? stdId : item.id,
        typeof item === 'string' ? item : item.name,
        i * angleRange,
        { parent }
      );
      // Add its children if any.
      if (item.children) {
        mmItem.children = recursivelyCreateModelItems(
          item.children,
          stdId,
          mmItem
        );
      }
      // Return it frozen.
      return Object.freeze(mmItem);
    })
  );
};

/**
 * Create the marking menu model.
 *
 * @param {List<String|{name,children}>} itemList - The list of items.
 * @return {MMItem} - The root item of the model.
 */
const createModel = (itemList) => {
  const menu = new MMItem(null, null, null);
  menu.children = recursivelyCreateModelItems(itemList, undefined, menu);
  return Object.freeze(menu);
};

export default createModel;
