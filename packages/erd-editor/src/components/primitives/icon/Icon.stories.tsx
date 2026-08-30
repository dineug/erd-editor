import { css, DOMTemplateLiterals, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html-vite';

import { typography } from '@/styles/typography.styles';

import Icon, { IconProps } from './Icon';
import { iconMap, IconName } from './icons';

const meta = {
  title: 'Primitives/Icon',
} satisfies Meta<IconProps>;

export default meta;
type Story = StoryObj<IconProps>;

const toFragment = (template: DOMTemplateLiterals) => {
  const fragment = document.createDocumentFragment();
  render(fragment, template);
  return fragment;
};

const grid = css`
  display: flex;
  width: 100%;
  flex-flow: wrap;
  align-content: flex-start;
`;

const cell = css`
  display: inline-flex;
  min-width: 148px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  transition: color 0.15s;

  &:hover {
    color: var(--active);
  }
`;

const caption = css`
  ${typography.paragraph}
  color: var(--foreground);
`;

const rows = css`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const row = css`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 20px;
`;

const rowLabel = css`
  ${typography.paragraph}
  width: 48px;
  color: var(--foreground);
`;

const svgNames = Object.values(iconMap)
  .filter(icon => icon.type === 'svg')
  .map(icon => icon.name);

const base64Names = Object.values(iconMap)
  .filter(icon => icon.type === 'base64')
  .map(icon => icon.name);

// 12px is the row to check: stroke-width: 2 on a 24 grid renders at 1.0 device px.
const SIZES = [12, 14, 16, 18, 24];

const SAMPLE: IconName[] = [
  'key-round',
  'x',
  'plus',
  'check',
  'chevron-right',
  'grip-vertical',
  'map-pin',
  'contrast',
  'mouse-pointer-2',
  'database',
  'workflow',
  'share-2',
];

export const Icons: Story = {
  render: () =>
    toFragment(
      <div class={grid}>
        {svgNames.map(name => (
          <div class={cell}>
            <Icon name={name} size={24} useTransition={true} />
            <div class={caption}>{name}</div>
          </div>
        ))}
      </div>
    ),
};

export const RelationshipNotation: Story = {
  render: () =>
    toFragment(
      <div class={grid}>
        {base64Names.map(name => (
          <div class={cell}>
            <Icon name={name} size={24} />
            <div class={caption}>{name}</div>
          </div>
        ))}
      </div>
    ),
};

export const Sizes: Story = {
  render: () =>
    toFragment(
      <div class={rows}>
        {SIZES.map(size => (
          <div class={row}>
            <div class={rowLabel}>{size}px</div>
            {SAMPLE.map(name => (
              <Icon name={name} size={size} title={name} />
            ))}
          </div>
        ))}
      </div>
    ),
};
