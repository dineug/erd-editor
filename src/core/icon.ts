import { IconDefinition } from '@type/core/icon';
import {
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
  faFilter,
  faQuestion,
  faProjectDiagram,
  faFileImage,
  faFileExport,
  faEye,
  faSlidersH,
  faDatabase,
  faFileImport,
  faFileCode,
  faCog,
  faMousePointer,
} from '@fortawesome/free-solid-svg-icons';
import { mdiChartBubble } from '@mdi/js';

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
  faFilter,
  faQuestion,
  faProjectDiagram,
  faFileImage,
  faFileExport,
  faEye,
  faSlidersH,
  faDatabase,
  faFileImport,
  faFileCode,
  faCog,
  faMousePointer,
  {
    prefix: 'mdi',
    iconName: 'chart-bubble',
    icon: [24, 24, , , mdiChartBubble],
  },
] as IconDefinition[];

export const getIcon = (prefix: string, iconName: string) =>
  icons.find(icon => icon.prefix === prefix && icon.iconName === iconName);

export const addIcon = (...newIcons: IconDefinition[]) =>
  icons.push(...newIcons);
