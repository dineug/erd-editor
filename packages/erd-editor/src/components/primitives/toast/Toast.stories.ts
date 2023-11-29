import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Button from '@/components/primitives/button/Button';

import Toast, { ToastProps } from './Toast';

const meta = {
  title: 'Primitives/Toast',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(
      fragment,
      html`<${Toast}
        ...${args}
        action=${html`<${Button} text=${args.action} />`}
      />`
    );
    return fragment;
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    action: { control: 'text' },
  },
} satisfies Meta<ToastProps>;

export default meta;
type Story = StoryObj<ToastProps>;

export const Normal: Story = {
  args: {
    title: 'Scheduled: Catch up',
    description: 'Tuesday, December 5, 2023 at 8:33 PM',
    action: 'Undo',
  },
};
