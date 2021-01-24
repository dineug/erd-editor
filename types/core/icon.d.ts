export interface IconDefinition {
  prefix: string;
  iconName: string;
  icon: [number, number, string[], string, string];
}

declare function addIcon(icon: IconDefinition): void;
