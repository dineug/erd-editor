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
