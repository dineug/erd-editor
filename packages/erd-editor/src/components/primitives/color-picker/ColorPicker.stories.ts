import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import ColorPicker, { ColorPickerProps } from './ColorPicker';

const meta = {
  title: 'Primitives/ColorPicker',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${ColorPicker} ...${args} />`);
    return fragment;
  },
  argTypes: {
    x: {
      type: 'number',
    },
    y: {
      type: 'number',
    },
    color: {
      type: 'string',
    },
    onChange: {
      action: 'onChange',
    },
    onLastUpdate: {
      action: 'onLastUpdate',
    },
  },
} satisfies Meta<ColorPickerProps>;

export default meta;
type Story = StoryObj<ColorPickerProps>;

export const Normal: Story = {
  args: {
    x: 0,
    y: 0,
  },
};
