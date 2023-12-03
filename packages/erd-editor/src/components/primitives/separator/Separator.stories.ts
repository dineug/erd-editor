import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Separator, { SeparatorProps } from './Separator';

const meta = {
  title: 'Primitives/Separator',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${Separator} ...${args} />`);
    return fragment;
  },
  argTypes: {
    space: {
      control: {
        type: 'range',
        min: 0,
        max: 100,
      },
    },
    padding: {
      control: {
        type: 'range',
        min: 0,
        max: 100,
      },
    },
  },
} satisfies Meta<SeparatorProps>;

export default meta;
type Story = StoryObj<SeparatorProps>;

export const Normal: Story = {
  args: {
    space: 24,
    padding: 0,
  },
};
