import { css, html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Sash, { Cursor, SashProps, SashType } from './Sash';

const meta = {
  title: 'Primitives/Sash',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(
      fragment,
      html`
        <div
          class=${css`
            .sash {
              background-color: red;
            }
          `}
        >
          <${Sash} ...${args} />
        </div>
      `
    );
    return fragment;
  },
  argTypes: {
    type: {
      options: Object.values(SashType),
      control: 'radio',
    },
    cursor: {
      options: Object.values(Cursor),
      control: 'select',
    },
    top: {
      control: 'number',
    },
    left: {
      control: 'number',
    },
    onMove: {
      action: 'onMove',
    },
  },
} satisfies Meta<SashProps>;

export default meta;
type Story = StoryObj<SashProps>;

export const Vertical: Story = {
  args: {
    type: 'vertical',
  },
};

export const Horizontal: Story = {
  args: {
    type: 'horizontal',
  },
};

export const Edge: Story = {
  args: {
    type: 'edge',
    cursor: 'nwse-resize',
  },
};
