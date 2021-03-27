import { defineComponent, svg } from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { getIcon } from '@/core/icon';
import { IconStyle } from './Icon.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-icon': IconElement;
  }
}

export interface IconProps {
  prefix: string;
  name: string;
  size: number;
  color: string | null;
}

export interface IconElement extends IconProps, HTMLElement {
  prefix: string;
}

const SIZE = 24;
const SIZE_REM = 1.5;

defineComponent('vuerd-icon', {
  observedProps: [
    {
      name: 'prefix',
      default: 'fas',
    },
    {
      name: 'name',
      default: '',
    },
    {
      name: 'size',
      type: Number,
      default: SIZE,
    },
    {
      name: 'color',
      default: null,
    },
  ],
  styleMap: {
    display: 'inline-flex',
    height: '100%',
    alignItems: 'center',
  },
  style: IconStyle,
  render: (props: IconProps, ctx: IconElement) => () => {
    const icon = getIcon(props.prefix, props.name);
    if (!icon) return svg``;

    const [width, height, , , d] = icon.icon;
    const rem = SIZE_REM * (props.size / SIZE);

    return svg`
      <svg
        class="vuerd-icon"
        style=${styleMap({
          width: `${rem}rem`,
          height: `${rem}rem`,
        })} 
        viewBox="0 0 ${width} ${height}"
      >
        ${
          props.color
            ? svg`<path d=${d} fill=${props.color}></path>`
            : svg`<path d=${d}></path>`
        }
      </svg>
    `;
  },
});
