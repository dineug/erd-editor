import { render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html-vite';

import { createKeyBindingMap } from '@/utils/keyboard-shortcut';

import ColorPicker, { ColorPickerProps } from './ColorPicker';

const meta = {
  title: 'Primitives/ColorPicker',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, <ColorPicker {...args} />);
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
    onClear: {
      action: 'onClear',
    },
    onClose: {
      action: 'onClose',
    },
  },
} satisfies Meta<ColorPickerProps>;

export default meta;
type Story = StoryObj<ColorPickerProps>;

export const Normal: Story = {
  args: {
    x: 0,
    y: 0,
    keyBindingMap: createKeyBindingMap(),
    documentColors: ['#3b82f6', '#22c55e'],
  },
};
