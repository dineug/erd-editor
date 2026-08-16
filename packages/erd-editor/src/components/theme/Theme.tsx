import { FC } from '@dineug/r-html';

import { type Theme, themeToTokensString } from '@/themes/tokens';

export type ThemeProps = {
  theme: Theme;
};

const Theme: FC<ThemeProps> = props => {
  return () => (
    // The whole rule has to be one expression: `{` opens an interpolation in
    // JSX, so `:host {` cannot be written as markup text the way it was in the
    // tagged template.
    <style>
      {`:host {
${themeToTokensString(props.theme)}
}`}
    </style>
  );
};

export default Theme;
