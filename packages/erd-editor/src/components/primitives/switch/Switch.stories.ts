import { FC, html, observable, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Switch, { SwitchProps } from './Switch';

const SwitchTemplate: FC<SwitchProps> = (props, ctx) => {
  const state = observable({
    value: props.value,
  });

  const handleChange = (value: boolean) => {
    state.value = value;
  };

  return () =>
    html`
      <${Switch} ...${props} value=${state.value} .onChange=${handleChange} />
    `;
};

const meta = {
  title: 'Primitives/Switch',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${SwitchTemplate} ...${args} />`);
    return fragment;
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['1', '2', '3'],
    },
    value: {
      control: 'boolean',
    },
    onChange: {
      action: 'onChange',
    },
  },
} satisfies Meta<SwitchProps>;

export default meta;
type Story = StoryObj<SwitchProps>;

export const Normal: Story = {
  args: {
    size: '2',
    value: true,
  },
};
