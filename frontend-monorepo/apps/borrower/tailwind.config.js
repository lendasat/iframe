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
      keyframes: {
        bounce: {
          '0%, 100%': {
            transform: 'translateY(-7%)',
            'animation-timing-function': 'cubic-bezier(0.8,0,1,1)',
          },
          '50%': {
            transform: 'none',
            'animation-timing-function': 'cubic-bezier(0,0,0.2,1)',
          },
        },
      },
    },
  },
  plugins: [],
};
