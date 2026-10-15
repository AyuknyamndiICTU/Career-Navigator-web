import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next 16 removed `next lint`; this is the flat config it used to generate.
const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts', '*.js'],
  },
  {
    // Existing debt (30 `@ts-nocheck` files, loose `any`s) is reported but doesn't fail CI
    // until the pages are typed; new code should not add more.
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler advisories that flag the existing load-data-in-useEffect pages.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default config;
