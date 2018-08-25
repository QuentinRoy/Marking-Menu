import { deltaAngle } from './utils';

const getAngleRange = items => (items.length > 4 ? 45 : 90);

/**
 * Represents an item of the Marking Menu.
 */
export class MMItem {
  /**
   * @param {String} [id] - The item's id. Required except for the root item.
   * @param {String} [name] - The item's name. Required except for the root item.
   * @param {Integer} [angle] - The item's angle. Required except for the root item.
   * @param {List<ItemModel>} children - The items contained in the menu.
   */
  constructor(id, name, angle, children) {
    this.id = id;
    this.name = name;
    this.angle = angle;
    this.children = children;
  }

  isLeaf() {
    return !this.children || this.children.length === 0;
  }

  /**
   * @param {String} childId - The identifier of the child to look for.
   * @return {Item} the children with the id `childId`.
   */
  getChild(childId) {
    return this.children.find(child => child.id === childId);
  }

  /**
   * @param {String} childName - The name of the children to look for.
   * @return {Item} the children with the name `childName`.
   */
  getChildrenByName(childName) {
    return this.children.filter(child => child.name === childName);
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
      : Math.max(0, ...this.children.map(child => child.getMaxDepth())) + 1;
  }

  /**
   * @return {number} The maximum breadth of the menu.
   */
  getMaxBreadth() {
    return this.isLeaf()
      ? 0
      : Math.max(
          this.children.length,
          ...this.children.map(child => child.getMaxBreadth())
        );
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
      return Object.freeze(
        new MMItem(
          ...itemArgs,
          Object.freeze(recursivelyCreateModelItems(item.children, stdId))
        )
      );
    }
    return Object.freeze(new MMItem(...itemArgs));
  });
};

/**
 * Create the marking menu model.
 *
 * @param {List<String|{name,children}>} itemList - The list of items.
 * @return {MMItem} - The root item of the model.
 */
const createModel = itemList =>
  Object.freeze(
    new MMItem(null, null, null, recursivelyCreateModelItems(itemList))
  );

export default createModel;
