import { types } from 'node-sass';

export default {
  'pi()': () => new types.Number(Math.PI),
  'cos($alpha)': alpha => new types.Number(Math.cos(alpha.getValue())),
  'sin($alpha)': alpha => new types.Number(Math.sin(alpha.getValue())),
  'to-rad($deg)': deg => new types.Number(deg.getValue() * 2 * Math.PI / 360)
};
