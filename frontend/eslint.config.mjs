import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'next-env.d.ts'],
  },
  ...nextVitals,
  {
    rules: {
      'react-hooks/globals': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default config
