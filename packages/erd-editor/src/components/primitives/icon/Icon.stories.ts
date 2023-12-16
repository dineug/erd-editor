import { css, html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import { typography } from '@/styles/typography.styles';

import Icon, { IconProps } from './Icon';
import { iconMap } from './icons';

const meta = {
  title: 'Primitives/Icon',
} satisfies Meta<IconProps>;

export default meta;
type Story = StoryObj<IconProps>;

export const Icons: Story = {
  render: () => {
    const fragment = document.createDocumentFragment();
    render(
      fragment,
      html`
        <div
          class=${css`
            display: flex;
            width: 100%;
            height: 100%;
            flex-flow: wrap;
          `}
        >
          ${Object.values(iconMap).map(
            icon => html`
              <div
                class=${css`
                  display: inline-flex;
                  min-width: 200px;
                  height: 100px;
                  align-items: center;
                  justify-content: center;
                  flex-direction: column;
                  padding: 20px;
                  transition: color 0.15s;

                  &:hover {
                    color: var(--active);
                    fill: var(--active);
                  }
                `}
              >
                <${Icon}
                  prefix=${icon.prefix}
                  name=${icon.iconName}
                  size=${24}
                  useTransition=${true}
                />
                <div
                  class=${css`
                    ${typography.paragraph}
                  `}
                >
                  ${icon.prefix}-${icon.iconName}
                </div>
              </div>
            `
          )}
        </div>
      `
    );
    return fragment;
  },
};
