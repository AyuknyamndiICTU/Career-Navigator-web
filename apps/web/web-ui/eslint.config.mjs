import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// Next 16 removed `next lint`; this is the flat config it used to generate.
const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts', '*.js', 'src/lib/api/schema.d.ts'],
  },
  {
    rules: {
      // Type checking stays on everywhere; CI fails on any new @ts-nocheck / @ts-ignore.
      '@typescript-eslint/ban-ts-comment': 'error',
      // Existing loose `any`s are reported but don't fail CI until those pages are typed.
      '@typescript-eslint/no-explicit-any': 'warn',
      // React Compiler advisories that flag the existing load-data-in-useEffect pages.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default config;
