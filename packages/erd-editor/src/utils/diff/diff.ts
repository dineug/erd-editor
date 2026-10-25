import type { Theme } from '@/themes/tokens';

/** The kinds of change a diff pane marks, one bit each. */
export const Diff = {
  insert: 1,
  delete: 2,
  modify: 4,
  rename: 8,
} as const;

/**
 * Map<path, diff> for one entity: a cell's path is the FocusType of the cell
 * showing it, and ENTITY_PATH stands for the entity as a whole.
 */
export type DiffPaths = Map<string, number>;

/** Map<id, paths> for the entities one pane marks. */
export type DiffMap = Map<string, DiffPaths>;

/** An entity added or removed, or one only moved, resized, recoloured or regrouped. */
export const ENTITY_PATH = 'entity';
export const MEMO_VALUE_PATH = 'memoValue';
/** A column's primary key, which its key icon shows. */
export const COLUMN_KEY_PATH = 'columnPrimaryKey';
export const TABLE_GROUP_NAME_PATH = 'tableGroupName';

function foreground(theme: Theme, diff: number | undefined): string | null {
  switch (diff) {
    case Diff.insert:
      return theme.diffInsertForeground;
    case Diff.delete:
      return theme.diffDeleteForeground;
    case Diff.modify:
      return theme.diffModifyForeground;
    case Diff.rename:
      return theme.diffRenameForeground;
    default:
      return null;
  }
}

/**
 * The colour a cell's text takes in a diff pane: its own change's, else, in a
 * row, the row's as a whole; null where neither changed.
 */
export function diffTextColor(
  theme: Theme,
  paths: DiffPaths | null | undefined,
  path: string,
  row = false
): string | null {
  if (!paths) return null;
  return (
    foreground(theme, paths.get(path)) ??
    (row ? foreground(theme, paths.get(ENTITY_PATH)) : null)
  );
}

/** The outline an entity takes in a diff pane, or the colour of a line; null for none. */
export function diffOutline(
  theme: Theme,
  paths: DiffPaths | null | undefined
): string | null {
  return foreground(theme, paths?.get(ENTITY_PATH));
}
