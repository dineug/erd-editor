import Color from 'color';

const whiteColor = new Color('#ffffff');

export const toTextColor = (color: Color) =>
  color.contrast(whiteColor) <= 4.5 ? 'black' : 'white';
