import { kebabCase } from 'lodash-es';

export type Theme = {
  primary: string;
  secondary: string;
  primaryForeground: string;
  secondaryForeground: string;
  focus: string;
  edit: string;
  select: string;
  hover: string;
  keyPK: string;
  keyFK: string;
  keyPFK: string;
};

export const themeToTokensString = (theme: Theme) =>
  Object.keys(theme)
    .map(
      key =>
        `--dineug-erd-editor-color-${kebabCase(key)}: ${Reflect.get(
          theme,
          key
        )};`
    )
    .join('\n');
