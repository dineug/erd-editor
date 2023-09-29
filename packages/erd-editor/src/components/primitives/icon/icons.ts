import {
  faCheck,
  faChevronRight,
  faCode,
  faCog,
  faColumns,
  faEye,
  faFileCode,
  faFileExport,
  faFileImage,
  faFileImport,
  faKey,
  faMousePointer,
  faPalette,
  faPlus,
  faProjectDiagram,
  faQuestion,
  faRotateLeft,
  faRotateRight,
  faSearch,
  faStickyNote,
  faSyncAlt,
  faTable,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import {
  mdiAtom,
  mdiCodeBrackets,
  mdiCodeJson,
  mdiDatabase,
  mdiDatabaseExport,
  mdiDatabaseImport,
  mdiFormatLetterCase,
  mdiPalette,
  mdiTableCog,
  mdiVectorLine,
  mdiXml,
} from '@mdi/js';

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

const createMDI = (name: string, icon: string): IconDefinition => ({
  prefix: 'mdi',
  iconName: name,
  icon: [24, 24, , , icon],
});

const icons = [
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
  faRotateRight,
  faRotateLeft,
  faSearch,
  faQuestion,
  faProjectDiagram,
  faFileImage,
  faFileExport,
  faEye,
  faFileImport,
  faFileCode,
  faCog,
  faMousePointer,
  faCode,
  faSyncAlt,
  faPalette,
  faColumns,
  createMDI('code-json', mdiCodeJson),
  createMDI('database', mdiDatabase),
  createMDI('database-import', mdiDatabaseImport),
  createMDI('database-export', mdiDatabaseExport),
  createMDI('palette', mdiPalette),
  createMDI('format-letter-case', mdiFormatLetterCase),
  createMDI('table-cog', mdiTableCog),
  createMDI('code-brackets', mdiCodeBrackets),
  createMDI('xml', mdiXml),
  createMDI('vector-line', mdiVectorLine),
  createMDI('atom', mdiAtom),
] as IconDefinition[];

export const iconMap: Record<string, IconDefinition> = {};
setIconMap(icons);

function setIconMap(newIcons: IconDefinition[]) {
  newIcons.reduce<Record<string, IconDefinition>>((acc, cur) => {
    acc[`${cur.prefix}-${cur.iconName}`] = cur;
    return acc;
  }, iconMap);
}

export function getIcon(
  prefix: string,
  iconName: string
): IconDefinition | undefined {
  return iconMap[`${prefix}-${iconName}`];
}
