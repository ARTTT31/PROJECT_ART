// Tailwind v4 moved its PostCSS plugin into a separate package; the design
// tokens themselves still live in tailwind.config.mts, loaded via `@config` in
// src/app/globals.css. `.mts` is always ESM, so Node no longer warns that the
// config's module type is unspecified.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
