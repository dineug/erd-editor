/**
 * The one browser floor this repo commits to: the full-ES2022 line, where
 * static initialisation blocks set the bound in every engine. Every published
 * library imports it, so raising it here narrows all of them at once.
 */
export const BROWSER_TARGET = ['chrome91', 'edge94', 'firefox93', 'safari16.4'];

/**
 * The same floor as a browserslist query, derived rather than written twice so
 * the two spellings cannot drift. @vitejs/plugin-legacy's modernTargets is the
 * one consumer that speaks it.
 */
export const BROWSER_TARGET_QUERY = BROWSER_TARGET.map(entry =>
  entry.replace(/^([a-z]+)([\d.]+)$/, '$1 >= $2')
);
