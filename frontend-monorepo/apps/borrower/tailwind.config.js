const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        base: '#623AB0',
        font: '#3C3D40',
        color: '#623AB0',
        'font-dark': '#191E1A',
        dashboard: '#ffffff',
        'active-nav': '#CDC3FF',
        btn: '#21212F',
      },
    },
  },
  plugins: [],
};
