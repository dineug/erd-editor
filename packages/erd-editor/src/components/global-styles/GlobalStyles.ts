import { FC, html, setGlobalStyleOrder } from '@dineug/r-html';

import { colorPickerStyle } from '@/styles/colorPicker.style';
import { fontsStyle } from '@/styles/fonts.styles';
import { resetStyle } from '@/styles/reset.styles';
import { scrollbarStyle } from '@/styles/scrollbar.styles';
import { typographyStyle } from '@/styles/typography.styles';

export type GlobalStylesProps = {};

/**
 * The cascade order of the global bucket, stated as data. The imports above are
 * sorted alphabetically and evaluation order follows them, which would put the
 * reset behind the tokens it resets; this array is the one place that decides.
 */
setGlobalStyleOrder([
  resetStyle,
  fontsStyle,
  typographyStyle,
  scrollbarStyle,
  colorPickerStyle,
]);

/**
 * Renders nothing, and stays anyway. What is left is the setGlobalStyleOrder
 * call above, a module side effect, and being a component is what keeps its
 * import load-bearing on its face rather than a naked side-effect import.
 */
const GlobalStyles: FC<GlobalStylesProps> = () => {
  return () => html``;
};

export default GlobalStyles;
