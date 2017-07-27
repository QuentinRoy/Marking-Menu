import noviceNavigation from './noviceNavigation';
// import expertNavigation from './expertNavigation';
import { dwellings } from '../move';

// const navigation = (drag$, menu, options) => {
//   dwellings()
// };

/**
 * @param {Observable} drags$ - A higher order observable on drag movements.
 * @param {MenuItem} menu - The model of the menu.
 * @param {object} options - Configuration options (see {@link ../index.js}).
 * @return {Observable} An observable on the marking menu events.
 */
export default (drags$, ...navArgs) =>
  drags$.exhaustMap(drag$ => noviceNavigation(drag$, ...navArgs));
