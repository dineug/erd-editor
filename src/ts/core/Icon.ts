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
  faQuestion,
  faProjectDiagram,
  faFileImage,
  faFileExport,
  faEye,
  faSlidersH,
  faDatabase,
  faColumns,
  faFileImport,
  faFileCode,
} from "@fortawesome/free-solid-svg-icons";
import { mdiChartBubble } from "@mdi/js";

interface IconDefinitionOverriding {
  prefix: string;
  iconName: string;
  icon: [number, number, string[], string, string];
}

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
  faFileCode,
  {
    prefix: "mdi",
    iconName: "chart-bubble",
    icon: [24, 24, , , mdiChartBubble],
  },
] as IconDefinitionOverriding[];

export function getIcon(
  prefix: string,
  iconName: string
): IconDefinitionOverriding | null {
  let target: IconDefinitionOverriding | null = null;
  for (const icon of icons) {
    if (icon.prefix === prefix && icon.iconName === iconName) {
      target = icon;
      break;
    }
  }
  return target;
}
