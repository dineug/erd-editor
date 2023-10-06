import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Kbd, { KbdProps } from './Kbd';

const meta = {
  title: 'Primitives/Kbd',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${Kbd} ...${args} />`);
    return fragment;
  },
  argTypes: {
    shortcut: {
      control: 'text',
    },
  },
} satisfies Meta<KbdProps>;

export default meta;
type Story = StoryObj<KbdProps>;

export const Normal: Story = {
  args: {
    shortcut: '$mod+Alt+KeyA',
  },
};
