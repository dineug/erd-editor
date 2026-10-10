import { css, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html-vite';

import Select from './Select';

type SelectStoryArgs = {
  dir: 'ltr' | 'rtl';
  dimmed: boolean;
  disabled: boolean;
  width: number;
  onChange: (event: Event) => void;
};

const DATABASES = [
  'MariaDB',
  'MSSQL',
  'MySQL',
  'Oracle',
  'PostgreSQL',
  'SQLite',
  'a_very_long_value_that_ends_short_of_the_chevron',
];

const meta = {
  title: 'Primitives/Select',
  render: args => {
    const fragment = document.createDocumentFragment();
    const width = css`
      width: ${args.width}px;
    `;
    render(
      fragment,
      <div prop:dir={args.dir}>
        <Select class={width} dimmed={args.dimmed}>
          <select bool:disabled={args.disabled} on:change={args.onChange}>
            {DATABASES.map(name => (
              <option>{name}</option>
            ))}
          </select>
        </Select>
      </div>
    );
    return fragment;
  },
  argTypes: {
    dir: {
      control: 'radio',
      options: ['ltr', 'rtl'],
    },
    dimmed: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
    width: {
      control: { type: 'range', min: 80, max: 320, step: 4 },
    },
    onChange: {
      action: 'onChange',
    },
  },
} satisfies Meta<SelectStoryArgs>;

export default meta;
type Story = StoryObj<SelectStoryArgs>;

export const Normal: Story = {
  args: {
    dir: 'ltr',
    dimmed: false,
    disabled: false,
    width: 132,
  },
};

export const RightToLeft: Story = {
  args: {
    dir: 'rtl',
    dimmed: false,
    disabled: false,
    width: 132,
  },
};

export const Dimmed: Story = {
  args: {
    dir: 'ltr',
    dimmed: true,
    disabled: false,
    width: 260,
  },
};
