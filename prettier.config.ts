import type { Config } from 'prettier';

const config: Config = {
  singleQuote: true,
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  // `marking-menu` is last because the E2E fixture imports the library under
  // its own package name, which `e2e/tsconfig.json` maps back to `src/`. That
  // makes it an *internal* import to eslint's resolver, and `import-x/order`
  // ranks internal imports after the relative ones. This plugin classifies by
  // specifier pattern rather than by resolution, so it needs telling.
  importOrder: [
    '<BUILTIN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '^[.]',
    '^marking-menu$',
  ],
  importOrderCaseSensitive: false,
};

export default config;
