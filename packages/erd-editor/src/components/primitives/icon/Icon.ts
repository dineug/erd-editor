import { FC, html, svg } from '@dineug/r-html';

import { restAttrs } from '@/utils/attribute';

import * as styles from './Icon.styles';
import { getIcon } from './icons';

const DEFAULT_SIZE = 18;
const SIZE = 24;
const SIZE_REM = 1.5;

export type IconProps = {
  class?: any;
  prefix?: string;
  name: string;
  size?: number;
  color?: string;
  useTransition?: boolean;
  title?: string;
  rotate?: number;
  onClick?: (event: MouseEvent) => void;
  onMouseenter?: (event: MouseEvent) => void;
  onMouseleave?: (event: MouseEvent) => void;
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
    <div
      class=${['icon', styles.wrap, props.class]}
      style=${{
        transform: `rotate(${props.rotate ?? 0}deg)`,
      }}
      ...${restAttrs({ title: props.title })}
      @click=${props.onClick}
      @mouseenter=${props.onMouseenter}
      @mouseleave=${props.onMouseleave}
    >
      ${prefix === 'base64'
        ? html`
            <img
              style=${{
                width: `${size}px`,
                height: `${size}px`,
              }}
              src=${d}
            />
          `
        : svg`
            <svg
              class=${props.useTransition ? styles.icon : null}
              style=${{
                width: prefix === 'fas' ? `${rem}rem` : `${size}px`,
                height: prefix === 'fas' ? `${rem}rem` : `${size}px`,
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
