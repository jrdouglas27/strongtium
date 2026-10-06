/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nordic: {
          bg: '#2f4858', // Deep Rich Slate Blue base
          bar: '#223541', // Darker Slate bar
          barBorder: '#182731',
          card: '#3d5a6c', // Muted Mid-Tone Slate Surface (Not bright!)
          cardBorder: '#4e7085',
          inner: '#2d4554', // Darker inset inputs & rows
          innerBorder: '#3f5d70',
          textMain: '#f1f5f9', // Crisp soft white text on muted cards
          textMuted: '#94a3b8', // Secondary text
        },
        pastel: {
          green: {
            bg: '#8fb89e',
            border: '#78a387',
            text: '#0e2a18',
          },
          maroon: {
            bg: '#cc8d8d',
            border: '#b87676',
            text: '#3b1212',
          },
          purple: {
            bg: '#b9a1c6',
            border: '#a48ab2',
            text: '#2e1837',
          },
          blue: {
            bg: '#8bb4cb',
            border: '#749fb7',
            text: '#0e2938',
          },
          sand: {
            bg: '#c9bda9',
            border: '#b3a58e',
            text: '#332919',
          }
        }
      }
    },
  },
  plugins: [],
}
