export default nodeSass => ({
  'pi()': () => new nodeSass.types.Number(Math.PI),
  'cos($alpha)': alpha => new nodeSass.types.Number(Math.cos(alpha.getValue())),
  'sin($alpha)': alpha => new nodeSass.types.Number(Math.sin(alpha.getValue())),
  'to-rad($deg)': deg =>
    new nodeSass.types.Number((deg.getValue() * 2 * Math.PI) / 360)
});
