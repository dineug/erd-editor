export interface IconDefinition {
  prefix: string;
  iconName: string;
  icon: [
    number, // width
    number, // height
    string[] | undefined, // ligatures
    string | undefined, // unicode
    string, // svgPathData
  ];
}
