import { create } from '@storybook/theming';

export const theme = create({
  base: 'dark',

  colorPrimary: 'hotpink',
  colorSecondary: 'deepskyblue',

  appBg: 'rgb(33, 37, 43)',
  appContentBg: '#282c34',
  appBorderColor: 'rgb(33, 37, 43)',
  appBorderRadius: 4,

  textColor: '#ddd',
  textInverseColor: 'black',

  barTextColor: '#ddd',
  barSelectedColor: 'white',
  barBg: 'rgb(33, 37, 43)',

  inputBg: '#282c34',
  inputBorder: '#ddd',
  inputTextColor: 'white',
  inputBorderRadius: 4,
});
