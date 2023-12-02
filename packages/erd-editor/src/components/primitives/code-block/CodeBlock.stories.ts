import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import CodeBlock, { CodeBlockProps } from './CodeBlock';

const meta = {
  title: 'Primitives/CodeBlock',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${CodeBlock} ...${args} />`);
    return fragment;
  },
  argTypes: {
    value: {
      control: 'text',
    },
    onCopy: {
      action: 'onCopy',
    },
  },
} satisfies Meta<CodeBlockProps>;

export default meta;
type Story = StoryObj<CodeBlockProps>;

export const Normal: Story = {
  args: {
    value: 'SELECT * FROM users;',
  },
};
