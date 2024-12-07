const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
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
      borderColor: {
        light: '#e5e7eb',
        dark: '#374151',
      },
      colors: {
        light: '#ffffff',
        dark: '#1f2937', // dark-800
        'dark-700': '#374151',
        'dark-600': '#44505f',
        font: '#000000',
        'font-dark': '#EAEAEA',
        color: '#623AB0',
        dashboard: '#ffffff',
        'dashboard-dark': '#1A202C',
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
