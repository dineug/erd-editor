import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import type { ContextMenuProps } from './ContextMenu';
import ContextMenu from './ContextMenu';

const meta = {
  title: 'Primitives/ContextMenu',
  tags: ['autodocs'],
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${ContextMenu} ...${args} />`);
    return fragment;
  },
  argTypes: {},
} satisfies Meta<ContextMenuProps>;

export default meta;
type Story = StoryObj<ContextMenuProps>;

export const Normal: Story = {};
