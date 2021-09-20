import {} from '@fortawesome/free-solid-svg-icons';
import { mdiChevronDown, mdiChevronRight } from '@mdi/js';

export interface IconDefinition {
  prefix: string;
  iconName: string;
  icon: [
    number, // width
    number, // height
    string[] | undefined, // ligatures
    string | undefined, // unicode
    string // svgPathData
  ];
}

export const createMDI = (name: string, icon: string): IconDefinition => ({
  prefix: 'mdi',
  iconName: name,
  icon: [24, 24, , , icon],
});

const icons = [
  createMDI('chevron-down', mdiChevronDown),
  createMDI('chevron-right', mdiChevronRight),
] as IconDefinition[];

const iconMap = icons.reduce<Record<string, IconDefinition>>((acc, cur) => {
  acc[`${cur.prefix}-${cur.iconName}`] = cur;
  return acc;
}, {});

export const getIcon = (
  prefix: string,
  iconName: string
): IconDefinition | undefined => iconMap[`${prefix}-${iconName}`];