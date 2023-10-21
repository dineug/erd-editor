import { FC, html, svg } from '@dineug/r-html';

import * as styles from './Icon.styles';
import { getIcon } from './icons';

const DEFAULT_SIZE = 18;
const SIZE = 24;
const SIZE_REM = 1.5;

export type IconProps = {
  prefix?: string;
  name: string;
  size?: number;
  color?: string;
  useTransition?: boolean;
  onClick?: (event: MouseEvent) => void;
};

const Icon: FC<IconProps> = (props, ctx) => () => {
  const prefix = props.prefix ?? 'fas';
  const name = props.name ?? '';
  const size = props.size ?? DEFAULT_SIZE;
  const icon = getIcon(prefix, name);
  if (!icon) return svg``;

  const [width, height, , , d] = icon.icon;
  const rem = SIZE_REM * (size / SIZE);

  return html`
    <div class=${styles.wrap} @click=${props.onClick}>
      ${prefix === 'base64'
        ? html`
            <img
              style=${{
                width: `${rem}rem`,
                height: `${rem}rem`,
              }}
              src=${d}
            />
          `
        : svg`
            <svg
              class=${props.useTransition ? styles.icon : null}
              style=${{
                width: `${rem}rem`,
                height: `${rem}rem`,
              }}
              viewBox="0 0 ${width} ${height}"
            >
              ${
                props.color
                  ? svg`<path d=${d} fill=${props.color}></path>`
                  : svg`<path d=${d}></path>`
              }
            </svg>
    `}
    </div>
  `;
};

export default Icon;
