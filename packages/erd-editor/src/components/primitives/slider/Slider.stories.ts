import { FC, html, observable, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import Slider, { SliderProps } from './Slider';

const SliderTemplate: FC<SliderProps> = (props, ctx) => {
  const state = observable({
    value: props.value,
  });

  const handleChange = (value: number) => {
    state.value = value;
  };

  return () => html`
    <${Slider} ...${props} value=${state.value} .onChange=${handleChange} />
  `;
};

const meta = {
  title: 'Primitives/Slider',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${SliderTemplate} ...${args} />`);
    return fragment;
  },
  argTypes: {
    min: {
      control: 'number',
    },
    max: {
      control: 'number',
    },
    value: {
      control: 'number',
    },
    onChange: {
      action: 'onChange',
    },
  },
} satisfies Meta<SliderProps>;

export default meta;
type Story = StoryObj<SliderProps>;

export const Normal: Story = {
  args: {
    min: 0,
    max: 100,
    value: 50,
  },
};
