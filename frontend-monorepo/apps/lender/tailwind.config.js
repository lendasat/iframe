const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');
const { blackA, violet , mauve, red} = require("@radix-ui/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
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
        'dark-500': '#273345',
        font: '#000000',
        'font-dark': '#EAEAEA',
        color: '#623AB0',
        dashboard: '#ffffff',
        'dashboard-dark': '#1A202C',
        'active-nav': '#CDC3FF',
        btn: '#21212F',
        ...blackA,
        ...violet,
        ...mauve,
        ...violet,
        ...red,
        ...blackA,
      },
      keyframes: {
        overlayShow: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        contentShow: {
          from: {
            opacity: "0",
            transform: "translate(-50%, -48%) scale(0.96)",
          },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
      },
      animation: {
        overlayShow: "overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        contentShow: "contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      },


    },
  },
  plugins: [],
};
