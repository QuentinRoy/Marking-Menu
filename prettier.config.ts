import type { Config } from 'prettier';

const config: Config = {
  singleQuote: true,
  // `prettier-plugin-tailwindcss` must come last: it wraps whatever other
  // plugins are loaded.
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-tailwindcss',
  ],
  importOrder: ['<BUILTIN_MODULES>', '<THIRD_PARTY_MODULES>', '^[.]'],
  importOrderCaseSensitive: false,
};

export default config;
