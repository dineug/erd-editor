const defaultStyle = {
  padding: '0',
  margin: '0',
  width: '100%',
  height: '100vh',
};

export function initializeStyle() {
  setTimeout(() => {
    [
      document.body,
      document.querySelector('#root'),
      document.querySelector('#root-inner'),
    ]
      .filter(element => !!element)
      .map(element => (element as HTMLElement).style)
      .forEach(style => Object.assign(style, defaultStyle));
  }, 0);
}

const themeKeys = [
  'canvas',
  'table',
  'tableActive',
  'focus',
  'keyPK',
  'keyFK',
  'keyPFK',
  'font',
  'fontActive',
  'fontPlaceholder',
  'contextmenu',
  'contextmenuActive',
  'edit',
  'columnSelect',
  'columnActive',
  'minimapShadow',
  'scrollbarThumb',
  'scrollbarThumbActive',
  'menubar',
  'visualization',
];

export function getTheme(props: any) {
  const theme: any = {};
  themeKeys.forEach(key => (theme[key] = props[key]));
  return theme;
}
