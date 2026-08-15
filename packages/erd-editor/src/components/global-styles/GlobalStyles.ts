import { FC, html, setGlobalStyleOrder } from '@dineug/r-html';

import { colorPickerStyle } from '@/styles/colorPicker.style';
import { fontsStyle } from '@/styles/fonts.styles';
import { resetStyle } from '@/styles/reset.styles';
import { scrollbarStyle } from '@/styles/scrollbar.styles';
import { typographyStyle } from '@/styles/typography.styles';

export type GlobalStylesProps = {};

/**
 * The cascade order of the global bucket, stated as data.
 *
 * The import list above is sorted alphabetically by `simple-import-sort`, and module evaluation
 * order follows it — so leaving the bucket to registration order would emit these as
 * colorPicker, fonts, reset, scrollbar, typography and put the reset behind the tokens it resets.
 * This array is the one place that decides, and it is deliberately not a re-derivation of anything
 * above it.
 *
 * `colorPickerStyle` is last because that is where it sat when it was a tree `<style>`: a shadow
 * root applies its own `styleSheets` before its `adoptedStyleSheets`, so as an element it outranked
 * the whole adopted pool. Adopting it removes that inversion, and last in the bucket is the
 * position that keeps it ahead of nothing it did not already outrank while leaving the four sheets
 * below it in the order they were already in.
 */
setGlobalStyleOrder([
  resetStyle,
  fontsStyle,
  typographyStyle,
  scrollbarStyle,
  colorPickerStyle,
]);

/**
 * Renders nothing, and stays anyway.
 *
 * Every sheet it used to be responsible for is an adopted global literal now, so there is no
 * markup left to emit. What is left is the `setGlobalStyleOrder` call above, which is a module
 * side effect — it only runs if something imports this module, and the bucket order is the one
 * thing in the style layer with no test-visible symptom until the cascade is already wrong.
 *
 * Being a component is what makes that import load-bearing on its face. `ErdEditor` renders
 * `<${GlobalStyles} />`, which no bundler will drop and no `no-unused-imports` pass will offer to
 * delete; a bare `import '@/components/global-styles/GlobalStyles'` in its place would be a naked
 * side-effect import that `simple-import-sort` is free to move and a future cleanup is free to
 * mistake for dead weight. The empty render is the cheaper half of that trade.
 */
const GlobalStyles: FC<GlobalStylesProps> = () => {
  return () => html``;
};

export default GlobalStyles;
