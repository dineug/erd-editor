import { ReferentialAction, ReferentialActionToSQL } from '@/constants/schema';

const SEPARATOR = /[\s_]+/g;

/**
 * The action a source spells as SQL does, in any case, with a space or an
 * underscore between words: CASCADE, set null, no_action. Anything else is none.
 */
export function toReferentialAction(spelling: string): number {
  const value = spelling.trim().replace(SEPARATOR, ' ').toUpperCase();
  const entry = Object.entries(ReferentialActionToSQL).find(
    ([, sql]) => sql === value
  );

  return entry ? Number(entry[0]) : ReferentialAction.none;
}

/** The letters an action shows by beside a connector, after erwin's: C, R, SN, SD, NA. */
const ACTION_LETTERS: Record<number, string> = {
  [ReferentialAction.noAction]: 'NA',
  [ReferentialAction.cascade]: 'C',
  [ReferentialAction.setNull]: 'SN',
  [ReferentialAction.setDefault]: 'SD',
  [ReferentialAction.restrict]: 'R',
};

type ReferentialActions = { onDelete: number; onUpdate: number };

/**
 * What a connector shows at its child end: D: for ON DELETE, then U: for ON
 * UPDATE, each only when set, so a relationship that sets neither shows none.
 *
 * @example
 * referentialActionLabel({ onDelete: cascade, onUpdate: restrict }); // 'D:C U:R'
 */
export function referentialActionLabel({
  onDelete,
  onUpdate,
}: ReferentialActions): string {
  return [
    ACTION_LETTERS[onDelete] ? `D:${ACTION_LETTERS[onDelete]}` : '',
    ACTION_LETTERS[onUpdate] ? `U:${ACTION_LETTERS[onUpdate]}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** The clauses the label stands for, one to a line, as a hover spells them out. */
export function referentialActionTitle({
  onDelete,
  onUpdate,
}: ReferentialActions): string {
  return [
    ReferentialActionToSQL[onDelete]
      ? `ON DELETE ${ReferentialActionToSQL[onDelete]}`
      : '',
    ReferentialActionToSQL[onUpdate]
      ? `ON UPDATE ${ReferentialActionToSQL[onUpdate]}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
