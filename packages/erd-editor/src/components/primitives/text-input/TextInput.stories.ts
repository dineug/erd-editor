import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import TextInput, { TextInputProps } from './TextInput';

const meta = {
  title: 'Primitives/TextInput',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${TextInput} ...${args} />`);
    return fragment;
  },
  argTypes: {
    title: {
      control: 'text',
    },
    placeholder: {
      control: 'text',
    },
    readonly: {
      control: 'boolean',
    },
    width: {
      control: 'number',
    },
    value: {
      control: 'text',
    },
    numberOnly: {
      control: 'boolean',
    },
    onInput: {
      action: 'onInput',
    },
    onChange: {
      action: 'onChange',
    },
    onBlur: {
      action: 'onBlur',
    },
    onKeyup: {
      action: 'onKeyup',
    },
  },
} satisfies Meta<TextInputProps>;

export default meta;
type Story = StoryObj<TextInputProps>;

export const Normal: Story = {
  args: {
    readonly: false,
    placeholder: 'placeholder',
    value: '',
  },
};
