export interface IconDefinition {
  prefix: string;
  iconName: string;
  icon: [
    number, // width
    number, // height
    string[], // ligatures
    string, // unicode
    string // svgPathData
  ];
}

declare function addIcon(icon: IconDefinition): void;
