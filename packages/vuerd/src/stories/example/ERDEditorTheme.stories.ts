import { Story, Meta } from '@storybook/web-components';
import { ERDEditor as Editor, ERDEditorProps } from './ERDEditorTheme';

export default {
  title: 'Example/Theme',
  argTypes: {
    theme: {
      control: {
        type: 'radio',
        options: [
          'default',
          'abyss',
          'kimbie-dark',
          'monokai-dimmed',
          'monokai',
          'one-dark-pro',
          'red',
          'solarized-dark',
          'solarized-light',
          'tomorrow-night-blue',
          'vscode-dark',
        ],
      },
    },
  },
} as Meta;

const Template: Story<Partial<ERDEditorProps>> = args => Editor(args);

export const ERDEditor = Template.bind({});
ERDEditor.args = {
  theme: 'default',
};
