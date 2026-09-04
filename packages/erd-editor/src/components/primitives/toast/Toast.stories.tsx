import { render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html-vite';

import Button from '@/components/primitives/button/Button';

import Toast, { ToastProps } from './Toast';

const meta = {
  title: 'Primitives/Toast',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(
      fragment,
      // action is an optional control, Button's text is not: the tagged
      // template passed undefined straight through and nothing checked it.
      <Toast {...args} action={<Button text={args.action ?? ''} />} />
    );
    return fragment;
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    action: { control: 'text' },
    busy: { control: 'boolean' },
    progress: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
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

export const Busy: Story = {
  args: {
    description: 'Exporting PNG…',
    busy: true,
  },
};

export const Progress: Story = {
  args: {
    description: 'Placing tables… 42%',
    action: 'Apply',
    progress: 0.42,
  },
};
