import {
  IconDefinition,
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
  faCode,
  faList,
  faRedoAlt,
  faUndoAlt,
  faSearch,
  faQuestion,
  faProjectDiagram,
  faFileImage,
  faFileExport,
  faEye,
  faSlidersH,
  faDatabase,
  faColumns,
  faFileImport,
  faFileCode
} from "@fortawesome/free-solid-svg-icons";

const icons = [
  faKey,
  faTable,
  faStickyNote,
  faPlus,
  faTimes,
  faChevronRight,
  faCheck,
  faCode,
  faList,
  faRedoAlt,
  faUndoAlt,
  faSearch,
  faQuestion,
  faProjectDiagram,
  faFileImage,
  faFileExport,
  faEye,
  faSlidersH,
  faDatabase,
  faColumns,
  faFileImport,
  faFileCode
];

export function getIcon(
  prefix: string,
  iconName: string
): IconDefinition | null {
  let target: IconDefinition | null = null;
  for (const icon of icons) {
    if (icon.prefix === prefix && icon.iconName === iconName) {
      target = icon;
      break;
    }
  }
  return target;
}
