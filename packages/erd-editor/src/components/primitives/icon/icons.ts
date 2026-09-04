import {
  Atom,
  Braces,
  Brackets,
  CaseSensitive,
  Check,
  ChevronRight,
  Code,
  Contrast,
  Copy,
  Database,
  Diff,
  Eye,
  FileDiff,
  FileImage,
  FileInput,
  FileOutput,
  GripVertical,
  type IconNode,
  KeyRound,
  MapPin,
  Minus,
  MoonStar,
  MousePointer2,
  Palette,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcwClock,
  Search,
  Settings,
  Share2,
  Spline,
  StickyNote,
  Sun,
  Table,
  TableProperties,
  Undo2,
  Workflow,
  X,
} from 'lucide';

export const ICON_VIEW_BOX = '0 0 24 24';

/** The stroke lucide draws with, in the box its path data is written in. */
export const ICON_STROKE_WIDTH = 2;

export type IconNodeChild = IconNode[number];

// lucide's own kebab names, disjoint from the PascalCase notation ones, which
// is what lets one flat namespace serve both.
const LUCIDE_ICON = {
  atom: Atom,
  braces: Braces,
  brackets: Brackets,
  'case-sensitive': CaseSensitive,
  check: Check,
  'chevron-right': ChevronRight,
  code: Code,
  contrast: Contrast,
  copy: Copy,
  database: Database,
  diff: Diff,
  eye: Eye,
  'file-diff': FileDiff,
  'file-image': FileImage,
  'file-input': FileInput,
  'file-output': FileOutput,
  'grip-vertical': GripVertical,
  'key-round': KeyRound,
  'map-pin': MapPin,
  minus: Minus,
  'moon-star': MoonStar,
  'mouse-pointer-2': MousePointer2,
  palette: Palette,
  plus: Plus,
  'redo-2': Redo2,
  'refresh-cw': RefreshCw,
  'rotate-ccw-clock': RotateCcwClock,
  search: Search,
  settings: Settings,
  'share-2': Share2,
  spline: Spline,
  'sticky-note': StickyNote,
  sun: Sun,
  table: Table,
  'table-properties': TableProperties,
  'undo-2': Undo2,
  workflow: Workflow,
  x: X,
} satisfies Record<string, IconNode>;

/**
 * Crow's-foot notation on lucide's grid, named after the v2 RelationshipType
 * members: a connector along y 12 carrying a ring, one or two bars and a fork,
 * each glyph spanning the safe area so the seven line up in a menu.
 */
export const NOTATION_ICON = {
  /** @deprecated The one glyph carrying all three marks, so its ring sits flush left for room. */
  ZeroOneN: [
    ['circle', { cx: '7', cy: '12', r: '5' }],
    ['path', { d: 'M12 12h10' }],
    ['path', { d: 'M15 6v12' }],
    ['path', { d: 'M16 12l6-6' }],
    ['path', { d: 'M16 12l6 6' }],
  ],
  ZeroOne: [
    ['path', { d: 'M2 12h3' }],
    ['circle', { cx: '10', cy: '12', r: '5' }],
    ['path', { d: 'M15 12h7' }],
    ['path', { d: 'M20 6v12' }],
  ],
  ZeroN: [
    ['path', { d: 'M2 12h3' }],
    ['circle', { cx: '10', cy: '12', r: '5' }],
    ['path', { d: 'M15 12h7' }],
    ['path', { d: 'M15 12l7-6' }],
    ['path', { d: 'M15 12l7 6' }],
  ],
  OneOnly: [
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M14 6v12' }],
    ['path', { d: 'M19 6v12' }],
  ],
  OneN: [
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M14 6v12' }],
    ['path', { d: 'M15 12l7-6' }],
    ['path', { d: 'M15 12l7 6' }],
  ],
  /** @deprecated */
  One: [
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M14 6v12' }],
  ],
  /** @deprecated */
  N: [
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M15 12l7-6' }],
    ['path', { d: 'M15 12l7 6' }],
  ],
} satisfies Record<string, IconNode>;

export type LucideIconName = keyof typeof LUCIDE_ICON;
export type NotationIconName = keyof typeof NOTATION_ICON;
export type IconName = LucideIconName | NotationIconName;

export type IconDefinition = { name: IconName; node: IconNode };

export const iconMap: Record<IconName, IconDefinition> = {} as Record<
  IconName,
  IconDefinition
>;
setIconMap();

function setIconMap() {
  for (const name of Object.keys(LUCIDE_ICON) as LucideIconName[]) {
    iconMap[name] = { name, node: LUCIDE_ICON[name] };
  }
  for (const name of Object.keys(NOTATION_ICON) as NotationIconName[]) {
    iconMap[name] = { name, node: NOTATION_ICON[name] };
  }
}

export function getIcon(name: string): IconDefinition | undefined {
  return (iconMap as Record<string, IconDefinition>)[name];
}
