import './ErdEditor';

import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import type { ErdEditorProps } from './ErdEditor';

const meta = {
  title: 'ErdEditor',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<erd-editor ...${args} />`);
    return fragment;
  },
  argTypes: {
    readonly: {
      type: 'boolean',
    },
  },
  parameters: {
    css: `
      body {
        padding: 0 !important;
        margin: 0 !important;
      }

      #storybook-root {
        height: 100vh;
      }

      #storybook-root > div {
        height: 100%;
      }
    `,
  },
} satisfies Meta<ErdEditorProps>;

export default meta;
type Story = StoryObj<ErdEditorProps>;

export const Normal: Story = {
  args: {
    readonly: false,
  },
};
