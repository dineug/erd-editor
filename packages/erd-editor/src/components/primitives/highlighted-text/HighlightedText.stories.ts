import { html, render } from '@dineug/r-html';
import type { Meta, StoryObj } from '@storybook/html';

import HighlightedText, { HighlightedTextProps } from './HighlightedText';

const meta = {
  title: 'Primitives/HighlightedText',
  render: args => {
    const fragment = document.createDocumentFragment();
    render(fragment, html`<${HighlightedText} ...${args} />`);
    return fragment;
  },
  argTypes: {
    autoEscape: {
      type: 'boolean',
    },
    caseSensitive: {
      type: 'boolean',
    },
    searchWords: {
      options: ['and', 'or', 'the'],
    },
    textToHighlight: {
      type: 'string',
    },
  },
} satisfies Meta<HighlightedTextProps>;

export default meta;
type Story = StoryObj<HighlightedTextProps>;

export const Normal: Story = {
  args: {
    autoEscape: false,
    caseSensitive: false,
    searchWords: ['and', 'or', 'the'],
    textToHighlight:
      'The dog is chasing the cat. Or perhaps they’re just playing?',
  },
};
