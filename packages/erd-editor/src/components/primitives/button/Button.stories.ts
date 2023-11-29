import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Button, { ButtonProps } from './Button';

const meta = {
  title: 'Primitives/Button',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${Button} ...${args} />`);
    return fragment;
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['1', '2', '3'],
    },
    text: {
      control: 'text',
    },
    onClick: {
      action: 'onClick',
    },
  },
} satisfies Meta<ButtonProps>;

export default meta;
type Story = StoryObj<ButtonProps>;

export const Normal: Story = {
  args: {
    size: '2',
    text: 'Button',
  },
};
