import {
  adoptHostSheet,
  canAdoptStyleSheets,
  FC,
  onUnmounted,
} from '@dineug/r-html';

import { type Theme, themeToTokensString } from '@/themes/tokens';

export type ThemeProps = {
  theme: Theme;
};

/** The one rule that puts every token of the theme on the host. */
const tokensRule = (theme: Theme) => `:host {
${themeToTokensString(theme)}
}`;

/**
 * The theme's tokens on its element: a sheet of its shadow root's own, which a
 * strict CSP lets through, or a <style> element where the browser adopts no
 * constructed sheet or the theme renders outside an element's shadow root.
 */
const Theme: FC<ThemeProps> = (props, ctx) => {
  const sheet = canAdoptStyleSheets() ? new CSSStyleSheet() : null;
  const drop = sheet ? adoptHostSheet(ctx.host, sheet) : null;
  if (!sheet || !drop) {
    return () => <style>{tokensRule(props.theme)}</style>;
  }

  onUnmounted(drop);

  // Written as it renders, so a theme the host changes renders it again.
  return () => {
    sheet.replaceSync(tokensRule(props.theme));
    return null;
  };
};

export default Theme;
