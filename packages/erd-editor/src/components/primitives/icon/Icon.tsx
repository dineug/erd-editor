import { FC, svg } from '@dineug/r-html';

import { restAttrs } from '@/utils/attribute';

import * as styles from './Icon.styles';
import {
  getIcon,
  ICON_VIEW_BOX,
  type IconName,
  type IconNodeChild,
} from './icons';

const DEFAULT_SIZE = 18;
const STROKE_WIDTH = 2;
const FILL = 'none';
const STROKE = 'currentColor';

export type IconProps = {
  class?: any;
  name: IconName;
  size?: number;
  useTransition?: boolean;
  title?: string;
  rotate?: number;
  onClick?: (event: MouseEvent) => void;
  onMouseenter?: (event: MouseEvent) => void;
  onMouseleave?: (event: MouseEvent) => void;
};

const text = (value: string | number | undefined) =>
  value === undefined ? undefined : String(value);

// An omitted attribute commits as '', not as absent, so a child has to spell
// out the root's own value to inherit it.
const paint = (value: string | number | undefined, inherited: string) =>
  value === undefined ? inherited : String(value);

// Spelled out rather than spread: SpreadPart commits with Reflect.set, and
// an SVG geometry attribute is not a DOM property.
const shape = ([tag, attrs]: IconNodeChild) => {
  const fill = paint(attrs.fill, FILL);
  const stroke = paint(attrs.stroke, STROKE);

  switch (tag) {
    case 'path':
      return <path d={text(attrs.d)} fill={fill} stroke={stroke}></path>;
    case 'circle':
      return (
        <circle
          cx={attrs.cx}
          cy={attrs.cy}
          r={attrs.r}
          fill={fill}
          stroke={stroke}
        ></circle>
      );
    case 'rect':
      return (
        <rect
          x={attrs.x}
          y={attrs.y}
          width={attrs.width}
          height={attrs.height}
          rx={attrs.rx ?? attrs.ry}
          ry={attrs.ry ?? attrs.rx}
          fill={fill}
          stroke={stroke}
        ></rect>
      );
    case 'line':
      return (
        <line
          x1={attrs.x1}
          y1={attrs.y1}
          x2={attrs.x2}
          y2={attrs.y2}
          fill={fill}
          stroke={stroke}
        ></line>
      );
    case 'ellipse':
      return (
        <ellipse
          cx={attrs.cx}
          cy={attrs.cy}
          rx={attrs.rx}
          ry={attrs.ry}
          fill={fill}
          stroke={stroke}
        ></ellipse>
      );
    default:
      return svg``;
  }
};

const Icon: FC<IconProps> = (props, ctx) => () => {
  const name = props.name ?? '';
  const size = props.size ?? DEFAULT_SIZE;
  const icon = getIcon(name);
  if (!icon) return svg``;

  return (
    <div
      class={['icon', styles.wrap, props.class]}
      style={{
        transform: `rotate(${props.rotate ?? 0}deg)`,
      }}
      {...restAttrs({ title: props.title })}
      on:click={props.onClick}
      on:mouseenter={props.onMouseenter}
      on:mouseleave={props.onMouseleave}
    >
      {icon.type === 'base64' ? (
        <img
          style={{
            width: `${size}px`,
            height: `${size}px`,
          }}
          src={icon.src}
        />
      ) : (
        <svg
          class={props.useTransition ? styles.icon : null}
          style={{
            width: `${size}px`,
            height: `${size}px`,
          }}
          viewBox={ICON_VIEW_BOX}
          fill={FILL}
          stroke={STROKE}
          stroke-width={STROKE_WIDTH}
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {icon.node.map(shape)}
        </svg>
      )}
    </div>
  );
};

export default Icon;
