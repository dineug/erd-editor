import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import EditInput, { EditInputProps } from './EditInput';

const meta = {
  title: 'Primitives/EditInput',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${EditInput} ...${args} />`);
    return fragment;
  },
  argTypes: {
    placeholder: {
      control: 'text',
    },
    edit: {
      control: 'boolean',
    },
    focus: {
      control: 'boolean',
    },
    width: {
      control: 'number',
    },
    value: {
      control: 'text',
    },
    onInput: {
      action: 'onInput',
    },
    onBlur: {
      action: 'onBlur',
    },
    onKeyup: {
      action: 'onKeyup',
    },
  },
} satisfies Meta<EditInputProps>;

export default meta;
type Story = StoryObj<EditInputProps>;

export const Normal: Story = {
  args: {
    placeholder: 'placeholder',
    value: '',
    width: 120,
    edit: false,
    focus: false,
  },
};

export const Edit: Story = {
  args: {
    placeholder: 'placeholder',
    value: '',
    width: 120,
    edit: true,
    focus: false,
  },
};
