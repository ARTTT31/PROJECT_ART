// Tailwind v4 moved its PostCSS plugin into a separate package; the design
// tokens themselves still live in tailwind.config.ts, loaded via `@config` in
// src/app/globals.css.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
