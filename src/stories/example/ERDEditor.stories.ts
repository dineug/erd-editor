import { Story, Meta } from '@storybook/web-components';
import { ERDEditor as Editor, ERDEditorProps } from './ERDEditor';

export default {
  title: 'Example/Demo',
  argTypes: {
    readonly: { control: 'boolean' },
    canvas: { control: 'color' },
    table: { control: 'color' },
    tableActive: { control: 'color' },
    focus: { control: 'color' },
    keyPK: { control: 'color' },
    keyFK: { control: 'color' },
    keyPFK: { control: 'color' },
    font: { control: 'color' },
    fontActive: { control: 'color' },
    fontPlaceholder: { control: 'color' },
    contextmenu: { control: 'color' },
    contextmenuActive: { control: 'color' },
    edit: { control: 'color' },
    columnSelect: { control: 'color' },
    columnActive: { control: 'color' },
    minimapShadow: { control: 'color' },
    scrollbarThumb: { control: 'color' },
    scrollbarThumbActive: { control: 'color' },
    menubar: { control: 'color' },
    visualization: { control: 'color' },
  },
} as Meta;

const Template: Story<Partial<ERDEditorProps>> = args => Editor(args);

export const ERDEditor = Template.bind({});
ERDEditor.args = {
  readonly: false,
  canvas: '#282828',
  table: '#191919',
  tableActive: '#14496d',
  focus: '#00a9ff',
  keyPK: '#B4B400',
  keyFK: '#dda8b1',
  keyPFK: '#60b9c4',
  font: '#a2a2a2',
  fontActive: 'white',
  fontPlaceholder: '#6D6D6D',
  contextmenu: '#191919',
  contextmenuActive: '#383d41',
  edit: '#ffc107',
  columnSelect: '#232a2f',
  columnActive: '#372908',
  minimapShadow: 'black',
  scrollbarThumb: '#6D6D6D',
  scrollbarThumbActive: '#a2a2a2',
  menubar: 'black',
  visualization: '#191919',
};
